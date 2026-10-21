import { Brevet } from '../types';
import { checkOk } from './fetch-utils';
import { countByKey, makeCollisionSafeObjectID } from './id-utils';

// https://randonneurs.be/api/docs (OpenAPI: /api/v1/openapi.json)
type Raw = {
  id: number;
  name: string;
  type: string;
  distance: number | null;
  date: string | null;
  start_time: string | null;
  start_place: string;
  postal_code: string | null;
  elevation: number | null;
  cancelled: boolean;
  registration_url: string | null;
  registration_deadline: string | null;
  gpx_url: string | null;
  gpx_segmented_url: string | null;
  url: string;
};

// A season runs Nov–Oct and is named after its end year.
const FIRST_SEASON = 2024;

async function fetchBrevets(): Promise<Raw[]> {
  const lastSeason = new Date().getFullYear() + 2;
  const season = Array.from(
    { length: lastSeason - FIRST_SEASON + 1 },
    (_, i) => FIRST_SEASON + i
  );

  const url = new URL('https://randonneurs.be/api/v1/rides');
  url.search = new URLSearchParams({
    season: season.join(','),
    lang: 'en',
    client: 'brm-search',
  }).toString();

  const { rides }: { rides: Raw[] } = await fetch(url, {
    headers: { Accept: 'application/json' },
  })
    .then(checkOk)
    .then((res) => res.json());

  // The API returns at most 1000 rides per answer.
  if (rides.length >= 1000) {
    throw new Error('Belgium API answer is truncated, fetch per season');
  }

  return rides;
}

function cleanBrevets(brevets: Raw[]): Brevet[] {
  const prepared = brevets
    .filter((brevet) => brevet.date)
    .map((brevet) => {
      const distance = brevet.distance || 0;
      const country = 'Belgium';
      const city = brevet.start_place;
      const [year, month, day] = brevet.date!.split('-');
      const date = [day, month, year].join('/');
      const dateNumber = parseInt([year, month, day].join(''), 10);
      const baseObjectID = [date, distance, country, city.toLowerCase()].join(
        '__'
      );

      return { brevet, distance, country, city, date, dateNumber, baseObjectID };
    });

  const counts = countByKey(prepared.map((x) => x.baseObjectID));

  return prepared.map(
    ({ brevet, distance, country, city, date, dateNumber, baseObjectID }) => ({
      objectID: makeCollisionSafeObjectID(
        baseObjectID,
        counts,
        [brevet.name, brevet.id].join('|')
      ),
      date,
      dateNumber,
      name: brevet.name,
      distance,
      country,
      city,
      map: [brevet.gpx_url].filter((x): x is string => !!x),
      site: brevet.url,
      club: '',
      time: 0,
      ascent: brevet.elevation || 0,
      status: brevet.cancelled ? 'cancelled' : undefined,
      meta: brevet,
    })
  );
}

export async function getData() {
  console.log('Fetching Belgium brevets...');
  return cleanBrevets(await fetchBrevets());
}
