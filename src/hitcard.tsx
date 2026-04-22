import { Highlight } from 'react-instantsearch';
import { Hit } from 'instantsearch.js';
import { numToDate } from './date';
import { Brevet } from './types';
import {
  PLAN_STATUS_ICONS,
  PLAN_STATUS_LABELS,
  usePlans,
  type PlanStatus,
} from './plans';

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

function isValidEmail(mail: string | undefined) {
  return Boolean(mail && mail.includes('@') && mail.includes('.'));
}

function getUrlLabel(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function getFallbackSearchUrl(hit: Hit<Brevet>) {
  const query = [
    hit.club,
    hit.city,
    hit.country,
    hit.category || (hit.distance ? `${hit.distance}km` : ''),
    hit.date,
    'BRM',
  ]
    .filter(Boolean)
    .join(' ');
  return `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
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

const CATEGORY_TO_DISTANCE: Record<NonNullable<Brevet['category']>, number> = {
  '<200': 0,
  '200': 200,
  '300': 300,
  '400': 400,
  '600': 600,
  '1000': 1000,
  '1200+': 1200,
};

export function getDistanceColor(distance: number = 0) {
  let key = 0;
  for (const threshold of DISTANCE_COLORS.keys()) {
    if (threshold <= distance) key = threshold;
    else break;
  }

  return DISTANCE_COLORS.get(key)!;
}

export function getCategoryColor(category: Brevet['category']) {
  const bucket = category ? CATEGORY_TO_DISTANCE[category] : 0;
  return getDistanceColor(bucket);
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

export function HitCard({
  hit,
  link = true,
}: {
  hit: Hit<Brevet>;
  link?: boolean;
}) {
  const { getPlanStatus, setPlanStatus } = usePlans();
  const planStatus = getPlanStatus(hit.objectID);
  const validSiteUrl = isValidUrl(hit.site) ? hit.site : undefined;
  const validMaps = (hit.map || []).filter(isValidUrl);
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
      ['city', hit.category ? 'category' : 'distance']
        .filter(
          (key): key is keyof Hit<Brevet> =>
            key in hit && Boolean((hit as any)[key])
        )
        .map((key) => <Highlight key={key} attribute={key} hit={hit} />),
      ' '
    )
  );
  const distanceColor = hit.category
    ? getCategoryColor(hit.category)
    : getDistanceColor(hit.distance);
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
            {Boolean(hit.category || hit.distance) && (
              <span
                className="hit-card__badge hit-card__badge--distance"
                style={{
                  background: distanceColor.bg,
                  color: distanceColor.text,
                }}
              >
                {hit.category || hit.distance} km
              </span>
            )}
          </div>
          <a className="hit-card__share" href={`?objectID=${hit.objectID}`}>
            share
          </a>
        </header>

        <h2 className="hit-card__title">
          {link ? <a href={`?objectID=${hit.objectID}`}>{name}</a> : name}
        </h2>

        <p className="hit-card__location">{location}</p>

        <div className="hit-card__organizer">
          {hit.club && (
            <span className="hit-card__club">
              <Highlight attribute="club" hit={hit} />
            </span>
          )}
        </div>

        <div className="hit-card__plan">
          <div className="hit-card__plan-group" role="group" aria-label="plan">
            {Object.entries(PLAN_STATUS_LABELS).map(([value, label]) => {
              const status = value as PlanStatus;
              const isActive = planStatus === status;
              return (
                <button
                  key={value}
                  type="button"
                  className={`hit-card__plan-pill${isActive ? ' is-active' : ''}`}
                  aria-pressed={isActive}
                  onClick={() => {
                    setPlanStatus(hit.objectID, isActive ? null : status);
                  }}
                >
                  <span className="hit-card__plan-pill-icon" aria-hidden="true">
                    {isActive
                      ? PLAN_STATUS_ICONS[status].active
                      : PLAN_STATUS_ICONS[status].inactive}
                  </span>{' '}
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="hit-card__meta">
          {Boolean(hit.ascent) && <span>↗ {hit.ascent} m</span>}
          {Boolean(hit.mail) && (
            <span>
              <a
                href={isValidEmail(hit.mail) ? `mailto:${hit.mail}` : undefined}
              >
                {hit.mail}
              </a>
            </span>
          )}
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
          {validMaps.map((map, index) => {
            const counter = validMaps.length !== 1 ? index + 1 : null;
            return (
              <a
                key={map}
                className="hit-card__link hit-card__link--muted"
                href={map}
                target="_blank"
                rel="noopener noreferrer"
              >
                map {counter}
              </a>
            );
          })}
        </div>
      </div>
    </article>
  );
}
