import { Brevet } from '../types';

type Raw = {
  StartCondition: string;
  StartAddressDescription: string;
  Category: string;
  EventDateFormatted: string;
  AwardDistance: number;
  ActualDistance: number;
  Title: string;
  OrganiserFullName: string;
  IsCancelled: boolean;
  StartLatitude: number;
  StartLongitude: number;
  Body: string;
  Climb?: number;
  Url: string;
};

async function fetchBrevets() {
  const data = await fetch(
    'https://www.audax.uk/umbraco/surface/Events/Search?DurationNights=360&pageSize=300'
  ).then((res) => res.json());

  if (!data.hasOwnProperty('Items') || !Array.isArray(data['Items']))
    throw new Error('Invalid response from audax.uk website');
  return data['Items'];
}

const url = (pathOrUrl?: string) =>
  new URL(pathOrUrl || '', 'https://www.audax.uk/event-details/').toString();

function padDate(date: number) {
  if (date < 10) {
    return `0${date}`;
  }
  return date;
}

function cleanBrevets(brevets: Raw[]): Brevet[] {
  return brevets
    .filter((brevet) => !brevet.IsCancelled)
    .map((brevet) => {
      const jsDate = new Date(brevet.EventDateFormatted);
      const year = jsDate.getFullYear();
      const month = padDate(jsDate.getMonth() + 1);
      const day = padDate(jsDate.getDate());
      const dateNumber = parseInt([year, month, day].join(''));
      const date = [day, month, year].join('/');
      const city = brevet.StartCondition.trim();
      const cityExtended = (city + ' ' + brevet.StartAddressDescription)
        .replace(' ,', ',')
        .trim();
      const country = 'UK';
      const climb = brevet.Climb || 0;

      return {
        objectID: [
          date,
          brevet.AwardDistance,
          country,
          city.replace(/\W+/g, '_'),
        ].join('__'),
        name: brevet.Title,
        date,
        dateNumber,
        distance: brevet.AwardDistance,
        country,
        city: cityExtended,
        _geoloc: [{ lat: brevet.StartLatitude, lng: brevet.StartLongitude }],
        site: url(brevet.Url),
        club: brevet.Body,
        ascent: climb,
        meta: brevet,
      };
    });
}

export async function getData() {
  console.log('Fetching AUK brevets...');
  return cleanBrevets(await fetchBrevets());
}
