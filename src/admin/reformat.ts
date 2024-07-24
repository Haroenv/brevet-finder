import { Brevet } from '../types';
import { cleanRegion } from './clean-utils';
import algoliasearch from 'algoliasearch';

const { ALGOLIA_APP = '', ALGOLIA_WRITE = '' } = process.env;
if (!ALGOLIA_APP) {
  throw new Error('Missing ALGOLIA_APP env variable');
}
if (!ALGOLIA_WRITE) {
  throw new Error('Missing ALGOLIA_WRITE env variable');
}

const FROM_INDEX = false;
let data: Brevet[] = [];

if (FROM_INDEX) {
  const client = algoliasearch(ALGOLIA_APP!, ALGOLIA_WRITE!);
  await client.initIndex('brevets').browseObjects<Brevet>({
    batch: (objects) => {
      objects.forEach((object) => {
        data.push(object);
      });
    },
  });
} else {
  data = (await Bun.file('brevets.json').json()) as Brevet[];
}

const newData = data.map(({ ...rest }) => ({
  ...rest,
}));

Bun.write('brevets.json', JSON.stringify(newData, null, 2));

console.log(`Cleaned ${data.length} brevets into ${newData.length} brevets`);
