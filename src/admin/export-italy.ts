import { Brevet } from '../types';
import { dateToNum } from '../date';
import { countByKey, makeCollisionSafeObjectID } from './id-utils';
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
  return cleanBrevets(await fetchViaXlsx());
}
