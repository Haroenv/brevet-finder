import { Client } from '@googlemaps/google-maps-services-js';
import { Progress } from './progress';
import { Brevet } from '../types';

const { GOOGLE_MAPS = '' } = process.env;
if (!GOOGLE_MAPS) {
  throw new Error('Missing GOOGLE_MAPS env variable');
}

const client = new Client({});

export async function addGeoloc(brevets: Brevet[]) {
  const progress = new Progress(brevets.length);

  for await (const [index, brevet] of brevets.entries()) {
    progress.update(index);
    if (brevet._geoloc[0]) continue;

    const address = [
      brevet.city,
      brevet.department,
      brevet.region,
      brevet.country,
    ]
      .filter(Boolean)
      .join(', ');

    const out = await client.geocode({
      params: {
        address,
        key: GOOGLE_MAPS,
      },
    });

    const location = out?.data?.results?.[0]?.geometry?.location;
    if (location.lat && location.lng) {
      brevet._geoloc = [location];
    }
  }

  return brevets;
}
