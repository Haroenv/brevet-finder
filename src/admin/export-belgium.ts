import { Brevet } from '../types';
import he from 'he';
import * as cheerio from 'cheerio';

type Raw = {
  id: string;
  global_id: string;
  global_id_lineage: string;
  author: string;
  status: string;
  date: string;
  date_utc: string;
  modified: string;
  modified_utc: string;
  url: string;
  rest_url: string;
  title: string;
  description: string;
  excerpt: string;
  slug: string;
  image: boolean;
  all_day: boolean;
  start_date: string;
  start_date_details: {
    year: string;
    month: string;
    day: string;
    hour: string;
    minutes: string;
    seconds: string;
  };
  end_date: string;
  end_date_details: {
    year: string;
    month: string;
    day: string;
    hour: string;
    minutes: string;
    seconds: string;
  };
  utc_start_date: string;
  utc_start_date_details: {
    year: string;
    month: string;
    day: string;
    hour: string;
    minutes: string;
    seconds: string;
  };
  utc_end_date: string;
  utc_end_date_details: {
    year: string;
    month: string;
    day: string;
    hour: string;
    minutes: string;
    seconds: string;
  };
  timezone: string;
  timezone_abbr: string;
  cost: string;
  cost_details: {
    currency_symbol: string;
    currency_code: string;
    currency_position: string;
    values: number[];
  };
  website: string;
  show_map: boolean;
  show_map_link: boolean;
  hide_from_listings: boolean;
  sticky: boolean;
  featured: boolean;
  categories: { name: 'brm' | '200' | '300' | '400' }[];
  tags: never[];
  venue: never[];
  organizer: never[];
};

async function fetchBrevets(
  prev: Raw[] = [],
  page: number = 1
): Promise<Raw[]> {
  const url = new URL(
    'https://randonneurs.be/nl/wp-json/tribe/events/v1/events/'
  );
  url.search = new URLSearchParams({
    page: page.toString(),
    per_page: '50',
    start_date: '2024-01-01 00:00:00',
    end_date: '2026-10-29 23:59:59',
    status: 'publish',
  }).toString();

  const { events = [], ...json }: { events: Raw[]; total_pages: number } =
    await fetch(url).then((res) => res.json());

  if (json.total_pages > page) {
    return fetchBrevets([...prev, ...events], page + 1);
  }

  return [...prev, ...events];
}

function cleanBrevets(brevets: Raw[]): Brevet[] {
  return brevets.map((brevet) => {
    const distance = parseInt(
      brevet.categories.find(
        (cat) => cat.name !== 'brm' && Number.isInteger(parseInt(cat.name))
      )?.name || '0'
    );
    const country = 'Belgium';
    const city = brevet.slug.split('-')[3]; // 2025-brm-500-oudenburg
    const title = he.decode(brevet.title);
    const { year, month, day } = brevet.start_date_details;
    const date = [day, month, year].join('/');
    const dateNumber = parseInt([year, month, day].join(''), 10);

    const $ = cheerio.load(brevet.description);

    return {
      objectID: [date, distance, country, city].join('__'),
      date,
      dateNumber,
      name: title,
      distance,
      country,
      city,
      map: $('a[href^=https://www.openrunner]')
        .toArray()
        .map((el) => $(el).attr('href'))
        .filter((x): x is string => !!x),
      site: brevet.url,
      mail: ($('a[href^=mailto:]').attr('href') || '').replace('mailto:', ''),
      club: $('a[href^=mailto:]')
        .parent()
        .parent()
        .find('li')
        .first()
        .text()
        .trim(),
      time: 0,
      ascent: 0,
      meta: brevet,
    };
  });
}

export async function getData() {
  console.log('Fetching Belgium brevets...');
  return cleanBrevets(await fetchBrevets());
}
