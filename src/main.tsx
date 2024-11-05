import {
  ClearRefinements,
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
  useHits,
  useInstantSearch,
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
  Hit as AlgoliaHit,
} from 'instantsearch.js';
import type { Brevet } from './types';
import './map';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useView, ViewIndexUiState } from './connect-view';
import type { LngLatBounds } from 'mapbox-gl';
import {
  dateStringToNum,
  dateToNum,
  dateToRatio,
  numToDateString,
  ratioToDate,
} from './date';
import { useMediaQuery } from './use-media-query';

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
      const {
        configure,
        geoSearch,
        range = {},
        ...indexUiState
      } = uiState['brevets'];
      const { dateNumber, ...rangeUiState } = range;
      return {
        ...indexUiState,
        range: {
          ...rangeUiState,
          date: dateNumber,
        },
      };
    },
    routeToState(routeState) {
      const { ...indexRouteState } = routeState;
      return {
        brevets: {
          ...indexRouteState,
          range: {
            ...indexRouteState['range'],
            dateNumber:
              indexRouteState['range']?.['date'] ||
              // default to today
              [dateToNum(new Date()), ''].join(':'),
          },
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
        `${qsModule.stringify(routeState, {
          encode: false,
          arrayFormat: 'repeat',
          addQueryPrefix: true,
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

const insights: InstantSearchOptions<UiState, IndexUiState>['insights'] = {
  onEvent(event, aa) {
    if (event.eventType === 'view' && event.eventModifier === 'internal') {
      return;
    }
    (event.payload as any).algoliaSource = ['instantsearch'];
    if (event.eventModifier === 'internal') {
      (event.payload as any).algoliaSource.push('instantsearch-internal');
    }
    if (event.insightsMethod) {
      aa!(event.insightsMethod, event.payload as any);
    }
  },
};

const objectID = new URLSearchParams(location.search).get('objectID');
const App = objectID ? DetailsApp : SearchApp;

root.render(<App />);

function DetailsApp() {
  return (
    <InstantSearch
      searchClient={searchClient}
      indexName="brevets"
      insights={insights}
      future={{
        persistHierarchicalRootCount: true,
        preserveSharedStateOnUnmount: true,
      }}
    >
      <div style={{ maxWidth: '60ch', margin: '0 auto' }}>
        <Configure hitsPerPage={1} filters={`objectID:"${objectID}"`} />
        <Logo resets={false} />
        <p>
          Check out this brevet! To find other brevets, go to{' '}
          <a href=".">search</a>.
        </p>
        <DisplayDetails />
        <Footer />
      </div>
    </InstantSearch>
  );
}

function DisplayDetails() {
  const { items, sendEvent } = useHits<Brevet>();

  useEffect(() => {
    if (items[0]) {
      sendEvent('conversion', items[0], 'Hit detail seen');
    }
  }, [items[0]?.objectID]);

  if (items.length === 0) {
    return;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1em' }}>
      <div className="ais-Hits-item">
        <Hit hit={items[0]} />
      </div>
      {items[0]._geoloc?.[0] && (
        <GeoSearch
          onMarkerClick={() => {}}
          selected={items.map((hit) => hit.objectID)}
          center={items[0]._geoloc[0]}
          zoom={5}
          refineOnMapMove={false}
        />
      )}
    </div>
  );
}

const SizeContext = createContext(false);

function SearchApp() {
  const small = useMediaQuery('(max-width: 800px)');

  return (
    <SizeContext.Provider value={small}>
      <InstantSearch
        searchClient={searchClient}
        indexName="brevets"
        routing={routing}
        insights={insights}
        future={{
          persistHierarchicalRootCount: true,
          preserveSharedStateOnUnmount: true,
        }}
      >
        <Configure hitsPerPage={small ? 10 : 18} />
        <div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: small ? '1fr' : 'minmax(330px, 1fr) 4fr',
              gap: '1em',
            }}
          >
            <div hidden={small}>
              <Sidebar />
            </div>
            <Main />
          </div>
          <Footer />
        </div>
      </InstantSearch>
    </SizeContext.Provider>
  );
}

function Sidebar({ logo = true }: { logo?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1em' }}>
      {logo && <Logo />}
      <RangeWrapper attribute="dateNumber">
        <Panel header="date">
          <DatePicker attribute="dateNumber" />
        </Panel>
      </RangeWrapper>
      <RefinementListWrapper attribute="distance">
        <Panel header="distance">
          <RefinementList
            attribute="distance"
            limit={6}
            showMoreLimit={40}
            transformItems={(items) =>
              items
                .toSorted((a, b) => parseInt(a.value) - parseInt(b.value))
                .map((item) => ({
                  ...item,
                  label: item.label + ' km',
                }))
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
  );
}

function Main() {
  const small = useContext(SizeContext);
  const [showRefinements, setShowRefinements] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1em' }}>
      <SearchBox />
      <div>
        {small ? (
          <div style={{ display: 'flex', gap: '.25em' }}>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setShowRefinements(true);
              }}
            >
              refine
            </button>
            <ViewSwitcher />
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: small ? 'column' : 'row',
              flexWrap: 'wrap',
              gap: '1em',
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
                        label: [
                          { '>=': 'from', '<=': 'to', '=': '=' }[
                            refinement.operator as string
                          ],
                          numToDateString(refinement.value as number),
                        ].join(' '),
                      })),
                    };
                  }
                  if (item.attribute === 'distance') {
                    return {
                      ...item,
                      label: 'distance',
                      refinements: item.refinements.map((refinement) => ({
                        ...refinement,
                        label: refinement.label + ' km',
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
                flexDirection: small ? 'column' : 'row',
                alignItems: 'center',
                gap: '.5em',
              }}
            >
              <ViewSwitcher />
              <Stats />
              <PoweredBy style={{ translate: '0 1.5px' }} />
            </div>
          </div>
        )}
      </div>
      <div
        hidden={showRefinements}
        style={{
          display: showRefinements ? 'none' : 'contents',
        }}
      >
        <Results />
      </div>
      {showRefinements && (
        <div
          style={{
            position: 'absolute',
            background: 'white',
            width: '100%',
            top: 0,
            left: 0,
            boxSizing: 'border-box',
            padding: '.5em',
            minHeight: '100vh',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: '0.5em',
              alignItems: 'center',
              marginBottom: '0.5em',
            }}
          >
            <ClearRefinements translations={{ resetButtonText: 'reset' }} />
            <button
              type="button"
              className="btn"
              onClick={() => {
                setShowRefinements(false);
              }}
            >
              apply
            </button>
            <Stats />
          </div>
          <Sidebar logo={false} />
        </div>
      )}
    </div>
  );
}

function Footer() {
  return (
    <footer
      style={{ textAlign: 'justify', maxWidth: '60ch', margin: '0 auto' }}
    >
      <p>
        Made with 🚲 by <a href="https://haroen.me">Haroen Viaene</a>. Data
        sources:{' '}
        <a href="https://www.audax-club-parisien.com/organisation/brm-monde/#calendrier-BRM">
          ACP
        </a>
        , <a href="https://map.audax-club-parisien.com">ACP</a>,{' '}
        <a href="https://www.randonneursmondiaux.org/59-Calendrier.html">LRM</a>
        , <a href="http://rusa.org">RUSA</a>,{' '}
        <a href="https://audax.uk">Audax UK</a>,{' '}
        <a href="https://www.audaxitalia.it">Audax Italia</a>,{' '}
        <a href="https://www.audaxireland.org">Audax Ireland</a>,{' '}
        <a href="https://randonneurs.be">Randonneurs BE</a>,{' '}
        <a href="https://www.randonneurs.nl">Randonneurs NL</a>. Code available
        on <a href="https://github.com/haroenv/brm-search">GitHub</a>.
      </p>
      <p>
        A Brevet is a long-distance cycling event with as goal to move your own
        boundaries, not a race. They are classified in different distances, with
        as eventual goal the{' '}
        <a href="https://www.paris-brest-paris.org">
          Paris-Brest-Paris Randonneur
        </a>{' '}
        (1200km) event which is organised every four years. Every event has a
        time limit, and you need to finish within that time limit to get a
        validation, although usually this is fairly generous.
      </p>
      <p>
        I invite you happily to find an event to participate in on this site,
        which is frequently updated with information from different sources (let
        me know if I'm missing any). Have a nice ride!
      </p>
    </footer>
  );
}

function Logo({ resets = true }: { resets?: boolean }) {
  const { setIndexUiState } = useInstantSearch();
  return (
    <a
      href="."
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || !resets) return;
        e.preventDefault();
        setIndexUiState({});
      }}
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
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
  );
}

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

type View = 'hits' | 'geo';

function Results() {
  const { view } = useView<View>({ defaultView: 'hits' });
  const small = useContext(SizeContext);

  return (
    <>
      {view === 'hits' ? (
        <>
          <Hits<Brevet> hitComponent={Hit} />{' '}
          <PaginationWrapper>
            <Pagination
              style={{ alignSelf: 'center' }}
              padding={small ? 0 : 2}
            />
          </PaginationWrapper>
          {small && (
            <div style={{ margin: '0 auto' }}>
              <PoweredBy />
            </div>
          )}
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
          setSelected(items.toSorted((a, b) => a.dateNumber - b.dateNumber));
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

function GeoSearch({
  onMarkerClick,
  selected = [],
  interactive = true,
  refineOnMapMove = true,
  center = { lat: 0, lng: 0 },
  zoom = 1,
}: {
  onMarkerClick: (item: Brevet[]) => void;
  selected?: string[];
  interactive?: boolean;
  refineOnMapMove?: boolean;
  center?: { lat: number; lng: number };
  zoom?: number;
}) {
  // @ts-expect-error GeoHit wrongly has __position and __queryID
  const { items, refine, sendEvent } = useGeoSearch<Brevet>({});
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (ref.current) {
      // @ts-ignore
      ref.current.addEventListener('marker-click', handleMarkerClick);
      // @ts-ignore
      ref.current.addEventListener('map-move', handleMapMove);
    }

    function handleMarkerClick(event: CustomEvent<{ points: Brevet[] }>) {
      const hits: AlgoliaHit<Brevet>[] =
        typeof event.detail.points === 'string'
          ? JSON.parse(event.detail.points)
          : event.detail.points;

      sendEvent('click', hits, 'Hit clicked (geo)', {
        positions: undefined,
      });

      onMarkerClick(hits);
    }
    function handleMapMove(event: CustomEvent<{ bounds: LngLatBounds }>) {
      if (!refineOnMapMove) return;
      const bounds = event.detail.bounds;
      if (bounds) {
        refine({ northEast: bounds._ne, southWest: bounds._sw });
      }
    }

    return () => {
      // @ts-ignore
      ref.current?.removeEventListener('marker-click', handleMarkerClick);
      // @ts-ignore
      ref.current?.removeEventListener('map-move', handleMapMove);
    };
  }, []);

  return (
    <mapbox-map
      ref={ref}
      data-latitude={center.lat}
      data-longitude={center.lng}
      data-zoom={zoom}
      data-accesstoken={VITE_MAPBOX}
      data-interactive={interactive ? 'interactive' : 'non-interactive'}
      data-points={JSON.stringify(
        items.flatMap((item) =>
          item._geoloc.map(({ lat, lng }) => ({
            objectID: item.objectID,
            selected: selected.includes(item.objectID),
            latitude: lat,
            longitude: lng,
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
        )
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
          className={`btn ${
            values.min === dateToNum(new Date()) ? 'active' : ''
          }`}
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
          className={`btn ${
            values.max === dateToNum(new Date()) ? 'active' : ''
          }`}
        >
          now
        </button>
      </fieldset>
    </div>
  );
}
