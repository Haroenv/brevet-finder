import { Brevet } from '../types';
import { numToDateString, shortYearDateToDate, dateToNum } from '../date';
import { fetchXlsx } from '../xlsx';

type Raw = {
  '__rowNum__': string;
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

const XLSX_URL = new URL(
  'https://www.audaxireland.org/wp-content/uploads/2024/07/Audax-Ireland-Calendar-2024-Excel.xlsx'
);

async function fetchViaXlsx() {
  return fetchXlsx(XLSX_URL);
}

function cleanBrevets(brevets: Raw[]): Brevet[] {
  return brevets.filter(brevet => !isNaN(parseInt(brevet.Date))).map((brevet) => {
    const distance = parseInt(brevet.Distance) || undefined;
    const dateNumber = dateToNum(shortYearDateToDate(brevet.Date));
    const date = numToDateString(dateNumber).split('-').reverse().join('/');

    return {
      objectID: [date, distance, country, brevet.Start].join(
        '__'
      ),
      date,
      dateNumber,
      distance,
      name: brevet['Event Name'],
      country: country,
      region: brevet.Province,
      department: '',
      city: brevet.Start,
      _geoloc: [],
      map: [],
      site: 'https://www.audaxireland.org/events-calendar/',
      mail: brevet['E-Mail'],
      club: brevet['Organising Club'],
      ascent: 0,
      time: 0,
      status: '',
      meta: brevet,
    };
  });
}

export async function getData() {
  return cleanBrevets(await fetchViaXlsx() as Raw[]);
}