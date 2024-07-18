import {
  Configure,
  CurrentRefinements,
  Hits,
  InstantSearch,
  Pagination,
  PoweredBy,
  RefinementList,
  SearchBox,
  Stats,
  useGeoSearch,
  usePagination,
  useRange,
  useRefinementList,
} from 'react-instantsearch';
import { history } from 'instantsearch.js/es/lib/routers';
import algoliasearch from 'algoliasearch/lite';
import * as ReactDOM from 'react-dom/client';
import 'instantsearch.css/themes/satellite-min.css';
import type {
  InstantSearchOptions,
  UiState as InstantSearchUiState,
} from 'instantsearch.js';
import type { Brevet } from '../types';
import './map';
import { useEffect, useRef, useState } from 'react';
import { useView, ViewIndexUiState } from './connect-view';
import type { LngLatBounds } from 'mapbox-gl';

const rootDiv = document.getElementById('root') as HTMLElement;
const root = ReactDOM.createRoot(rootDiv);

const {
  VITE_ALGOLIA_APP = '',
  VITE_ALGOLIA_READ = '',
  VITE_MAPBOX = '',
} = import.meta.env;
if (!VITE_ALGOLIA_APP) {
  throw new Error('Missing VITE_ALGOLIA_APP env variable');
}
if (!VITE_ALGOLIA_READ) {
  throw new Error('Missing VITE_ALGOLIA_READ env variable');
}
if (!VITE_MAPBOX) {
  throw new Error('Missing VITE_MAPBOX env variable');
}

const searchClient = algoliasearch(VITE_ALGOLIA_APP, VITE_ALGOLIA_READ);

type UiState = InstantSearchUiState & {
  [indexId: string]: Partial<ViewIndexUiState<View>>;
};
type IndexUiState = InstantSearchUiState['string'] &
  Partial<ViewIndexUiState<View>>;

const routing: InstantSearchOptions<UiState, IndexUiState>['routing'] = {
  stateMapping: {
    stateToRoute(uiState) {
      const { configure, geoSearch, ...indexUiState } = uiState['brevets'];
      return {
        ...indexUiState,
      };
    },
    routeToState(routeState) {
      const { ...indexRouteState } = routeState;
      return {
        brevets: {
          ...indexRouteState,
          refinementList:
            indexRouteState['refinementList'] &&
            Object.fromEntries(
              Object.entries(indexRouteState['refinementList']).map(
                ([key, value]) => [key, Array.isArray(value) ? value : [value]]
              )
            ),
        },
      };
    },
  },
  router: history({
    createURL({ qsModule, routeState, location }) {
      return new URL(
        `?${qsModule.stringify(routeState, {
          encode: false,
          arrayFormat: 'repeat',
        })}`,
        location.href
      ).toString();
    },
    parseURL({ qsModule, location }) {
      return qsModule.parse(location.search.slice(1), {
        parseArrays: true,
      }) as UiState;
    },
    cleanUrlOnDispose: false,
  }),
};

root.render(
  <InstantSearch
    searchClient={searchClient}
    indexName="brevets"
    routing={routing}
    future={{
      persistHierarchicalRootCount: true,
      preserveSharedStateOnUnmount: true,
    }}
  >
    <Configure hitsPerPage={18} />
    <div>
      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 4fr', gap: '1em' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1em' }}>
          <a href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h1
              style={{
                fontSize: 'inherit',
                fontVariant: 'all-small-caps',
                color: '#5a5e9a',
              }}
            >
              Brevet Finder
            </h1>
          </a>
          <RangeWrapper attribute="dateNumber">
            <Panel header="date">
              <DatePicker attribute="dateNumber" />
            </Panel>
          </RangeWrapper>
          <RefinementListWrapper attribute="distance">
            <Panel header="distance">
              <RefinementList
                attribute="distance"
                transformItems={(items) =>
                  items.toSorted(
                    (a, b) => parseInt(a.value) - parseInt(b.value)
                  )
                }
                searchable
                showMore
              />
            </Panel>
          </RefinementListWrapper>
          <RefinementListWrapper attribute="country">
            <Panel header="country">
              <RefinementList attribute="country" searchable showMore />
            </Panel>
          </RefinementListWrapper>
          <RefinementListWrapper attribute="region">
            <Panel header="region">
              <RefinementList attribute="region" searchable showMore />
            </Panel>
          </RefinementListWrapper>
          <RefinementListWrapper attribute="department">
            <Panel header="department">
              <RefinementList attribute="department" searchable showMore />
            </Panel>
          </RefinementListWrapper>
          <RefinementListWrapper attribute="city">
            <Panel header="city">
              <RefinementList attribute="city" searchable showMore />
            </Panel>
          </RefinementListWrapper>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1em' }}>
          <SearchBox />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <CurrentRefinements
              transformItems={(items) => {
                return items.map((item) => {
                  if (item.attribute === 'dateNumber') {
                    return {
                      ...item,
                      label: 'date',
                      refinements: item.refinements.map((refinement) => ({
                        ...refinement,
                        label:
                          { '>=': '≥', '<=': '≤', '=': '=' }[
                            refinement.operator as string
                          ] +
                          ' ' +
                          numToDateString(refinement.value as number),
                      })),
                    };
                  }
                  return item;
                });
              }}
            />
            <div
              style={{
                display: 'flex',
                gap: '.5em',
              }}
            >
              <Stats />
              <PoweredBy />
            </div>
          </div>
          <Results />
        </div>
      </div>
      <footer>
        <p>
          Made with 🚲 by <a href="https://haroen.me">Haroen Viaene</a>. Data
          sources:{' '}
          <a href="https://www.audax-club-parisien.com/organisation/brm-monde/#calendrier-BRM">
            ACP
          </a>
          , <a href="https://map.audax-club-parisien.com">ACP</a>. Code
          available on{' '}
          <a href="https://github.com/haroenv/brm-search">GitHub</a>.
        </p>
      </footer>
    </div>
  </InstantSearch>
);

