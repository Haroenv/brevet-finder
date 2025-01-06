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
import 'instantsearch.css/themes/satellite-min.css';
import type {
  InstantSearchOptions,
  UiState as InstantSearchUiState,
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
import { HitCard } from './hitcard';

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

const SizeContext = createContext(false);

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
  const small = useContext(SizeContext);

  return (
    <>
      {view === 'hits' ? (
        <>
          <Hits<Brevet> hitComponent={HitCard} />{' '}
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
              <HitCard hit={hit} />
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
