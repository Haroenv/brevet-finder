import algoliasearch from 'algoliasearch';
import { addGeoloc } from './geocode';
import * as acp from './export-acp';
import * as map from './export-map';
import * as lrm from './export-lrm';
import * as usa from './export-usa';
import * as auk from './export-auk';
import * as ireland from './export-ireland';
import * as italy from './export-italy';
import * as belgium from './export-belgium';
import * as netherlands from './export-netherlands';
import { Brevet } from '../types';

const { ALGOLIA_APP = '', ALGOLIA_WRITE = '', SKIP_INDEX = "" } = process.env;
if (!ALGOLIA_APP && !SKIP_INDEX) {
  throw new Error('Missing ALGOLIA_APP env variable');
}
if (!ALGOLIA_WRITE && !SKIP_INDEX) {
  throw new Error('Missing ALGOLIA_WRITE env variable');
}

const errors: Array<{ source: string; error: unknown }> = [];

const sources = [
  { name: 'acp', pkg: acp },
  { name: 'map', pkg: map },
  { name: 'lrm', pkg: lrm },
  { name: 'usa', pkg: usa },
  { name: 'auk', pkg: auk },
  { name: 'ireland', pkg: ireland },
  { name: 'italy', pkg: italy },
  { name: 'belgium', pkg: belgium },
  { name: 'netherlands', pkg: netherlands },
];

async function fetchAllData() {
  const results = await Promise.all(
    sources.map(async ({ name, pkg }) => {
      try {
        return await pkg.getData();
      } catch (error) {
        console.error(`Error fetching data from ${name}:`, error);
        errors.push({ source: name, error });
        return [];
      }
    })
  );
  return results.flat();
}

async function getExistingData() {
  const existingObjectIDs = new Set<string>();
  const existingGeo = new Map<string, { lat: number; lng: number }>();

  if (SKIP_INDEX) {
    console.warn('SKIP_INDEX is set, skipping fetching existing data from Algolia');
    return { existingObjectIDs, existingGeo };
  }

  const client = algoliasearch(ALGOLIA_APP, ALGOLIA_WRITE);
  await client.initIndex('brevets').browseObjects({
    attributesToRetrieve: ['objectID', '_geoloc'],
    batch: (objects) => {
      objects.forEach((object) => {
        existingObjectIDs.add(object.objectID);
        const geoLoc = (object as any)._geoloc?.[0];
        if (geoLoc?.lat && geoLoc?.lng) {
          existingGeo.set(object.objectID, geoLoc);
        }
      });
    },
  });

  return { existingObjectIDs, existingGeo };
}

function inheritGeoloc(brevet: Brevet, existingGeo: Map<string, any>) {
  if (brevet._geoloc?.[0]) return brevet;

  const geoLoc = existingGeo.get(brevet.objectID);
  return geoLoc ? { ...brevet, _geoloc: [geoLoc] } : brevet;
}

function normalize(value?: string) {
  return (value || '').trim().toLowerCase();
}

/**
 * Match key for identifying the same real-world event across sources.
 * Uses date + distance + country + city.
 */
function eventKey(b: Brevet) {
  return [
    b.date,
    b.distance,
    normalize(b.country),
    normalize(b.city),
  ].join('|');
}

/**
 * More permissive key that ignores city. Used only as a fallback for sparse records.
 */
function eventKeyNoCity(b: Brevet) {
  return [b.date, b.distance, normalize(b.country)].join('|');
}

/**
 * Merge two brevet records into one. `base` is the higher-priority record
 * (supabase), `other` is the enrichment source (scraper).
 *
 * Rules:
 * - Keep base's objectID (supabase canonical ID wins)
 * - Prefer non-empty values from base; fall back to other
 * - `map`: union of both arrays (deduplicated)
 * - `ascent`: prefer other only if > 0 and base has none
 * - `_geoloc`: prefer base if present, then other
 */
function mergeBrevets(base: Brevet, other: Brevet): Brevet {
  return {
    ...base,
    // Fields where scraper data can enrich supabase
    map: [
      ...new Set([...(base.map ?? []), ...(other.map ?? [])]),
    ],
    site: base.site || other.site || undefined,
    mail: base.mail || other.mail || undefined,
    ascent: (base.ascent ?? (other.ascent && other.ascent > 0 ? other.ascent : undefined)),
    region: base.region || other.region || undefined,
    department: base.department || other.department || undefined,
    city: base.city || other.city || '',
    _geoloc: base._geoloc?.length ? base._geoloc : other._geoloc,
  };
}

/**
 * Conservative merge guard: we only merge when confidence is high.
 * Better keep duplicates than merge unrelated events.
 */
