import { dateToNum } from '../date';
import { Brevet } from '../types';
import { checkOk } from './fetch-utils';

type Raw = {
  contact: { email: string; name: string };
  distance: number;
  entryFee: number;
  from: {
    Country: 'NL';
    address: string;
    city: string;
    region: string;
    title: string;
  };
  start: `2025-01-25T09:00:00Z[UTC]`;
  title: string;
  url: string;
};

async function fetchBrevets(): Promise<Raw[]> {
  const url = new URL('https://randonneurs.nl/api/v1/events');
  url.search = new URLSearchParams({
    from: new Date().toISOString().split('T')[0],
    until: '2027-01-01',
  }).toString();

  const events: Raw[] = await fetch(url)
    .then(checkOk)
    .then((res) => res.json());

  return events;
}

function cleanBrevets(brevets: Raw[]): Brevet[] {
  return brevets.map((brevet) => {
    const date = brevet.start.split('T')[0].split('-').reverse().join('/');
    const dateNumber = dateToNum(new Date(brevet.start.split('T')[0]));
    const distance = brevet.distance;
    const country = 'The Netherlands';
    const city = brevet.from.city;
    const title = brevet.title;
    const mail = brevet.contact.email;
    const club = 'Randonneurs NL';

    // Extract stable numeric ID from event URL, e.g. "https://randonneurs.nl/nl/event/653/BRM-..."
    const urlIdMatch = brevet.url.match(/\/event\/(\d+)\//);
    const urlId = urlIdMatch ? urlIdMatch[1] : brevet.url.replace(/^https?:\/\//, '').replace(/\/$/, '');

    return {
      objectID: 'nl__' + urlId,
      date,
      dateNumber,
      name: title,
      distance,
      country,
      city,
      site: brevet.url,
      mail,
      club,
      time: 0,
      ascent: 0,
      meta: brevet,
    };
  });
}

export async function getData() {
  console.log('Fetching Netherlands brevets...');
  return cleanBrevets(await fetchBrevets());
}
