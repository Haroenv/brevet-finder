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
  usePagination,
  useRange,
  useRefinementList,
} from 'react-instantsearch';
import { history } from 'instantsearch.js/es/lib/routers';
import type {
  InstantSearchOptions,
  UiState as InstantSearchUiState,
  Hit,
} from 'instantsearch.js';
import type { Brevet } from './types';
import './map';
import { createContext, useContext, useState } from 'react';
import { useView, ViewIndexUiState } from './connect-view';
import { dateToNum, numToDateString } from './date';
import { useMediaQuery } from './use-media-query';
import { Footer, Logo } from './shared';
import { DatePicker } from './datepicker';
import { GeoSearch } from './geosearch';
import { HitCard, getDistanceColor } from './hitcard';

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

export function SearchApp({
  searchClient,
  insights,
}: Pick<InstantSearchOptions, 'searchClient' | 'insights'>) {
  const size = useMediaQuery('(max-width: 800px)') ? 'small' : 'large';
  const theme = useMediaQuery('(prefers-color-scheme: dark)')
    ? 'dark'
    : 'light';

  return (
    <MediaContext.Provider value={{ size, theme }}>
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
        <Configure hitsPerPage={isSmallSize(size) ? 10 : 18} />
        <div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isSmallSize(size)
                ? '1fr'
                : 'minmax(330px, 1fr) 4fr',
              gap: '1em',
            }}
          >
            <div hidden={isSmallSize(size)}>
              <Sidebar />
            </div>
            <Main />
          </div>
          <Footer />
        </div>
      </InstantSearch>
    </MediaContext.Provider>
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
                .map((item) => {
                  const distanceColor = getDistanceColor(parseInt(item.value));
                  return {
                    ...item,
                    label: (
                      <div
                        className="hit-card__badge hit-card__badge--distance"
                        style={{
                          background: distanceColor.bg,
                          color: distanceColor.text,
                        }}
                      >
                        {item.label} km
                      </div>
                    ) as unknown as string,
                  };
                })
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
  const { size, theme } = useContext(MediaContext);
  const [showRefinements, setShowRefinements] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1em' }}>
      <SearchBox />
      <div>
        {isSmallSize(size) ? (
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
              flexDirection: isSmallSize(size) ? 'column' : 'row',
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
                flexDirection: isSmallSize(size) ? 'column' : 'row',
                alignItems: 'center',
                gap: '.5em',
              }}
            >
              <ViewSwitcher />
              <Stats />
              <PoweredBy theme={theme} style={{ translate: '0 1.5px' }} />
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
            backgroundColor:
              'rgba(var(--ais-background-color-rgb), var(--ais-background-color-alpha, 1))',
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
            <ClearRefinements
              translations={{ resetButtonText: 'reset' }}
              classNames={{ button: 'btn', disabledButton: 'btn' }}
            />
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

function isSmallSize(size: 'small' | 'large') {
  return size === 'small';
}

const MediaContext = createContext({
  size: 'small' as 'small' | 'large',
  theme: 'light' as 'light' | 'dark',
});

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

type View = 'hits' | 'geo';

function Results() {
  const { view } = useView<View>({ defaultView: 'hits' });
  const { size } = useContext(MediaContext);

  return (
    <>
      {view === 'hits' ? (
        <>
          <Hits<Brevet> hitComponent={HitCard} />{' '}
          <PaginationWrapper>
            <Pagination
              style={{ alignSelf: 'center' }}
              padding={isSmallSize(size) ? 0 : 2}
            />
          </PaginationWrapper>
          {isSmallSize(size) && (
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
              <HitCard hit={hit as Hit<Brevet>} />
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
