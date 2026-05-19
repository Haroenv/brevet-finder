import { Brevet } from '../types';
import * as cheerio from 'cheerio';
import { numToDate } from '../date';
import { cleanRegion } from './clean-utils';
import { checkOk } from './fetch-utils';
import { countByKey, makeCollisionSafeObjectID } from './id-utils';

type Raw = {
  location: string;
  type: string;
  date: string;
  distance: string;
  climbing: string;
  routeName: string;
  routeLink?: string;
  link?: string;
};

async function fetchBrevets() {
  const html = await fetch('https://rusa.org/cgi-bin/eventsearch_PF.pl')
    .then(checkOk)
    .then((res) => res.text());
  const $ = cheerio.load(html);

  const output: Raw[] = $('table[width] tbody tr')
    .map((_, el) => {
      const $el = $(el);
      const cells = $el.find('td');
      if (cells.length !== 7) return undefined as any;

      const routeCell = cells.eq(5);
      const routeLink = routeCell.find('a').attr('href');
      const routeName =
        routeCell
          .html()
          ?.replace(/<br\s*\/?>/gi, ' — ')
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/\s+/g, ' ')
          .trim() || '';

      return {
        location: cells.eq(0).text().trim(),
        type: cells.eq(1).text().trim(),
        date: cells.eq(2).text().trim(),
        distance: cells.eq(3).text().trim(),
        climbing: cells.eq(4).text().trim(),
        routeName,
        routeLink: routeLink ? resolveUrl(routeLink) : undefined,
        link: resolveUrl(cells.eq(6).find('a').attr('href')),
      };
    })
    .get()
    .filter((x): x is Raw => Boolean(x));

  return output;
}

function resolveUrl(pathOrUrl?: string): string | undefined {
  if (!pathOrUrl) return undefined;
  try {
    return new URL(
      pathOrUrl,
      'https://rusa.org/cgi-bin/eventsearch_PF.pl'
    ).toString();
  } catch {
    return undefined;
  }
}

function parseClimbingFeetToMeters(value: string): number | undefined {
  const digits = value.replace(/[^0-9]/g, '');
  if (!digits) return undefined;
  const feet = parseInt(digits, 10);
  if (!Number.isFinite(feet) || feet <= 0) return undefined;
  return Math.round(feet * 0.3048);
}

function cleanBrevets(brevets: Raw[]): Brevet[] {
  const prepared = brevets.map((brevet) => {
    const [state, city] = brevet.location.split(': ');
    const date = brevet.date.split('/').reverse().join('/');
    const dateNumber = parseInt(brevet.date.replaceAll('/', ''), 10);
    const country = 'USA';
    const distance = Math.floor(parseInt(brevet.distance, 10) / 100) * 100;
    const baseObjectID = [date, distance, country, city].join('__');

    return {
      brevet,
      state,
      city,
      date,
      dateNumber,
      country,
      distance,
      baseObjectID,
    };
  });

  const counts = countByKey(prepared.map((x) => x.baseObjectID));

  return prepared.map(
    ({
      brevet,
      state,
      city,
      date,
      dateNumber,
      country,
      distance,
      baseObjectID,
    }) => {
      const objectID = makeCollisionSafeObjectID(
        baseObjectID,
        counts,
        [
          brevet.routeName || '',
          brevet.routeLink || '',
          brevet.link || '',
          brevet.type || '',
        ].join('|')
      );

      return {
        objectID,
        name: brevet.routeName || undefined,
        date,
        dateNumber,
        time: numToDate(dateNumber).getTime() / 1000,
        distance,
        city,
        region: cleanRegion(country, state),
        country,
        club: 'RUSA',
        site: brevet.link,
        map: brevet.routeLink ? [brevet.routeLink] : [],
        ascent: parseClimbingFeetToMeters(brevet.climbing),
        meta: brevet,
      };
    }
  );
}

export async function getData() {
  console.log('Fetching USA brevets...');
  return cleanBrevets(await fetchBrevets());
}