function canSafelyMerge(base: Brevet, other: Brevet): boolean {
  if (
    base.date !== other.date ||
    base.distance !== other.distance ||
    normalize(base.country) !== normalize(other.country)
  ) {
    return false;
  }

  const baseCity = normalize(base.city);
  const otherCity = normalize(other.city);

  // If both cities are present, they must match exactly.
  if (baseCity && otherCity) {
    if (baseCity !== otherCity) return false;
    return true;
  }

  // Sparse rows (missing city): only merge if we also have a strong identifier.
  const baseMail = normalize(base.mail);
  const otherMail = normalize(other.mail);
  if (baseMail && otherMail && baseMail === otherMail) return true;

  const baseClub = normalize(base.club);
  const otherClub = normalize(other.club);
  if (baseClub && otherClub && baseClub === otherClub) return true;

  return false;
}

function chooseBestCandidate(base: Brevet, candidates: Brevet[]): Brevet | null {
  const safe = candidates.filter((c) => canSafelyMerge(base, c));
  if (safe.length === 1) return safe[0];
  if (safe.length === 0) return null;

  // Ambiguous: try exact mail disambiguation
  const byMail = safe.filter(
    (c) => normalize(c.mail) && normalize(c.mail) === normalize(base.mail)
  );
  if (byMail.length === 1) return byMail[0];

  // Ambiguous: try exact club disambiguation
  const byClub = safe.filter(
    (c) => normalize(c.club) && normalize(c.club) === normalize(base.club)
  );
  if (byClub.length === 1) return byClub[0];

  // Still ambiguous: do not merge.
  return null;
}

/**
 * Deduplicate and merge records from multiple sources.
 * - Keep all events.
 * - Supabase records are canonical when a merge is confident.
 * - If matching is ambiguous, keep both records.
 * - Collapse exact objectID duplicates only.
 */
function mergeRecords(records: Brevet[]): Brevet[] {
  // 1) Remove exact duplicate objectIDs first.
  const uniqueByObjectID = new Map<string, Brevet>();
  for (const b of records) {
    if (!uniqueByObjectID.has(b.objectID)) {
      uniqueByObjectID.set(b.objectID, b);
    }
  }

  const uniqueRecords = [...uniqueByObjectID.values()];
  const supabase = uniqueRecords.filter((b) => b.objectID.startsWith('supabase__'));
  const other = uniqueRecords.filter((b) => !b.objectID.startsWith('supabase__'));

  const otherByFullKey = new Map<string, Brevet[]>();
  const otherByNoCityKey = new Map<string, Brevet[]>();
  for (const b of other) {
    const full = eventKey(b);
    if (!otherByFullKey.has(full)) otherByFullKey.set(full, []);
    otherByFullKey.get(full)!.push(b);

    const noCity = eventKeyNoCity(b);
    if (!otherByNoCityKey.has(noCity)) otherByNoCityKey.set(noCity, []);
    otherByNoCityKey.get(noCity)!.push(b);
  }

  const consumedOther = new Set<string>();
  const mergedSupabase: Brevet[] = [];

  for (const b of supabase) {
    let result = b;

    // Primary: full key match (date+distance+country+city)
    const fullCandidates = (otherByFullKey.get(eventKey(b)) || []).filter(
      (x) => !consumedOther.has(x.objectID)
    );
    const bestFull = chooseBestCandidate(b, fullCandidates);
    if (bestFull) {
      result = mergeBrevets(result, bestFull);
      consumedOther.add(bestFull.objectID);
    }

    // Fallback for sparse rows (missing city): use no-city key, but still strict guard.
    if (!normalize(result.city)) {
      const sparseCandidates = (otherByNoCityKey.get(eventKeyNoCity(b)) || []).filter(
        (x) => !consumedOther.has(x.objectID)
      );
      const bestSparse = chooseBestCandidate(b, sparseCandidates);
      if (bestSparse) {
        result = mergeBrevets(result, bestSparse);
        consumedOther.add(bestSparse.objectID);
      }
    }

    mergedSupabase.push(result);
  }

  const unmergedOther = other.filter((b) => !consumedOther.has(b.objectID));
  const merged = [...mergedSupabase, ...unmergedOther];

  return merged;
}

const data = await fetchAllData();
const mergedData = mergeRecords(data);
console.log(
  `Merged ${data.length} records → ${mergedData.length} (removed ${data.length - mergedData.length} duplicates)`
);
const { existingObjectIDs, existingGeo } = await getExistingData();

const newBrevets = mergedData.filter((b) => !existingObjectIDs.has(b.objectID));
const existingBrevets = mergedData
  .filter((b) => existingObjectIDs.has(b.objectID))
  .map((b) => inheritGeoloc(b, existingGeo));

const needsGeocoding = [
  ...newBrevets,
  ...existingBrevets.filter((b) => !b._geoloc?.[0]),
];
const geocoded = await addGeoloc(needsGeocoding);

const allBrevets = [
  ...geocoded,
  ...existingBrevets.filter((b) => b._geoloc?.[0]),
];

await Bun.write('brevets.json', JSON.stringify(allBrevets, null, 2));
console.log(`Exported ${allBrevets.length} brevets`);

if (errors.length > 0) {
  console.error('\n❌ Errors occurred during data export:');
  errors.forEach(({ source, error }) => {
    console.error(`  - ${source}: ${error instanceof Error ? error.message : String(error)}`);
  });
  process.exit(1);
}
