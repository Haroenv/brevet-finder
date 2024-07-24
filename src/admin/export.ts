import algoliasearch from 'algoliasearch';
import { addGeoloc } from './geocode';
import * as acp from './export-acp';
import * as map from './export-map';
import * as lrm from './export-lrm';
import * as usa from './export-usa';

const { ALGOLIA_APP = '', ALGOLIA_WRITE = '' } = process.env;
if (!ALGOLIA_APP) {
  throw new Error('Missing ALGOLIA_APP env variable');
}
if (!ALGOLIA_WRITE) {
  throw new Error('Missing ALGOLIA_WRITE env variable');
}

const searchClient = algoliasearch(ALGOLIA_APP, ALGOLIA_WRITE);
const allObjectIds = new Set<string>();
await searchClient.initIndex('brevets').browseObjects({
  attributesToRetrieve: ['objectID'],
  batch: (objects) => {
    objects.forEach((object) => {
      allObjectIds.add(object.objectID);
    });
  },
});

const flags = {
  acp: true,
  map: true,
  lrm: true,
  usa: true,
  geocode: true,
  filter: true,
};

const data = [
  ...(flags.acp ? await acp.getData() : []),
  ...(flags.map ? await map.getData() : []),
  ...(flags.lrm ? await lrm.getData() : []),
  ...(flags.usa ? await usa.getData() : []),
];

const filtered = flags.filter
  ? data.filter((brevet) => !allObjectIds.has(brevet.objectID))
  : data;

const objects = flags.geocode ? await addGeoloc(filtered) : filtered;

await Bun.write('brevets.json', JSON.stringify(objects, null, 2));

console.log(`Exported ${objects.length} brevets`);
