/**
 * dedup.ts
 *
 * 1. Browse all Algolia records
 * 2. For each non-supabase record that matches a supabase record (same
 *    date + distance + country + city), verify they truly represent the same
 *    event and that no data would be lost.
 * 3. Produce a patch list: supabase records that should be updated to inherit
 *    any extra data from the old record (e.g. _geoloc, map links).
 * 4. Apply patches + delete old IDs (with --dry-run flag for safety).
 */

import algoliasearch from 'algoliasearch';

const DRY_RUN = !process.argv.includes('--apply');

const ALGOLIA_APP = "1AWHE68HXJ";
const ALGOLIA_WRITE = "3f984ae147d9a001b43ecf96d8201138";

const client = algoliasearch(ALGOLIA_APP, ALGOLIA_WRITE);
const index = client.initIndex('brevets');

type Record = {
  objectID: string;
  date?: string;
  distance?: number;
  country?: string;
  city?: string;
  name?: string;
  _geoloc?: Array<{ lat: number; lng: number }>;
  map?: string[];
  site?: string;
  mail?: string;
  club?: string;
  ascent?: number;
  [key: string]: unknown;
};

console.log('Browsing Algolia index…');
const allRecords: Record[] = [];
await index.browseObjects<Record>({
  batch: (objects) => {
    for (const obj of objects) allRecords.push(obj);
  },
});
console.log(`Fetched ${allRecords.length} records`);

const normalize = (v?: string) => (v || '').trim().toLowerCase();
const eventKey = (r: Record) =>
  [r.date, r.distance, normalize(r.country), normalize(r.city)].join('|');

const supabaseByKey = new Map<string, Record>();
const supabaseById = new Map<string, Record>();
const otherRecords: Record[] = [];

for (const r of allRecords) {
  if (r.objectID.startsWith('supabase__')) {
    supabaseByKey.set(eventKey(r), r);
    supabaseById.set(r.objectID, r);
  } else {
    otherRecords.push(r);
  }
}

type DupeResult = {
  old: Record;
  base: Record;
  issues: string[];
  patch: Partial<Record> | null;
};

const results: DupeResult[] = [];
const noMatch: Record[] = [];

for (const old of otherRecords) {
  const key = eventKey(old);
  const base = supabaseByKey.get(key);
  if (!base) {
    noMatch.push(old);
    continue;
  }

  const issues: string[] = [];
  const patch: Partial<Record> = {};

  // Check name similarity (warn if very different)
  if (old.name && base.name) {
    const oldName = normalize(old.name);
    const baseName = normalize(base.name);
    if (oldName !== baseName) {
      issues.push(`name mismatch: "${old.name}" vs "${base.name}"`);
    }
  }

  // Inherit geoloc if base is missing it
  if ((!base._geoloc || base._geoloc.length === 0) && old._geoloc && old._geoloc.length > 0) {
    patch._geoloc = old._geoloc;
    issues.push(`old has _geoloc that base lacks → will patch`);
  }

  // Merge map links (union, URLs only)
  const isUrl = (s: string) => /^https?:\/\/\S+$/i.test(s.trim());
  const oldMaps = new Set((old.map ?? []).filter(isUrl));
  const baseMaps = new Set(base.map ?? []);
  const missingMaps = [...oldMaps].filter(m => !baseMaps.has(m));
  const skippedMaps = (old.map ?? []).filter(m => !isUrl(m));
  if (missingMaps.length > 0) {
    patch.map = [...baseMaps, ...missingMaps];
    issues.push(`old has extra map links: ${missingMaps.join(', ')} → will patch`);
  }
  if (skippedMaps.length > 0) {
    issues.push(`skipped non-URL map entries: ${skippedMaps.join(', ')}`);
  }

  // Inherit site/mail if base is missing
  if (!base.site && old.site) {
    patch.site = old.site;
    issues.push(`old has site that base lacks → will patch`);
  }
  if (!base.mail && old.mail) {
    patch.mail = old.mail;
    issues.push(`old has mail that base lacks → will patch`);
  }

  results.push({
    old,
    base,
    issues,
    patch: Object.keys(patch).length > 0 ? { objectID: base.objectID, ...patch } : null,
  });
}

const withIssues = results.filter(r => r.issues.length > 0);
const withPatches = results.filter(r => r.patch !== null);
const cleanDupes = results.filter(r => r.issues.length === 0);

console.log(`\n=== Summary ===`);
console.log(`Confirmed duplicates: ${results.length}`);
console.log(`  Clean (no data differences): ${cleanDupes.length}`);
console.log(`  With issues/patches: ${withIssues.length}`);
console.log(`    of which need patching: ${withPatches.length}`);
console.log(`Non-supabase records with no supabase match: ${noMatch.length}`);

if (withIssues.length > 0) {
  console.log(`\n=== Sample issues ===`);
  for (const r of withIssues.slice(0, 20)) {
    console.log(`  ${r.old.objectID} → ${r.base.objectID}`);
    for (const issue of r.issues) {
      console.log(`    • ${issue}`);
    }
  }
}

const nameMismatches = withIssues.filter(r => r.issues.some(i => i.includes('name mismatch')));
console.log(`\nName mismatches (possible false positives): ${nameMismatches.length}`);
console.log('Full name mismatch list:');
for (const r of nameMismatches) {
  console.log(`  ${r.old.objectID} → ${r.base.objectID}`);
  console.log(`    old:  "${r.old.name}"`);
  console.log(`    base: "${r.base.name}"`);
  console.log(`    key:  ${eventKey(r.old)}`);
}

await Bun.write('dupes-analysis.json', JSON.stringify({ results, noMatch }, null, 2));
console.log(`\nFull analysis written to dupes-analysis.json`);

if (DRY_RUN) {
  console.log(`\n[DRY RUN] Would delete ${results.length} old IDs from Algolia`);
  console.log(`[DRY RUN] Would patch ${withPatches.length} supabase records`);
  console.log(`\nRun with --apply to execute`);
} else {
  console.log(`\nApplying patches…`);
  const patches = withPatches.map(r => r.patch!);
  if (patches.length > 0) {
    await index.partialUpdateObjects(patches, { createIfNotExists: false });
    console.log(`Patched ${patches.length} records`);
  }

  console.log(`Deleting ${results.length} stale IDs…`);
  const toDelete = results.map(r => r.old.objectID);
  // Delete in batches of 1000
  for (let i = 0; i < toDelete.length; i += 1000) {
    await index.deleteObjects(toDelete.slice(i, i + 1000));
  }
  console.log(`Deleted ${toDelete.length} records`);
}
