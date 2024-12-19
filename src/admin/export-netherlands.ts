import { Brevet } from '../types';
import { checkOk } from './fetch-utils';
import he from 'he';

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
  categories: never[];
  tags: { name: '200' | '2024' | 'BRM' }[];
  venue: {
    id: number;
    author: string;
    status: 'publish';
    venue: string;
    address: string;
    city: string;
    country: string;
    zip: string;
  };
  organizer: {
    email: string;
    organizer: string;
  }[];
};

async function fetchBrevets(
  prev: Raw[] = [],
  page: number = 1
): Promise<Raw[]> {
  const url = new URL(
    'https://www.randonneurs.nl/wp-json/tribe/events/v1/events/'
  );
  url.search = new URLSearchParams({
    page: page.toString(),
    per_page: '50',
    start_date: '2024-01-01 00:00:00',
    end_date: '2026-10-29 23:59:59',
    status: 'publish',
  }).toString();

  const { events = [], ...json }: { events: Raw[]; total_pages: number } =
    await fetch(url)
      .then(checkOk)
      .then((res) => res.json());

  if (json.total_pages > page) {
    return fetchBrevets([...prev, ...events], page + 1);
  }

  return [...prev, ...events];
}

function cleanBrevets(brevets: Raw[]): Brevet[] {
  return brevets.map((brevet) => {
    const distance = parseInt(
      brevet.tags.find(
        (tag) => Number.isInteger(parseInt(tag.name)) && tag.name.endsWith('00')
      )?.name || '0'
    );
    const country = 'The Netherlands';
    const city = brevet.venue.city;
    const title = he.decode(brevet.title);
    const { year, month, day } = brevet.start_date_details;
    const date = [day, month, year].join('/');
    const dateNumber = parseInt([year, month, day].join(''), 10);
    const { email: mail, organizer: club } = brevet.organizer[0] || {
      email: '',
      organizer: '',
    };

    brevet.description = brevet.description.slice(0, 10_000);

    return {
      objectID: [date, distance, country, city].join('__'),
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
