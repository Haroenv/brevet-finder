import { Brevet } from './types';

// Validate and sanitize URLs to prevent XSS via javascript: or data: protocols
function isValidUrl(url: unknown): url is string {
  if (typeof url !== 'string' || !url) return false;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:', 'mailto:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function HitCard({ hit }: { hit: Brevet }) {
  const validSiteUrl = isValidUrl(hit.site) ? hit.site : undefined;

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
      {validSiteUrl && (
        <a href={validSiteUrl} target="_blank" rel="noopener noreferrer">
          {hit.site}
        </a>
      )}
      {hit.mail && <p>{hit.mail}</p>}
      {hit.club && <p>{hit.club}</p>}
      {hit.map && hit.map.length > 0 && (
        <ul>
          {hit.map.map((map: string) => {
            const validMapUrl = isValidUrl(map) ? map : undefined;
            return (
              <li key={map}>
                {validMapUrl ? (
                  <a
                    href={validMapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {map}
                  </a>
                ) : (
                  <span>{map}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
