import algoliasearch from 'algoliasearch';

const ALGOLIA_APP = "1AWHE68HXJ";
const ALGOLIA_WRITE = "3f984ae147d9a001b43ecf96d8201138";

const client = algoliasearch(ALGOLIA_APP, ALGOLIA_WRITE);
const index = client.initIndex('brevets');

const allRecords: Array<{objectID: string, date?: string, distance?: number, country?: string, city?: string}> = [];

await index.browseObjects({
  attributesToRetrieve: ['objectID', 'date', 'distance', 'country', 'city'],
  batch: (objects: any[]) => {
    for (const obj of objects) {
      allRecords.push(obj);
    }
  }
});

console.log(`Total records in Algolia: ${allRecords.length}`);

const supabase = allRecords.filter(r => r.objectID.startsWith('supabase__'));
const other = allRecords.filter(r => !r.objectID.startsWith('supabase__'));

console.log(`Supabase records: ${supabase.length}`);
console.log(`Non-supabase records: ${other.length}`);

// Build a map from supabase records: date|distance|country|city -> objectID
const normalize = (v?: string) => (v || '').trim().toLowerCase();
const supabaseKeys = new Map<string, string>();
for (const r of supabase) {
  const key = [r.date, r.distance, normalize(r.country), normalize(r.city)].join('|');
  supabaseKeys.set(key, r.objectID);
}

// Find non-supabase records that have a matching supabase record
const dupes: Array<{old: string, new: string, key: string}> = [];
for (const r of other) {
  const key = [r.date, r.distance, normalize(r.country), normalize(r.city)].join('|');
  if (supabaseKeys.has(key)) {
    dupes.push({ old: r.objectID, new: supabaseKeys.get(key)!, key });
  }
}

console.log(`\nDuplicates found: ${dupes.length}`);

// Group by country
const byCountry = new Map<string, number>();
for (const d of dupes) {
  const country = d.key.split('|')[2] || 'unknown';
  byCountry.set(country, (byCountry.get(country) || 0) + 1);
}
const sorted = [...byCountry.entries()].sort((a, b) => b[1] - a[1]);
console.log('\nDuplicates by country:');
for (const [country, count] of sorted) {
  console.log(`  ${count}\t${country}`);
}

console.log('\nSample duplicates:');
for (const d of dupes.slice(0, 10)) {
  console.log(`  ${d.old}  →  ${d.new}  (${d.key})`);
}

await Bun.write('dupes.json', JSON.stringify(dupes, null, 2));
console.log(`\nFull list written to dupes.json`);
