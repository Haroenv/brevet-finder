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

const flags = {
  acp: true,
  map: true,
  lrm: true,
  usa: true,
  auk: true,
  ireland: true,
  italy: true,
  belgium: true,
  netherlands: true,
  geocode: false,
  filter: true,
};

const { ALGOLIA_APP = '', ALGOLIA_WRITE = '' } = process.env;
if (!ALGOLIA_APP && flags.filter) {
  throw new Error('Missing ALGOLIA_APP env variable');
}
if (!ALGOLIA_WRITE && flags.filter) {
  throw new Error('Missing ALGOLIA_WRITE env variable');
}

const searchClient = algoliasearch(ALGOLIA_APP, ALGOLIA_WRITE);
const allObjectIds = new Set<string>();
if (flags.filter) {
  await searchClient.initIndex('brevets').browseObjects({
    attributesToRetrieve: ['objectID'],
    batch: (objects) => {
      objects.forEach((object) => {
        allObjectIds.add(object.objectID);
      });
    },
  });
}

const data = [
  ...(flags.acp ? await acp.getData() : []),
  ...(flags.map ? await map.getData() : []),
  ...(flags.lrm ? await lrm.getData() : []),
  ...(flags.usa ? await usa.getData() : []),
  ...(flags.auk ? await auk.getData() : []),
  ...(flags.ireland ? await ireland.getData() : []),
  ...(flags.italy ? await italy.getData() : []),
  ...(flags.belgium ? await belgium.getData() : []),
  ...(flags.netherlands ? await netherlands.getData() : []),
];

const newObjects = flags.filter
  ? data.filter((brevet) => !allObjectIds.has(brevet.objectID))
  : data;
const existingObjects = flags.filter
  ? data.filter((brevet) => allObjectIds.has(brevet.objectID))
  : data;

const withGeoLoc = flags.geocode ? await addGeoloc(newObjects) : newObjects;
const withoutGeoLoc = existingObjects.filter((brevet) =>
  allObjectIds.has(brevet.objectID)
);

const objects = [...withGeoLoc, ...withoutGeoLoc];

await Bun.write('brevets.json', JSON.stringify(objects, null, 2));

console.log(`Exported ${objects.length} brevets`);
