import { Client } from '@googlemaps/google-maps-services-js';
import { Progress } from './progress';
import { Brevet } from '../types';
import PlaceKit from '@placekit/client-js';

const { PLACEKIT = '' } = process.env;
if (!PLACEKIT) {
  throw new Error('Missing PLACEKIT env variable');
}

const pk = PlaceKit(PLACEKIT);

export async function addGeoloc(brevets: Brevet[]) {
  const progress = new Progress(brevets.length);

  for await (const [index, brevet] of brevets.entries()) {
    progress.update(index);
    if (brevet._geoloc?.[0]) continue;

    const address = [
      brevet.city,
      brevet.department,
      brevet.region,
      brevet.country,
    ]
      .filter(Boolean)
      .join(', ');

    const out = await pk.search(address, {
      maxResults: 1,
      types: ['city'],
    });

    const result = out.results[0] || {};
    const location = {
      lat: result.lat!,
      lng: result.lng!,
    };

    if (location.lat && location.lng) {
      brevet._geoloc = [location];
    }
  }

  return brevets;
}