function PaginationWrapper({ children }: { children: React.ReactNode }) {
  const { canRefine } = usePagination();
  return (
    <div
      hidden={!canRefine}
      style={{ display: canRefine ? 'contents' : 'none' }}
    >
      {children}
    </div>
  );
}

function RefinementListWrapper({
  children,
  attribute,
}: {
  children: React.ReactNode;
  attribute: string;
}) {
  const { canRefine, items } = useRefinementList({ attribute });
  return (
    <div hidden={!canRefine || (items.length === 1 && !items[0].isRefined)}>
      {children}
    </div>
  );
}

function RangeWrapper({
  children,
  attribute,
}: {
  children: React.ReactNode;
  attribute: string;
}) {
  const { canRefine } = useRange({ attribute });
  return <div hidden={!canRefine}>{children}</div>;
}

function Panel({
  children,
  header,
}: {
  children: React.ReactNode;
  header: React.ReactNode;
}) {
  return (
    <div className="ais-Panel">
      <div className="ais-Panel-header">{header}</div>
      <div className="ais-Panel-body">{children}</div>
    </div>
  );
}

function Hit({ hit }: { hit: Brevet }) {
  return (
    <div data-objectid={hit.objectID}>
      <h2>{hit.date}</h2>
      <p>{hit.distance} km</p>
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
        {hit.map.map((map: string) => (
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

type View = 'hits' | 'geo';

function Results() {
  const { view } = useView<View>({ defaultView: 'hits' });

  return (
    <>
      <ViewSwitcher />
      {view === 'hits' ? (
        <>
          <Hits<Brevet> hitComponent={Hit} />{' '}
          <PaginationWrapper>
            <Pagination style={{ alignSelf: 'center' }} />
          </PaginationWrapper>
        </>
      ) : null}
      {view === 'geo' ? <DisplayGeo /> : null}
    </>
  );
}

function ViewSwitcher() {
  const { view, refine } = useView<View>({ defaultView: 'hits' });
  return (
    <div style={{ display: 'flex', gap: '.25em' }}>
      <button
        className={`btn ${view === 'hits' && 'active'}`}
        onClick={() => refine('hits')}
      >
        hits
      </button>
      <button
        className={`btn ${view === 'geo' && 'active'}`}
        onClick={() => refine('geo')}
      >
        geo
      </button>
    </div>
  );
}

function DisplayGeo() {
  const [selected, setSelected] = useState<Brevet[]>([]);

  return (
    <>
      <Configure hitsPerPage={500} />
      <GeoSearch
        onMarkerClick={(items) => {
          setSelected(items);
        }}
        selected={selected.map((hit) => hit.objectID)}
      />
      <div className="ais-Hits">
        <ul className="ais-Hits-list">
          {selected.map((hit) => (
            <li key={hit.objectID} className="ais-Hits-item">
              <Hit hit={hit} />
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function GeoSearch(props: {
  onMarkerClick: (item: Brevet[]) => void;
  selected: string[];
}) {
  // @ts-expect-error GeoHit wrongly has __position and __queryID
  const { items, refine } = useGeoSearch<Brevet>({});
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (ref.current) {
      // @ts-ignore
      ref.current.addEventListener('marker-click', onMarkerClick);
      // @ts-ignore
      ref.current.addEventListener('map-move', onMapMove);
    }

    function onMarkerClick(event: CustomEvent<{ points: Brevet[] }>) {
      props.onMarkerClick(
        typeof event.detail.points === 'string'
          ? JSON.parse(event.detail.points)
          : event.detail.points
      );
    }
    function onMapMove(event: CustomEvent<{ bounds: LngLatBounds }>) {
      const bounds = event.detail.bounds;
      if (bounds) {
        refine({ northEast: bounds._ne, southWest: bounds._sw });
      }
    }

    return () => {
      // @ts-ignore
      ref.current?.removeEventListener('marker-click', onMarkerClick);
      // @ts-ignore
      ref.current?.removeEventListener('map-move', onMapMove);
    };
  }, []);

  return (
    <mapbox-map
      ref={ref}
      data-latitude={0}
      data-longitude={0}
      data-zoom={1}
      data-accesstoken={VITE_MAPBOX}
      data-interactive="interactive"
      data-points={JSON.stringify(
        items.map((item) => ({
          objectID: item.objectID,
          selected: props.selected.includes(item.objectID),
          latitude: item._geoloc[0].lat,
          longitude: item._geoloc[0].lng,
          title: [
            item.distance + 'km',
            item.city,
            item.department,
            item.region,
            item.country,
          ]
            .filter(Boolean)
            .join(', '),
          link: item.site,
          _item: item,
        }))
      )}
    />
  );
}

function DatePicker({ attribute }: { attribute: string }) {
  const { refine, range, start } = useRange({ attribute });
  const current = {
    min: start[0],
    max: start[1],
  };

  if (
    range.min === range.max ||
    range.min === undefined ||
    range.max === undefined
  ) {
    return null;
  }

  const minFinite = current.min === -Infinity ? range.min : current.min;
  const maxFinite = current.max === Infinity ? range.max : current.max;

  const values = {
    min: Math.min(minFinite!, range.max!) || 0,
    max: Math.max(maxFinite!, range.min!) || 0,
  };
  const rangeForMin = {
    min: range.min,
    max: Math.min(range.max, values.max),
  };
  const rangeForMax = {
    min: Math.max(range.min, values.min),
    max: range.max,
  };

  return (
    <div style={{ display: 'flex' }}>
      <fieldset
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '.25em',
          border: '1px solid #d6d6e7',
          boxShadow: ' 0 1px 0 0 rgba(35, 38, 59, 0.05)',
        }}
      >
        <legend style={{ alignSelf: 'center' }}>From</legend>
        <input
          className="input"
          type="date"
          value={numToDateString(values.min)}
          onChange={(event) =>
            refine([dateStringToNum(event.target.value), values.max])
          }
          min={numToDateString(rangeForMin.min)}
          max={numToDateString(rangeForMin.max)}
        />
        <input
          type="range"
          value={dateToRatio(values.min, rangeForMin)}
          min={0}
          max={1}
          step={0.001}
          onChange={(event) =>
            refine([
              ratioToDate(Number(event.target.value), rangeForMin),
              values.max,
            ])
          }
        />
        <button
          onClick={() => refine([dateToNum(new Date()), values.max])}
          type="button"
          className="btn"
        >
          now
        </button>
      </fieldset>
      <fieldset
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '.25em',
          border: '1px solid #d6d6e7',
          boxShadow: ' 0 1px 0 0 rgba(35, 38, 59, 0.05)',
        }}
      >
        <legend style={{ alignSelf: 'center' }}>To</legend>
        <input
          type="date"
          className="input"
          value={numToDateString(values.max)}
          onChange={(event) =>
            refine([values.min, dateStringToNum(event.target.value)])
          }
          min={numToDateString(rangeForMax.min)}
          max={numToDateString(rangeForMax.max)}
        />
        <input
          type="range"
          value={dateToRatio(values.max, rangeForMax)}
          min={0}
          max={1}
          step={0.001}
          onChange={(event) =>
            refine([
              values.min,
              ratioToDate(Number(event.target.value), rangeForMax),
            ])
          }
        />
        <button
          onClick={() => refine([values.min, dateToNum(new Date())])}
          type="button"
          className="btn"
        >
          now
        </button>
      </fieldset>
    </div>
  );
}

function dateToNum(date: Date) {
  return dateStringToNum(date.toISOString().split('T')[0]);
}

function dateStringToNum(date: string) {
  return parseInt(date.replaceAll('-', ''), 10);
}

function numToDateString(num: number) {
  const date = num.toString();
  return `${date.slice(0, 4)}-${date.slice(4, 6).padStart(2, '0')}-${date
    .slice(6, 8)
    .padStart(2, '0')}`;
}

function ratioToDate(
  ratio: number,
  range: { min?: number; max?: number }
): number {
  if (
    range.min === undefined ||
    range.max === undefined ||
    range.min === -Infinity ||
    range.max === Infinity
  ) {
    return 0;
  }
  const minTimeStamp = new Date(numToDateString(range.min)).getTime();
  const maxTimeStamp = new Date(numToDateString(range.max)).getTime();

  const date = new Date(minTimeStamp + ratio * (maxTimeStamp - minTimeStamp));

  return parseInt(date.toISOString().split('T')[0].replaceAll('-', ''), 10);
}

function dateToRatio(date: number, range: { min?: number; max?: number }) {
  if (
    range.min === undefined ||
    range.max === undefined ||
    range.min === -Infinity ||
    range.max === Infinity
  ) {
    return 0.5;
  }
  if (date === 0 || range.min === range.max) {
    return 0;
  }
  const minTimeStamp = new Date(numToDateString(range.min)).getTime();
  const maxTimeStamp = new Date(numToDateString(range.max)).getTime();
  const dateTimeStamp = new Date(numToDateString(date)).getTime();

  return (dateTimeStamp - minTimeStamp) / (maxTimeStamp - minTimeStamp);
}
