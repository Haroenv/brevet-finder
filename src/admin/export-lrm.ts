import { parseString } from 'fast-csv';
import { DOMParser } from 'xmldom-qsa';
import { Brevet } from '../types';
import { numToDate, numToDateString, weirdDateToNum } from '../date';

type Raw = {
  Date: string;
  Country: string;
  'Start Location': string;
  Distance: string;
  'Event Name': string;
  Organizer: string;
  Time: string;
  Elevation: string;
  Notes: string;
  links?: {
    Distance?: string;
    'Event Name'?: string;
    Organizer?: string;
  };
};

// from: https://www.randonneursmondiaux.org/59-Calendrier.html
const GOOGLE_DOCS_URL = new URL(
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vRU8adejamxip0ue6pMMGgRjPDNrboJp6SWYlf_k7HmhLyXSjEIMqOetBS5MSiRHZ96r9K7nzgtU9uc/pubhtml?gid=1480200001&single=true'
);

async function fetchViaHtml() {
  const html = await fetch(GOOGLE_DOCS_URL).then((res) => res.text());
  const doc = new DOMParser().parseFromString(html, 'text/html');

  return Array.from(doc.querySelectorAll('table tr')).flatMap((row) => {
    const cells = Array.from(row.querySelectorAll('td'));
    if (cells.length === 0) return [];

    const [
      date,
      country,
      startLocation,
      distance,
      eventName,
      organizer,
      time,
      elevation,
      notes,
    ] = cells;

    if (
      eventName.textContent === '-' ||
      eventName.textContent === '' ||
      eventName.textContent === 'Event Name'
    ) {
      return [];
    }

    const output: Raw[] = [
      {
        Date: date.textContent!,
        Country: country.textContent!,
        'Start Location': startLocation.textContent!,
        Distance: distance.textContent!,
        'Event Name': eventName.textContent!,
        Organizer: organizer.textContent!,
        Time: time.textContent!,
        Elevation: elevation.textContent!,
        Notes: notes.textContent!,
        links: {
          Distance: resolveGoogleRedirect(
            distance.querySelector('a')?.getAttribute('href') || undefined
          ),
          'Event Name': resolveGoogleRedirect(
            eventName.querySelector('a')?.getAttribute('href') || undefined
          ),
          Organizer: resolveGoogleRedirect(
            organizer.querySelector('a')?.getAttribute('href') || undefined
          ),
        },
      },
    ];

    return output;
  });
}

// does not work because it does not have the links
async function fetchViaCsv() {
  const id = GOOGLE_DOCS_URL.pathname.split('/').at(-2);
  const url = `https://docs.google.com/spreadsheets/d/e/${id}/pub?output=csv`;

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}`);
  }

  const text = await res.text();
  const data: Raw[] = [];

  const parsing = Promise.withResolvers();
  parseString(text, { headers: true })
    .on('error', (error) => parsing.reject(error))
    .on('data', (row) => {
      if (row['Event Name'] === '-') return;
      data.push(row);
    })
    .on('end', () => parsing.resolve());

  await parsing.promise;

  return data;
}

function resolveGoogleRedirect(url: string | undefined) {
  if (!url) return undefined;
  const u = new URL(url);

  if (u.host === 'www.google.com' && u.pathname === '/url') {
    return u.searchParams.get('q') || url;
  }

  return url;
}

function cleanBrevets(brevets: Raw[]): Brevet[] {
  return brevets.map((brevet) => ({
    objectID: [
      numToDateString(weirdDateToNum(brevet.Date))
        .split('-')
        .reverse()
        .join('/'),
      brevet.Distance,
      brevet.Country,
      brevet['Start Location'],
    ].join('__'),
    date: numToDateString(weirdDateToNum(brevet.Date))
      .split('-')
      .reverse()
      .join('/'),
    dateNumber: weirdDateToNum(brevet.Date),
    distance:
      Math.floor(parseInt(brevet.Distance.replace(',', ''), 10) / 100) * 100 ||
      undefined,
    name: brevet['Event Name'],
    country: brevet.Country,
    region: '',
    department: '',
    city: brevet['Start Location'],
    _geoloc: [],
    map: [brevet.links?.Distance!].filter(Boolean),
    site: brevet.links?.['Event Name'] || '',
    mail: '',
    club: brevet.Organizer,
    ascent: parseInt(brevet.Elevation.replace(',', ''), 10),
    time: numToDate(weirdDateToNum(brevet.Date)).getTime() / 1000,
    status: '',
    meta: brevet,
  }));
}

export async function getData() {
  return cleanBrevets(await fetchViaHtml());
}
