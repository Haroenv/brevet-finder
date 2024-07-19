import algoliasearch from 'algoliasearch';
import { parseString } from 'fast-csv';
import { DOMParser } from 'xmldom-qsa';
import { Brevet } from './types';
import { addAddress } from './geocode';

const { ALGOLIA_APP = '', ALGOLIA_WRITE = '' } = process.env;
if (!ALGOLIA_APP) {
  throw new Error('Missing ALGOLIA_APP env variable');
}
if (!ALGOLIA_WRITE) {
  throw new Error('Missing ALGOLIA_WRITE env variable');
}

type SheetOutput = {
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

    const output: SheetOutput[] = [
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
  const data: SheetOutput[] = [];

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

const thisYear = new Date().getFullYear();
function weirdDateToNum(date: string) {
  const [year = thisYear, monthStr = 'Jan', day = '01'] = date
    .split('/')
    .reverse();

  const month = (
    [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ].indexOf(monthStr) + 1
  ).toString();

  return parseInt(
    [year, month.padStart(2, '0'), day.padStart(2, '0')].join(''),
    10
  );
}

function numToDateString(num: number) {
  const date = num.toString();
  return `${date.slice(0, 4)}-${date.slice(4, 6).padStart(2, '0')}-${date
    .slice(6, 8)
    .padStart(2, '0')}`;
}

function numToDate(num: number) {
  return new Date(numToDateString(num));
}

function cleanBrevets(brevets: SheetOutput[]): Brevet[] {
  return brevets.map((brevet) => ({
    objectID: [
      numToDateString(weirdDateToNum(brevet.Date)).replaceAll('-', '/'),
      brevet.Distance,
      brevet.Country,
      brevet['Start Location'],
    ].join('__'),
    date: numToDateString(weirdDateToNum(brevet.Date)).replaceAll('-', '/'),
    dateNumber: weirdDateToNum(brevet.Date),
    distance: parseInt(brevet.Distance.replace(',', ''), 10),
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
      [...cleanBrevets(await fetchViaHtml())].filter(
        (brevet) => !allObjectIds.has(brevet.objectID)
      )
    ),
    null,
    2
  )
);
