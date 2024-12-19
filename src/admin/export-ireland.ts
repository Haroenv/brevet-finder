import { Brevet } from '../types';
import { numToDateString, shortYearDateToDate, dateToNum } from '../date';
import { fetchXlsx } from './xlsx';

type Raw = {
  __rowNum__: string;
  Date: string;
  'Event Name': string;
  Distance: string;
  Organizer: string;
  'E-Mail': string;
  'Organising Club': string;
  Start: string;
  Province: string;
};

const country = 'Ireland';

const CALENDAR_PAGE = new URL('https://www.audaxireland.org/events-calendar/');

// something like https://www.audaxireland.org/wp-content/uploads/2024/07/Audax-Ireland-Calendar-2024-Excel.xlsx
async function getXlsxUrl() {
  const data = await fetch(CALENDAR_PAGE).then((res) => res.text());
  const result = /https:\/\/www\.audaxireland\.org\/wp-content\/.+?\.xlsx/.exec(
    data
  );
  if (result == null || result?.length == 0) {
    throw new Error(
      'Unable to parse https://www.audaxireland.org/events-calendar/ to extract XLSX file with calendar'
    );
  }
  return result[0] || '';
}

async function fetchViaXlsx(): Promise<Raw[]> {
  const calendarUrl = await getXlsxUrl();
  return fetchXlsx(new URL(calendarUrl));
}

function eventUrl(eventName: string, distance: number) {
  const formattedEventName = eventName
    .replace(/[^a-zA-Z0-9\s-]+/g, '')
    .replace(/\s+/g, '-')
    .trim()
    .toLowerCase();
  return `https://www.audaxireland.org/events-calendar/gazetteer/${distance}km-events/${formattedEventName}/`;
}

function cleanBrevets(brevets: Raw[]): Brevet[] {
  return brevets
    .filter((brevet) => !isNaN(parseInt(brevet.Date)))
    .map((brevet) => {
      const distance = parseInt(brevet.Distance) || 0;
      const dateNumber = dateToNum(shortYearDateToDate(brevet.Date));
      const date = numToDateString(dateNumber).split('-').reverse().join('/');

      return {
        objectID: [date, distance, country, brevet.Start].join('__'),
        date,
        dateNumber,
        distance,
        name: brevet['Event Name'],
        country: country,
        region: brevet.Province,
        city: brevet.Start,
        site: eventUrl(brevet['Event Name'], distance),
        mail: brevet['E-Mail'],
        club: brevet['Organising Club'],
        meta: brevet,
      };
    });
}

export async function getData() {
  console.log('Fetching Ireland brevets...');
  return cleanBrevets(await fetchViaXlsx());
}
