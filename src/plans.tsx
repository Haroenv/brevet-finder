import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuthState } from './auth-state';
import { supabase } from './supabase';

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

function clearPlansFromStorage() {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

async function syncPlansToSupabase(userID: string, plans: PlansByObjectID) {
  if (!supabase) {
    console.warn('Supabase not configured - plans staying local only');
    return;
  }

  const nextEntries = Object.entries(plans);

  if (nextEntries.length === 0) {
    const { error } = await supabase
      .from('user_plans')
      .delete()
      .eq('user_id', userID);
    if (error) {
      console.error('Failed to delete plans from Supabase:', error);
      throw error;
    }
    return;
  }

  const { error: upsertError } = await supabase.from('user_plans').upsert(
    nextEntries.map(([objectID, status]) => ({
      user_id: userID,
      object_id: objectID,
      status,
    })),
    { onConflict: 'user_id,object_id' }
  );

  if (upsertError) {
    console.error('Failed to upsert plans to Supabase:', upsertError);
    throw upsertError;
  }

  const { data: existingRows, error: selectError } = await supabase
    .from('user_plans')
    .select('object_id')
    .eq('user_id', userID);

  if (selectError) throw selectError;

  const keep = new Set(nextEntries.map(([objectID]) => objectID));
  const toDelete = (existingRows || [])
    .map((row) => row.object_id)
    .filter((objectID) => !keep.has(objectID));

  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('user_plans')
      .delete()
      .eq('user_id', userID)
      .in('object_id', toDelete);
    if (deleteError) throw deleteError;
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
  const { user } = useAuthState();
  const [plans, setPlans] = useState<PlansByObjectID>(readPlansFromStorage);
  const [lastRemoved, setLastRemoved] = useState<UndoState>(null);
  const hydratedUserID = useRef<string | null>(null);
  const justHydrated = useRef(false);

  useEffect(() => {
    writePlansToStorage(plans);
  }, [plans]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    if (!user) {
      if (hydratedUserID.current !== null) {
        // User just signed out — clear local storage so the next user starts fresh
        clearPlansFromStorage();
        setPlans({});
      }
      hydratedUserID.current = null;
      return;
    }

    let cancelled = false;

    supabase
      .from('user_plans')
      .select('object_id,status')
      .eq('user_id', user.id)
      .then(async ({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.error('Failed to fetch user plans from Supabase:', error);
          return;
        }

        const remotePlans = Object.fromEntries(
          (data || [])
            .filter((row) => isPlanStatus(row.status))
            .map((row) => [row.object_id, row.status as PlanStatus])
        );

        const localPlans = readPlansFromStorage();
        const mergedPlans = {
          ...localPlans,
          ...remotePlans,
        };

        justHydrated.current = true;
        setPlans(mergedPlans);
        hydratedUserID.current = user.id;
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user || !supabase) {
      return;
    }

    if (hydratedUserID.current !== user.id) {
      return;
    }

    if (justHydrated.current) {
      justHydrated.current = false;
      return;
    }

    syncPlansToSupabase(user.id, plans).catch((err) => {
      console.error('Plan sync failed:', err);
    });
  }, [plans, user?.id]);

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
