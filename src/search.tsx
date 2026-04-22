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
  useConfigure,
  useHits,
  useInstantSearch,
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
import { createContext, useContext, useState, useEffect } from 'react';
import { useView, ViewIndexUiState } from './connect-view';
import { dateToNum, numToDateString } from './date';
import { useMediaQuery } from './use-media-query';
import { Footer, Logo } from './shared';
import { DatePicker } from './datepicker';
import { GeoSearch } from './geosearch';
import { HitCard, getDistanceColor } from './hitcard';
import {
  buildObjectIDFilters,
  PlanFilter as TPlanFilter,
  PlanProvider,
  PLAN_STATUS_LABELS,
  usePlans,
} from './plans';

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
      <PlanProvider>
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
          <UndoToast />
        </InstantSearch>
      </PlanProvider>
    </MediaContext.Provider>
  );
}

function Sidebar({ logo = true }: { logo?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1em' }}>
      {logo && <Logo />}
      <PlanFilterWrapper>
        <Panel header="my plans">
          <PlanFilter />
        </Panel>
      </PlanFilterWrapper>
      <RangeWrapper attribute="dateNumber">
        <Panel header="date">
          <DatePicker attribute="dateNumber" />
        </Panel>
      </RangeWrapper>
      <RefinementListWrapper attribute="category">
        <Panel header="distance">
          <RefinementList
            attribute="category"
            limit={6}
            showMoreLimit={40}
            transformItems={(items) =>
              items
                .toSorted(
                  (a, b) =>
                    [
                      '<200',
                      '200',
                      '300',
                      '400',
                      '600',
                      '1000',
                      '1200+',
                    ].indexOf(a.value) -
                    [
                      '<200',
                      '200',
                      '300',
                      '400',
                      '600',
                      '1000',
                      '1200+',
                    ].indexOf(b.value)
                )
                .map((item) => {
                  const distanceColor = getDistanceColor(
                    {
                      '<200': 0,
                      '200': 200,
                      '300': 300,
                      '400': 400,
                      '600': 600,
                      '1000': 1000,
                      '1200+': 1200,
                    }[item.value] || 0
                  );
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
                        {item.label}
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
                  if (item.attribute === 'category') {
                    return {
                      ...item,
                      label: 'distance category',
                      refinements: item.refinements.map((refinement) => ({
                        ...refinement,
                        label: refinement.label,
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

function PlanFilterWrapper({ children }: { children: React.ReactNode }) {
  const { results } = useInstantSearch();
  const { plans } = usePlans();

  return (
    <div
      hidden={
        !results || results.__isArtificial || Object.keys(plans).length === 0
      }
    >
      {children}
    </div>
  );
}

function PlanFilter() {
  const { objectIDsForFilter, countByFilter, plans } = usePlans();
  const [selected, setSelected] = useState<TPlanFilter>('all');
  useConfigure({
    filters: buildObjectIDFilters(objectIDsForFilter(selected, 1000)),
  });

  useEffect(() => {
    if (countByFilter(selected) === 0 && selected !== 'all') {
      setSelected('all');
    }
  }, [selected, countByFilter, setSelected, plans]);

  const options: { value: TPlanFilter; label: string }[] = [
    { value: 'all', label: 'all' },
    ...Object.entries(PLAN_STATUS_LABELS).map(([value, label]) => ({
      value: value as TPlanFilter,
      label,
    })),
  ];

  return (
    <>
      <div className="ais-RefinementList">
        <ul className="ais-RefinementList-list">
          {options.map((option) => {
            const isRefined = selected === option.value;
            const count =
              option.value === 'all' ? null : countByFilter(option.value);

            return (
              <li
                key={option.value}
                className={`ais-RefinementList-item ${isRefined ? 'ais-RefinementList-item--selected' : ''} ${count === 0 ? 'ais-RefinementList-item--disabled' : ''}`}
              >
                <label
                  className={`ais-RefinementList-label  ${count === 0 ? 'ais-RefinementList-label--disabled' : ''}`}
                >
                  <input
                    className="ais-RefinementList-checkbox"
                    type="checkbox"
                    name="plan-filter"
                    checked={isRefined}
                    disabled={count === 0}
                    onChange={() => {
                      setSelected((current) =>
                        current === option.value ? 'all' : option.value
                      );
                    }}
                  />
                  <span className="ais-RefinementList-labelText">
                    {option.label}
                  </span>
                  {count !== null && (
                    <span className="ais-RefinementList-count">{count}</span>
                  )}
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}

function UndoToast() {
  const { lastRemoved, undo } = usePlans();

  if (!lastRemoved) return null;

  return (
    <div className="undo-toast">
      <span className="undo-toast__message">removed from your plans</span>
      <button type="button" className="undo-toast__button" onClick={undo}>
        undo
      </button>
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
  const [selectedIDs, setSelectedIDs] = useState<string[]>([]);
  const { items } = useHits<Brevet>();

  return (
    <>
      <Configure hitsPerPage={500} />
      <GeoSearch
        onMarkerClick={(objectIDs) => {
          setSelectedIDs(objectIDs);
        }}
        selected={selectedIDs}
      />
      <div className="ais-Hits">
        <ul className="ais-Hits-list">
          {items
            .toSorted((a, b) => {
              const aSelected = selectedIDs.includes(a.objectID);
              const bSelected = selectedIDs.includes(b.objectID);
              if (aSelected && !bSelected) return -1;
              if (!aSelected && bSelected) return 1;
              return a.dateNumber - b.dateNumber;
            })
            .map((hit) => (
              <li
                key={hit.objectID}
                className={`ais-Hits-item${
                  selectedIDs.length > 0 && selectedIDs.includes(hit.objectID)
                    ? ' ais-Hits-item--selected'
                    : ''
                }`}
              >
                <HitCard hit={hit} />
              </li>
            ))}
        </ul>
      </div>
    </>
  );
}
