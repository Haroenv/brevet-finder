import { Brevet } from '../types';

type Raw = {};

async function fetchRides(): Promise<Raw[]> {
  const data = await fetch('https://audax.org.au/wp-admin/admin-ajax.php', {
    body: new URLSearchParams({
      action: 'audax_event_registration_list_filter',
      region: '',
      from_date: '2024-08-02',
      period: '1 months',
      min_distance: '',
      max_distance: '',
      brevet_type: '',
      _audax_ajax: 'fd34ff23a0',
    }),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    method: 'POST',
  }).then((res) => res.text());

  return [];
}

function cleanRides(raw: Raw[]): Brevet[] {
  return raw.map((ride) => {
    return { meta: ride } as any;
  });
}

export async function getData() {
  return cleanRides(await fetchRides());
}
