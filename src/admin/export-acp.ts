import { Brevet } from '../types';
import { cleanCountry, cleanRegion } from './clean-utils';
import { checkOk } from './fetch-utils';
import { countByKey, makeCollisionSafeObjectID } from './id-utils';

type Raw = {
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

async function fetchBrevets(data: {
  from: string;
  to: string;
  distance?: string;
  country?: string;
  region?: string;
  department?: string;
}): Promise<Raw[]> {
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
  )
    .then(checkOk)
    .then((res) => res.json());

  if (!Array.isArray(brevets)) throw new Error('Invalid response');

  return brevets;
}

function cleanDate(date: string): string {
  let [day, month, year] = date.split('/');

  if (parseInt(month, 10) > 12) {
    [day, month] = [month, day];
  }

  return [day, month, year].join('/');
}

function makeBaseObjectID(date: string, distance: number, country: string, city: string) {
  return [date, distance, country, city].join('__');
}

function cleanBrevets(brevets: Raw[]): Brevet[] {
  const prepared = brevets.map((brevet) => {
    const country = cleanCountry(brevet.Pays);
    const date = cleanDate(brevet.Date);
    const dateNumber = parseInt(date.split('/').reverse().join(''), 10);
    const distance = Math.floor(brevet.Distance / 100) * 100;
    const city = brevet.Ville;
    const region = cleanRegion(country, brevet.Region);

    const baseObjectID = makeBaseObjectID(date, distance, country, city);

    return {
      brevet,
      country,
      date,
      dateNumber,
      distance,
      city,
      region,
      baseObjectID,
    };
  });

  const baseCounts = countByKey(prepared.map((x) => x.baseObjectID));

  return prepared.map(
    ({
      brevet,
      country,
      date,
      dateNumber,
      distance,
      city,
      region,
      baseObjectID,
    }) => {
      const objectID = makeCollisionSafeObjectID(
        baseObjectID,
        baseCounts,
        [
          brevet.NomClub || '',
          brevet.MailContact || '',
          brevet.SiteWeb || '',
          brevet.Region || '',
          brevet.Departement || '',
        ].join('|')
      );

      return {
        objectID,
        date,
        dateNumber,
        distance,
        country,
        region,
        department: brevet.Departement,
        city,
        map: brevet.RoadMap.split(/[;\n]|,\s+|\+/)
          .map((map) => map.trim())
          .filter((map) => map && map !== '+'),
        site: brevet.SiteWeb?.trim(),
        mail: brevet.MailContact,
        club: brevet.NomClub,
        ascent: brevet.Denivele,
        time: brevet.TimeDate,
        status: brevet.Statut,
        meta: brevet,
      };
    }
  );
}

export async function getData() {
  console.log('Fetching ACP brevets...');
  return cleanBrevets(
    await fetchBrevets({
      from: '2024-12-01',
      to: '2026-12-01',
    })
  );
}
