import { Brevet } from '../types';
import { dateToNum } from '../date';
import { fetchXlsx } from './xlsx';

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

const XLSX_URL = new URL(
  'https://www.audaxitalia.it/brevetti_richieste_esporta_calendario.php'
);

async function fetchViaXlsx(): Promise<Raw[]> {
  return fetchXlsx(XLSX_URL);
}

function cleanBrevets(brevets: Raw[]): Brevet[] {
  return brevets
    .filter((brevet) => !isNaN(parseInt(brevet.DATA)))
    .map((brevet) => {
      const distance = parseInt(brevet.DISTANZA) || undefined;
      const dateString = brevet.DATA;
      const dateAsDate = new Date(
        Date.parse(dateString.split('/').reverse().join('-'))
      );
      const dateNumber = dateToNum(dateAsDate);

      return {
        objectID: [dateString, distance, country, brevet.COMUNE].join('__'),
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
  return cleanBrevets(await fetchViaXlsx());
}
