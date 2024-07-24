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
  query: '',
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
};

const data = [
  ...(flags.acp ? await acp.getData() : []),
  ...(flags.map ? await map.getData() : []),
  ...(flags.lrm ? await lrm.getData() : []),
  ...(flags.usa ? await usa.getData() : []),
].filter((brevet) => !allObjectIds.has(brevet.objectID));

await Bun.write(
  'brevets.json',
  JSON.stringify(flags.geocode ? await addGeoloc(data) : data, null, 2)
);
