import { Brevet } from '../types';
import * as cheerio from 'cheerio';
import { cleanRegion } from './clean-utils';
import { checkOk } from './fetch-utils';

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
  const html = await fetch('https://rusa.org/cgi-bin/eventsearch_PF.pl')
    .then(checkOk)
    .then((res) => res.text());
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
      region: cleanRegion(country, state),
      country,
      club: 'RUSA',
      site: brevet.link,
      mail: brevet.contactLink,
      map: brevet.map ? [brevet.map] : [],
      meta: brevet,
    };
  });
}

export async function getData() {
  console.log('Fetching USA brevets...');
  return cleanBrevets(await fetchBrevets());
}
