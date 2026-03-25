import { Brevet } from '../types';
import { checkOk } from './fetch-utils';

type CalendarRaw = {
  Name: string;
  NominalDistance: number;
  Distance: number;
  AAAPoints: number;
  OrganizerName: string;
  Url: string;
  Id: number;
  StartLocation: string;
  EventDate: string;
};

type CalendarResponse = {
  Results: CalendarRaw[];
  CurrentPage: number;
  TotalPages: number;
};

function isCalendarResponse(data: unknown): data is CalendarResponse {
  if (!data || typeof data !== 'object') {
    return false;
  }

  return (
    'Results' in data &&
    Array.isArray((data as Record<string, unknown>).Results) &&
    'CurrentPage' in data &&
    'TotalPages' in data
  );
}

async function fetchBrevets() {
  const firstPage = await fetch(
    'https://www.audax.uk/umbraco/api/EventSearch/SearchCalendar',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        DurationNights: 360,
        pageSize: 300,
        page: 1,
      }),
    }
  )
    .then(checkOk)
    .then((res) => res.json());

  if (!isCalendarResponse(firstPage)) {
    throw new Error('Invalid SearchCalendar response from audax.uk website');
  }

  const all = [...firstPage.Results];
  for (let page = 2; page <= firstPage.TotalPages; page++) {
    const data = await fetch(
      'https://www.audax.uk/umbraco/api/EventSearch/SearchCalendar',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          DurationNights: 360,
          pageSize: 300,
          page,
        }),
      }
    )
      .then(checkOk)
      .then((res) => res.json());

    if (!isCalendarResponse(data)) {
      throw new Error(`Invalid SearchCalendar response for page ${page}`);
    }

    all.push(...data.Results);
  }

  return all;
}

const url = (pathOrUrl?: string) =>
  new URL(pathOrUrl || '', 'https://www.audax.uk/event-details/').toString();

function padDate(date: number) {
  if (date < 10) {
    return `0${date}`;
  }
  return date;
}

function cleanBrevets(brevets: CalendarRaw[]): Brevet[] {
  return brevets.map((brevet) => {
    const jsDate = new Date(brevet.EventDate);
    const year = jsDate.getFullYear();
    const month = padDate(jsDate.getMonth() + 1);
    const day = padDate(jsDate.getDate());
    const dateNumber = parseInt([year, month, day].join(''));
    const date = [day, month, year].join('/');
    const city = (brevet.StartLocation || '').trim();
    const country = 'UK';
    const distance = brevet.NominalDistance || brevet.Distance;

    return {
      objectID: [date, distance, country, city.replace(/\W+/g, '_')].join('__'),
      name: brevet.Name,
      date,
      dateNumber,
      distance,
      country,
      city,
      _geoloc: [],
      site: url(brevet.Url),
      club: brevet.OrganizerName,
      ascent: brevet.AAAPoints || 0,
      meta: brevet,
    };
  });
}

export async function getData() {
  console.log('Fetching AUK brevets...');
  return cleanBrevets(await fetchBrevets());
}
