import { Highlight } from 'react-instantsearch';
import { Hit } from 'instantsearch.js';
import { numToDate } from './date';
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

function getUrlLabel(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// Official ACP randonneuring medal/distance colours
const DISTANCE_COLORS: Map<number, { bg: string; text: string }> = new Map([
  [0, { bg: '#6c757d', text: '#fff' }],
  [200, { bg: '#2c7be5', text: '#fff' }],
  [300, { bg: '#27a744', text: '#fff' }],
  [400, { bg: '#e0a020', text: '#fff' }],
  [600, { bg: '#dc3545', text: '#fff' }],
  [1000, { bg: '#6f1e1e', text: '#fff' }],
  [1200, { bg: '#b8960c', text: '#fff' }],
]);

export function getDistanceColor(distance: number = 0) {
  let key = 0;
  for (const threshold of DISTANCE_COLORS.keys()) {
    if (threshold <= distance) key = threshold;
    else break;
  }

  return DISTANCE_COLORS.get(key)!;
}

function getRelativeDate(dateNumber: number): string {
  const date = numToDate(dateNumber);
  const now = new Date();
  const diffDays = Math.round((date.getTime() - now.getTime()) / 86_400_000);
  if (diffDays < 0) return 'Past';
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays <= 6) return `In ${diffDays} days`;
  if (diffDays <= 13) return 'Next week';
  if (diffDays <= 30) return `In ${Math.round(diffDays / 7)} weeks`;
  if (diffDays <= 60) return 'Next month';
  return '';
}

const df = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function format(dateNumber: number): string {
  try {
    const date = numToDate(dateNumber);
    return df.format(date);
  } catch {
    return String(dateNumber);
  }
}

function intersperse<T, TS>(parts: T[], separator: TS): (T | TS)[] {
  return parts.flatMap((part, index) =>
    index === parts.length - 1 ? [part] : [part, separator]
  );
}

export function HitCard({ hit }: { hit: Hit<Brevet> }) {
  const validSiteUrl = isValidUrl(hit.site) ? hit.site : undefined;
  const location = intersperse(
    ['city', 'department', 'region', 'country']
      .filter(
        (key): key is keyof Hit<Brevet> =>
          key in hit && Boolean((hit as any)[key])
      )
      .map((key) => <Highlight key={key} attribute={key} hit={hit} />),
    ', '
  );
  const name = hit.name ? (
    <Highlight attribute="name" hit={hit} />
  ) : (
    intersperse(
      ['city', 'distance']
        .filter(
          (key): key is keyof Hit<Brevet> =>
            key in hit && Boolean((hit as any)[key])
        )
        .map((key) => <Highlight key={key} attribute={key} hit={hit} />),
      ' '
    )
  );
  const distanceColor = getDistanceColor(hit.distance);
  const relativeDate = getRelativeDate(hit.dateNumber);

  return (
    <article data-objectid={hit.objectID} className="hit-card">
      <div className="hit-card__body">
        <header className="hit-card__header">
          <div className="hit-card__badges">
            <span className="hit-card__badge" title={format(hit.dateNumber)}>
              {hit.date}
              {relativeDate && (
                <em className="hit-card__relative-date">{relativeDate}</em>
              )}
            </span>
            {Boolean(hit.distance) && (
              <span
                className="hit-card__badge hit-card__badge--distance"
                style={{
                  background: distanceColor.bg,
                  color: distanceColor.text,
                }}
              >
                {hit.distance} km
              </span>
            )}
          </div>
          <a className="hit-card__share" href={`?objectID=${hit.objectID}`}>
            share
          </a>
        </header>

        <h2 className="hit-card__title">{name}</h2>

        <p className="hit-card__location">{location}</p>

        <div className="hit-card__organizer">
          {hit.club && (
            <span className="hit-card__club">
              <Highlight attribute="club" hit={hit} />
            </span>
          )}
        </div>

        <div className="hit-card__meta">
          {Boolean(hit.ascent) && <span>↗ {hit.ascent} m</span>}
          {Boolean(hit.mail) && <span>{hit.mail}</span>}
        </div>

        <div className="hit-card__links">
          {validSiteUrl && (
            <a
              className="hit-card__link"
              href={validSiteUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {getUrlLabel(validSiteUrl)}
            </a>
          )}
          {hit.map?.map((map: string, index) => {
            const validMapUrl = isValidUrl(map) ? map : undefined;
            const counter = hit.map!.length !== 1 ? index + 1 : null;
            return validMapUrl ? (
              <a
                key={map}
                className="hit-card__link hit-card__link--muted"
                href={validMapUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                map {counter}
              </a>
            ) : null;
          })}
        </div>
      </div>
    </article>
  );
}
