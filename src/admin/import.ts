import algoliasearch from 'algoliasearch';
import type { Brevet } from '../types';

const {
  ALGOLIA_APP = '',
  ALGOLIA_WRITE = '',
  GITHUB_STEP_SUMMARY = '',
} = process.env;
if (!ALGOLIA_APP) {
  throw new Error('Missing ALGOLIA_APP env variable');
}
if (!ALGOLIA_WRITE) {
  throw new Error('Missing ALGOLIA_WRITE env variable');
}

const data = (await Bun.file('brevets.json').json()) as Brevet[];

const client = algoliasearch(ALGOLIA_APP, ALGOLIA_WRITE);

await client.initIndex('brevets').saveObjects(data);

if (GITHUB_STEP_SUMMARY) {
  Bun.write(GITHUB_STEP_SUMMARY, `Indexed ${data.length} brevets`);
} else {
  console.log(`Indexed ${data.length} brevets`);
}
