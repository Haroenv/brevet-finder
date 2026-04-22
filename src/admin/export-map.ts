import { numToDate } from '../date';
import { Brevet } from '../types';
import { checkOk } from './fetch-utils';

const { SUPABASE = '' } = process.env;
if (!SUPABASE) {
  throw new Error('Missing SUPABASE env variable');
}

type Raw = {
  id: number;
  created_at?: string;
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
  latitude?: number;
  longitude?: number;
  clubwebsite?: string;
  status?: string;
};

type RawClub = {
  code_acp: string;
  nom_club: string;
  pays: string;
  page_web_club?: string | null;
};

async function fetchClubs(): Promise<Map<string, RawClub>> {
  const apikey = SUPABASE;
  const clubs = await fetch(
    'https://ranqsfwmoexghudpvpob.supabase.co/rest/v1/clubs?select=%2A',
    {
      headers: {
        apikey,
        Authorization: 'Bearer ' + apikey,
      },
      method: 'GET',
    }
  )
    .then(checkOk)
    .then((res) => res.json() as Promise<RawClub[]>);

  return new Map(clubs.map((c) => [c.code_acp, c]));
}

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

function cleanBrevets(brevets: Raw[], clubs: Map<string, RawClub>): Brevet[] {
  return brevets.map((brevet) => {
    const clubData = brevet.club_id ? clubs.get(brevet.club_id) : undefined;
    const rawDate = brevet.date_brevet || '';
    const dateNumber = rawDate.includes('-')
      ? parseInt(rawDate.replaceAll('-', ''), 10)
      : parseInt(rawDate.split('/').reverse().join(''), 10);
    const date = rawDate.includes('-')
      ? rawDate.split('-').reverse().join('/')
      : rawDate;
    const distance = brevet.distance_brevet ?? undefined;
    const country = brevet.pays || '';
    const city = brevet.ville_depart || '';
    const time = numToDate(dateNumber).getTime() / 1000;

    return {
      objectID: 'supabase__' + brevet.id.toString(),
      date,
      dateNumber,
      distance,
      country,
      region: brevet.region || undefined,
      department: brevet.departement || undefined,
      city,
      name: brevet.nom_brm || undefined,
      _geoloc:
        brevet.latitude && brevet.longitude
          ? [{ lat: brevet.latitude, lng: brevet.longitude }]
          : [],
      map: [brevet.lien_itineraire_brm].filter(
        (x): x is string => Boolean(x)
      ),
      site: clubData?.page_web_club || brevet.clubwebsite || undefined,
      mail: brevet.mail_organisateur ?? undefined,
      club: clubData?.nom_club || brevet.nom_organisateur || brevet.club_id || '',
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
  const [brevets, clubs] = await Promise.all([fetchBrevets(), fetchClubs()]);
  return cleanBrevets(brevets, clubs);
}
