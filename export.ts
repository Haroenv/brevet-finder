import { Client } from '@googlemaps/google-maps-services-js';
import algoliasearch from 'algoliasearch';
import type { Brevet } from './types';
import { Progress } from './progress';

const {
  GOOGLE_MAPS = '',
  SUPABASE = '',
  ALGOLIA_APP = '',
  ALGOLIA_WRITE = '',
} = process.env;

if (!GOOGLE_MAPS) {
  throw new Error('Missing GOOGLE_MAPS env variable');
}
if (!SUPABASE) {
  throw new Error('Missing SUPABASE env variable');
}
if (!ALGOLIA_APP) {
  throw new Error('Missing ALGOLIA_APP env variable');
}
if (!ALGOLIA_WRITE) {
  throw new Error('Missing ALGOLIA_WRITE env variable');
}

type FetchOutput = {
  Date: string;
  Distance: number;
  Pays: string;
  Region: string;
  Departement: string;
  Ville: string;
  RoadMap: string;
  SiteWeb: string;
  MailContact: string;
  NomClub: string;
  Denivele: number;
  TimeDate: number;
  Statut: string;
  Inscription: null | number;
};

type SupabaseOutput = {
  id: number;
  created_at: string;
  city: string;
  latitude: number;
  longitude: number;
  distance: number;
  date: string;
  codeClub: string;
  nomorganisateur: string;
  mailorganisateur: string;
  maplink: string;
  clubwebsite: string;
  idorga: number;
  denivele: string;
  country: string;
  status: string;
  nom: string;
  nomClub: string;
};

async function fetchBrevets(data: {
  from: string;
  to: string;
  distance?: string;
  country?: string;
  region?: string;
  department?: string;
}): Promise<FetchOutput[]> {
  const brevets = await fetch(
    'https://brevets.audax-club-parisien.com/controleur/api/brm_calendar.php',
    {
      body: new URLSearchParams({
        action: 'search',
        startdate: data.from,
        enddate: data.to,
        distance: data.distance || '',
        pays: data.country || '',
        region: data.region || '',
        departement: data.department || '',
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      method: 'POST',
      redirect: 'follow',
      referrer: 'https://www.audax-club-parisien.com/',
    }
  ).then((res) => res.json());

  if (!Array.isArray(brevets)) throw new Error('Invalid response');

  return brevets;
}

async function fetchBrevetsFromSupabase(): Promise<SupabaseOutput[]> {
  const apikey = SUPABASE;
  const brevets = await fetch(
    'https://svbtqggtspnhpbfbgswf.supabase.co/rest/v1/brevets?select=%2A',
    {
      headers: {
        apikey,
        Authorization: 'Bearer ' + apikey,
      },
      method: 'GET',
      referrer: 'https://map.audax-club-parisien.com/',
    }
  ).then((res) => res.json());

  if (!Array.isArray(brevets)) throw new Error('Invalid response');

  return brevets;
}

function cleanBrevets(brevets: FetchOutput[]): Brevet[] {
  return brevets.map((brevet) => ({
    objectID: [brevet.Date, brevet.Distance, brevet.Pays, brevet.Ville].join(
      '__'
    ),
    date: brevet.Date,
    dateNumber: parseInt(brevet.Date.split('/').reverse().join(''), 10),
    distance: brevet.Distance,
    country: brevet.Pays,
    region: brevet.Region,
    department: brevet.Departement,
    city: brevet.Ville,
    _geoloc: [],
    map: (brevet.RoadMap.indexOf(';') > -1
      ? brevet.RoadMap.split(';')
      : [brevet.RoadMap]
    )
      .map((map) => map.trim())
      .filter(Boolean),
    site: brevet.SiteWeb,
    mail: brevet.MailContact,
    club: brevet.NomClub,
    ascent: brevet.Denivele,
    time: brevet.TimeDate,
    status: brevet.Statut,
    meta: brevet,
  }));
}

function cleanBrevetsFromSupabase(brevets: SupabaseOutput[]): Brevet[] {
  return brevets.map((brevet) => ({
    objectID: 'supabase__' + brevet.id.toString(),
    date: brevet.date,
    dateNumber: parseInt(brevet.date.split('/').reverse().join(''), 10),
    distance: brevet.distance,
    country: brevet.country,
    region: brevet.nom,
    department: brevet.city,
    city: brevet.city,
    _geoloc: [{ lat: brevet.latitude, lng: brevet.longitude }],
    map: [brevet.maplink].filter(Boolean),
    site: brevet.clubwebsite,
    mail: brevet.mailorganisateur,
    club: brevet.nomClub,
    ascent: parseInt(brevet.denivele, 10),
    time: new Date(brevet.date.split('/').reverse().join('-')).getTime() / 1000,
    status: brevet.status,
    meta: brevet,
  }));
}

async function addAddress(brevets: Brevet[]) {
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

const client = new Client({});
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

await Bun.write(
  'brevets.json',
  JSON.stringify(
    await addAddress(
      [
        ...cleanBrevets(
          await fetchBrevets({
            from: '2023-01-01',
            to: '2026-01-01',
          })
        ),
        ...cleanBrevetsFromSupabase(await fetchBrevetsFromSupabase()),
      ].filter((brevet) => !allObjectIds.has(brevet.objectID))
    ),
    null,
    2
  )
);
