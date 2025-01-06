import { Brevet } from './types';

export function HitCard({ hit }: { hit: Brevet }) {
  return (
    <div
      data-objectid={hit.objectID}
      style={{ position: 'relative', width: '100%' }}
    >
      <a href={`?objectID=${hit.objectID}`} style={{ float: 'right' }}>
        share
      </a>
      <h2>{hit.date}</h2>
      <p>{hit.distance} km</p>
      {Boolean(hit.name) && <p>{hit.name}</p>}
      <p>
        {[hit.city, hit.department, hit.region, hit.country]
          .filter(Boolean)
          .join(', ')}
      </p>
      {Boolean(hit.ascent) && <p>{hit.ascent} m</p>}
      {Boolean(hit.site) && (
        <a
          href={hit.site && hit.site.startsWith('http') ? hit.site : undefined}
          target="_blank"
        >
          {hit.site}
        </a>
      )}
      <p>{hit.mail}</p>
      <p>{hit.club}</p>
      <ul>
        {hit.map?.map((map: string) => (
          <li key={map}>
            <a href={map.startsWith('http') ? map : undefined} target="_blank">
              {map}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
