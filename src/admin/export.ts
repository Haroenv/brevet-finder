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

const data = await fetchAllData();
const { existingObjectIDs, existingGeo } = await getExistingData();

const newBrevets = data.filter((b) => !existingObjectIDs.has(b.objectID));
const existingBrevets = data
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
