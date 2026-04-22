import { numToDate } from '../date';
import { Brevet } from '../types';
import { getCategory } from './clean-utils';
import { checkOk } from './fetch-utils';

const { SUPABASE = '' } = process.env;
if (!SUPABASE) {
  throw new Error('Missing SUPABASE env variable');
}

type Raw = {
  // current schema
  nom_organisateur?: string | null;
  mail_organisateur?: string | null;
  distance_brevet?: number | null;
  date_brevet?: string | null;
  denivele?: string | number | null;
  ville_depart?: string | null;
  departement?: string | null;
  region?: string | null;
  lien_itineraire_brm?: string | null;
  nom_brm?: string | null;
  pays?: string | null;
  club_id?: string | null;

  // legacy schema
  id: number;
  created_at?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  distance?: number;
  date?: string;
  codeClub?: string;
  nomorganisateur?: string;
  mailorganisateur?: string;
  maplink?: string;
  clubwebsite?: string;
  idorga?: number;
  country?: string;
  status?: string;
  nom?: string;
  nomClub?: string;
};

async function fetchBrevets(): Promise<Raw[]> {
  const apikey = SUPABASE;
  const pageSize = 1000;
  const all: Raw[] = [];

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const brevets = await fetch(
      'https://ranqsfwmoexghudpvpob.supabase.co/rest/v1/brevets?select=%2A',
      {
        headers: {
          apikey,
          Authorization: 'Bearer ' + apikey,
          Range: `${from}-${to}`,
        },
        method: 'GET',
        referrer: 'https://map.audax-club-parisien.com/',
      }
    )
      .then(checkOk)
      .then((res) => res.json());

    if (!Array.isArray(brevets)) throw new Error('Invalid response');

    all.push(...brevets);

    if (brevets.length < pageSize) {
      break;
    }
  }

  return all;
}

function cleanBrevets(brevets: Raw[]): Brevet[] {
  return brevets.map((brevet) => {
    const rawDate = brevet.date_brevet || brevet.date || '';
    const dateNumber = rawDate.includes('-')
      ? parseInt(rawDate.replaceAll('-', ''), 10)
      : parseInt(rawDate.split('/').reverse().join(''), 10);
    const date = rawDate.includes('-')
      ? rawDate.split('-').reverse().join('/')
      : rawDate;
    const distance = brevet.distance_brevet ?? brevet.distance ?? undefined;
    const country = brevet.pays || brevet.country || '';
    const city = brevet.ville_depart || brevet.city || '';
    const time = numToDate(dateNumber).getTime() / 1000;

    return {
      objectID: 'supabase__' + brevet.id.toString(),
      date,
      dateNumber,
      distance,
      category: getCategory(distance),
      country,
      region: brevet.region || brevet.nom || undefined,
      department: brevet.departement || undefined,
      city,
      name: brevet.nom_brm || undefined,
      _geoloc:
        brevet.latitude && brevet.longitude
          ? [{ lat: brevet.latitude, lng: brevet.longitude }]
          : [],
      map: [brevet.lien_itineraire_brm || brevet.maplink].filter(
        (x): x is string => Boolean(x)
      ),
      site: brevet.clubwebsite,
      mail: brevet.mail_organisateur || brevet.mailorganisateur,
      club: brevet.club_id || brevet.nom_organisateur || brevet.nomClub || '',
      ascent:
        typeof brevet.denivele === 'number'
          ? brevet.denivele
          : parseInt((brevet.denivele || '').toString(), 10) || undefined,
      time,
      status: brevet.status,
      meta: brevet,
    };
  });
}

export async function getData() {
  console.log('Fetching Supabase brevets...');
  return cleanBrevets(await fetchBrevets());
}
