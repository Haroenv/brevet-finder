import { Brevet } from '../types';
import { dateToNum } from '../date';
import { countByKey, makeCollisionSafeObjectID } from './id-utils';
import { fetchXlsx } from './xlsx';
import * as cheerio from 'cheerio';

type Raw = {
  __rowNum__: string;
  DATA: string;
  'TIPO BREVETTO': string;
  DISTANZA: string;
  'MASTER AUDAX': string;
  EXTREME: string;
  MANIFESTAZIONE: string;
  ORGANIZZATORE: string;
  REGIONE: string;
  COMUNE: string;
  'PROV.': string;
};

const country = 'Italy';
const MONTHS = new Map([
  ['gennaio', 1],
  ['febbraio', 2],
  ['marzo', 3],
  ['aprile', 4],
  ['maggio', 5],
  ['giugno', 6],
  ['luglio', 7],
  ['agosto', 8],
  ['settembre', 9],
  ['ottobre', 10],
  ['novembre', 11],
  ['dicembre', 12],
]);

const XLSX_URL = new URL(
  'https://www.audaxitalia.it/brevetti_richieste_esporta_calendario.php'
);
const MANIFESTAZIONI_URL = new URL('https://www.audaxitalia.it/index.php?pg=manifestazioni');

function parseDistance(value: string): number | undefined {
  const numbers = (value.match(/\d+/g) || []).map(Number);
  if (!numbers.length) return undefined;
  return Math.max(...numbers);
}

function parseMonthYear(value: string) {
  const match = value.toLowerCase().match(/([a-z]+)\s+(\d{4})/);
  if (!match) return { month: undefined, year: undefined };
  return {
    month: MONTHS.get(match[1]),
    year: Number.parseInt(match[2], 10),
  };
}

async function fetchViaXlsx(): Promise<Raw[]> {
  return fetchXlsx(XLSX_URL);
}

async function fetchViaHtml(): Promise<Raw[]> {
  const html = await fetch(MANIFESTAZIONI_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 brm-search' },
  }).then((response) => {
    if (!response.ok) {
      throw new Error(`Failed to fetch ${MANIFESTAZIONI_URL.toString()}: ${response.status}`);
    }
    return response.text();
  });

  const $ = cheerio.load(html);
  const records: Raw[] = [];
  let currentMonth: number | undefined;
  let currentYear: number | undefined;

  $('.dmm, .testo_gen').each((_, element) => {
    const el = $(element);
    if (el.hasClass('dmm')) {
      const parsed = parseMonthYear(el.text().trim());
      currentMonth = parsed.month;
      currentYear = parsed.year;
      return;
    }

    if (!currentMonth || !currentYear) return;

    const eventName = el.find('.br_data1').first().text().trim();
    if (!eventName) return;

    const city = el.find('.br_data').first().text().trim();
    const organizer = el.next('div').text().trim() || eventName;

    el.find('table.tdmn tr').each((_, row) => {
      const cells = $(row).find('td');
      const rawDate = cells.eq(0).text().trim();
      if (!rawDate) return;

      const [day, month] = rawDate.split('/').map((part) => part.trim());
      if (!day || !month) return;

      const distanceText = cells.eq(2).text().trim();
      const distance = parseDistance(distanceText);
      const dateString = `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${currentYear}`;

      records.push({
        __rowNum__: '',
        DATA: dateString,
        'TIPO BREVETTO': cells.eq(1).text().trim(),
        DISTANZA: distance !== undefined ? String(distance) : '',
        'MASTER AUDAX': '',
        EXTREME: '',
        MANIFESTAZIONE: eventName,
        ORGANIZZATORE: organizer,
        REGIONE: '',
        COMUNE: city,
        'PROV.': city.match(/\(([^)]+)\)$/)?.[1] || '',
      });
    });
  });

  return records;
}

function cleanBrevets(brevets: Raw[]): Brevet[] {
  const prepared = brevets
    .filter((brevet) => !isNaN(parseInt(brevet.DATA)))
    .map((brevet) => {
      const distance = parseInt(brevet.DISTANZA) || undefined;
      const dateString = brevet.DATA;
      const dateAsDate = new Date(
        Date.parse(dateString.split('/').reverse().join('-'))
      );
      const dateNumber = dateToNum(dateAsDate);
      const baseObjectID = [dateString, distance, country, brevet.COMUNE].join('__');

      return {
        brevet,
        distance,
        dateString,
        dateNumber,
        baseObjectID,
      };
    });

  const counts = countByKey(prepared.map((x) => x.baseObjectID));

  return prepared.map(({ brevet, distance, dateString, dateNumber, baseObjectID }) => {
    const objectID = makeCollisionSafeObjectID(
      baseObjectID,
      counts,
      [
        brevet.MANIFESTAZIONE || '',
        brevet.ORGANIZZATORE || '',
        brevet.REGIONE || '',
        brevet['TIPO BREVETTO'] || '',
      ].join('|')
    );

    return {
      objectID,
      date: dateString,
      dateNumber,
      distance,
      name: brevet.MANIFESTAZIONE,
      country: country,
      region: brevet.REGIONE,
      city: brevet.COMUNE,
      site: 'https://www.audaxitalia.it/index.php?pg=manifestazioni',
      club: brevet.ORGANIZZATORE,
      meta: brevet,
    };
  });
}

export async function getData() {
  console.log('Fetching Italy brevets...');

  try {
    return cleanBrevets(await fetchViaXlsx());
  } catch (error) {
    console.warn('Italy XLSX export failed; falling back to manifestazioni HTML feed.', error);
    return cleanBrevets(await fetchViaHtml());
  }
}
