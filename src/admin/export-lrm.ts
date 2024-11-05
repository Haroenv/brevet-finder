import { parseString } from 'fast-csv';
import * as cheerio from 'cheerio';
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
  const $ = cheerio.load(html);

  return Array.from($('table tr')).flatMap((row) => {
    const cells = Array.from($(row).find('td'));
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
      $(eventName).text() === '-' ||
      $(eventName).text() === '' ||
      $(eventName).text() === 'Event Name'
    ) {
      return [];
    }

    const output: Raw[] = [
      {
        Date: $(date).text(),
        Country: $(country).text(),
        'Start Location': $(startLocation).text(),
        Distance: $(distance).text(),
        'Event Name': $(eventName).text(),
        Organizer: $(organizer).text(),
        Time: $(time).text(),
        Elevation: $(elevation).text(),
        Notes: $(notes).text(),
        links: {
          Distance: resolveGoogleRedirect(
            $(distance).find('a')?.attr('href') || undefined
          ),
          'Event Name': resolveGoogleRedirect(
            $(eventName).find('a')?.attr('href') || undefined
          ),
          Organizer: resolveGoogleRedirect(
            $(organizer).find('a')?.attr('href') || undefined
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
  return brevets.map((brevet) => {
    const distance =
      Math.floor(parseInt(brevet.Distance.replace(',', ''), 10) / 100) * 100 ||
      undefined;
    const dateNumber = weirdDateToNum(brevet.Date);
    const date = numToDateString(dateNumber).split('-').reverse().join('/');
    const time = numToDate(dateNumber).getTime() / 1000;

    return {
      objectID: [date, distance, brevet.Country, brevet['Start Location']].join(
        '__'
      ),
      date,
      dateNumber,
      distance,
      name: brevet['Event Name'],
      country: brevet.Country,
      city: brevet['Start Location'],
      map: [brevet.links?.Distance!].filter(Boolean),
      site: brevet.links?.['Event Name'],
      club: brevet.Organizer,
      ascent: parseInt(brevet.Elevation.replace(',', ''), 10),
      time,
      meta: brevet,
    };
  });
}

export async function getData() {
  return cleanBrevets(await fetchViaHtml());
}
