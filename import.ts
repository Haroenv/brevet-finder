import algoliasearch from 'algoliasearch';
import type { Brevet } from './types';

const { ALGOLIA_APP = '', ALGOLIA_WRITE = '' } = process.env;
if (!ALGOLIA_APP) {
  throw new Error('Missing ALGOLIA_APP env variable');
}
if (!ALGOLIA_WRITE) {
  throw new Error('Missing ALGOLIA_WRITE env variable');
}

const data = (await Bun.file('brevets.json').json()) as Brevet[];

const client = algoliasearch(ALGOLIA_APP, ALGOLIA_WRITE);

client.initIndex('brevets').saveObjects(data);
