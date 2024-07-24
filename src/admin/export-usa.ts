import { Brevet } from '../types';
import * as cheerio from 'cheerio';

type Raw = {
  location: string;
  type: string;
  date: string;
  distance: string;
  name: string;
  map?: string;
  contact: string;
  contactLink?: string;
  link?: string;
};

async function fetchBrevets() {
  const html = await fetch('https://rusa.org/cgi-bin/eventsearch_PF.pl').then(
    (res) => res.text()
  );
  const $ = cheerio.load(html);

  const output: Raw[] = $('table[width] tbody tr')
    .map((i, el) => {
      const $el = $(el);
      const cells = $el.find('td');
      return {
        location: cells.eq(0).text().trim(),
        type: cells.eq(1).text().trim(),
        date: cells.eq(2).text().trim(),
        distance: cells.eq(3).text().trim(),
        name: cells.eq(4).text().trim(),
        map: url(cells.eq(4).find('a').attr('href')),
        contact: cells.eq(5).text().trim(),
        contactLink: url(cells.eq(5).find('a').attr('href')),
        link: url(cells.eq(6).find('a').attr('href')),
      };
    })
    .get();

  return output;
}

const url = (pathOrUrl?: string) =>
  new URL(
    pathOrUrl || '',
    'https://rusa.org/cgi-bin/eventsearch_PF.pl'
  ).toString();

const stateMap: Record<string, string> = {
  AK: 'Alaska',
  AL: 'Alabama',
  AR: 'Arkansas',
  AZ: 'Arizona',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DC: 'District of Columbia',
  DE: 'Delaware',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  IA: 'Iowa',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  MA: 'Massachusetts',
  MD: 'Maryland',
  ME: 'Maine',
  MI: 'Michigan',
  MN: 'Minnesota',
  MO: 'Missouri',
  MS: 'Mississippi',
  MT: 'Montana',
  NC: 'North Carolina',
  ND: 'North Dakota',
  NE: 'Nebraska',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NV: 'Nevada',
  NY: 'New York',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VA: 'Virginia',
  VT: 'Vermont',
  WA: 'Washington',
  WI: 'Wisconsin',
  WV: 'West Virginia',
  WY: 'Wyoming',
};

function cleanBrevets(brevets: Raw[]): Brevet[] {
  return brevets.map((brevet) => {
    const [state, city] = brevet.location.split(': ');
    const date = brevet.date.split('/').reverse().join('/');
    const dateNumber = parseInt(brevet.date.replaceAll('/', ''), 10);
    const country = 'USA';
    const distance = Math.floor(parseInt(brevet.distance, 10) / 100) * 100;

    return {
      objectID: [date, distance, country, city].join('__'),
      name: brevet.name,
      date,
      dateNumber,
      distance,
      city,
      region: stateMap[state],
      department: '',
      country,
      site: brevet.link || '',
      mail: brevet.contactLink || '',
      club: '',
      map: brevet.map ? [brevet.map] : [],
      ascent: 0,
      time: 0,
      status: '',
      _geoloc: [],
      meta: brevet,
    };
  });
}

export async function getData() {
  return cleanBrevets(await fetchBrevets());
}
