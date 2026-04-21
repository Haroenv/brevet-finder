import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type PlanStatus = 'interested' | 'committed';
export type PlanFilter = 'all' | PlanStatus;

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  interested: 'interested',
  committed: 'going',
};

export const PLAN_STATUS_ICONS: Record<
  PlanStatus,
  { inactive: string; active: string }
> = {
  interested: {
    inactive: '☆',
    active: '★',
  },
  committed: {
    inactive: '○',
    active: '✓',
  },
};

const PLAN_STATUSES: PlanStatus[] = ['interested', 'committed'];

const STORAGE_KEY = 'brevet-plans-v1';
const MAX_FILTER_IDS = 1000;

type PlansByObjectID = Record<string, PlanStatus>;

type UndoState = {
  objectID: string;
  status: PlanStatus;
} | null;

type PlansContextValue = {
  plans: PlansByObjectID;
  getPlanStatus: (objectID: string) => PlanStatus | undefined;
  setPlanStatus: (objectID: string, status: PlanStatus | null) => void;
  objectIDsForFilter: (filter: PlanFilter, limit?: number) => string[];
  countByFilter: (filter: PlanFilter) => number;
  lastRemoved: UndoState;
  undo: () => void;
};

const PlansContext = createContext<PlansContextValue>({
  plans: {},
  getPlanStatus: () => undefined,
  setPlanStatus: () => {},
  objectIDsForFilter: () => [],
  countByFilter: () => 0,
  lastRemoved: null,
  undo: () => {},
});

function isPlanStatus(value: unknown): value is PlanStatus {
  return (
    typeof value === 'string' && PLAN_STATUSES.includes(value as PlanStatus)
  );
}

function readPlansFromStorage(): PlansByObjectID {
  if (typeof localStorage === 'undefined') {
    return {};
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(([, status]) => isPlanStatus(status))
    );
  } catch {
    return {};
  }
}

function writePlansToStorage(plans: PlansByObjectID) {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
  } catch {
    // ignore write failures (private mode/quota)
  }
}

function getObjectIDsForFilter(
  plans: PlansByObjectID,
  filter: PlanFilter,
  limit: number = MAX_FILTER_IDS
) {
  if (filter === 'all') {
    return [];
  }

  const entries = Object.entries(plans);
  const ids = entries
    .filter(([, status]) => status === filter)
    .map(([objectID]) => objectID);

  return ids.slice(0, limit);
}

export function buildObjectIDFilters(objectIDs: string[]) {
  if (objectIDs.length === 0) {
    return '';
  }

  return objectIDs
    .map((objectID) => `objectID:"${escapeAlgoliaFilterValue(objectID)}"`)
    .join(' OR ');
}

function escapeAlgoliaFilterValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const [plans, setPlans] = useState<PlansByObjectID>(readPlansFromStorage);
  const [lastRemoved, setLastRemoved] = useState<UndoState>(null);

  useEffect(() => {
    writePlansToStorage(plans);
  }, [plans]);

  useEffect(() => {
    if (!lastRemoved) return;
    const timer = setTimeout(() => setLastRemoved(null), 5000);
    return () => clearTimeout(timer);
  }, [lastRemoved]);

  const getPlanStatus = useCallback(
    (objectID: string) => {
      return plans[objectID];
    },
    [plans]
  );

  const setPlanStatus = useCallback(
    (objectID: string, status: PlanStatus | null) => {
      setPlans((current) => {
        if (!status) {
          if (!(objectID in current)) {
            return current;
          }

          const removedStatus = current[objectID];
          setLastRemoved({ objectID, status: removedStatus });

          const { [objectID]: _, ...rest } = current;
          return rest;
        }

        if (current[objectID] === status) {
          return current;
        }

        return {
          ...current,
          [objectID]: status,
        };
      });
    },
    []
  );

  const undo = useCallback(() => {
    if (!lastRemoved) return;
    setPlanStatus(lastRemoved.objectID, lastRemoved.status);
    setLastRemoved(null);
  }, [lastRemoved, setPlanStatus]);

  const objectIDsForFilter = useCallback(
    (filter: PlanFilter, limit: number = MAX_FILTER_IDS) =>
      getObjectIDsForFilter(plans, filter, limit),
    [plans]
  );

  const countByFilter = useCallback(
    (filter: PlanFilter) => getObjectIDsForFilter(plans, filter).length,
    [plans]
  );

  const value = useMemo(
    () => ({
      plans,
      getPlanStatus,
      setPlanStatus,
      objectIDsForFilter,
      countByFilter,
      lastRemoved,
      undo,
    }),
    [
      plans,
      getPlanStatus,
      setPlanStatus,
      objectIDsForFilter,
      countByFilter,
      lastRemoved,
      undo,
    ]
  );

  return (
    <PlansContext.Provider value={value}>{children}</PlansContext.Provider>
  );
}

export function usePlans() {
  return useContext(PlansContext);
}
