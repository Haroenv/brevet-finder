import algoliasearch from 'algoliasearch/lite';
import * as ReactDOM from 'react-dom/client';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useParams,
} from 'react-router-dom';
import 'instantsearch.css/themes/nova-min.css';
import type { InstantSearchOptions } from 'instantsearch.js';
import './main.css';
import './map';
import { DetailsApp } from './details';
import { SearchApp } from './search';
import {
  AccountPage,
  ForgotPasswordPage,
  LoginPage,
  ResetPasswordPage,
  SignupPage,
} from './auth';
import { AuthProvider } from './auth-state';
import { getLegacyObjectID, ROUTES } from './routes';
import { isSupabaseConfigured } from './supabase';

const rootDiv = document.getElementById('root') as HTMLElement;
const root = ReactDOM.createRoot(rootDiv);

const { VITE_ALGOLIA_APP = '', VITE_ALGOLIA_READ = '' } = import.meta.env;
if (!VITE_ALGOLIA_APP) {
  throw new Error('Missing VITE_ALGOLIA_APP env variable');
}
if (!VITE_ALGOLIA_READ) {
  throw new Error('Missing VITE_ALGOLIA_READ env variable');
}

const searchClient = algoliasearch(VITE_ALGOLIA_APP, VITE_ALGOLIA_READ);

const legacyObjectID = getLegacyObjectID();
if (window.location.pathname === ROUTES.home && legacyObjectID) {
  window.history.replaceState({}, '', ROUTES.detail(legacyObjectID));
}

const insights: InstantSearchOptions['insights'] = {
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

root.render(
  <AuthProvider>
    <BrowserRouter>
      <Routes>
        <Route
          path={ROUTES.home}
          element={
            <SearchApp searchClient={searchClient} insights={insights} />
          }
        />
        <Route
          path="/brevets/:objectID"
          element={
            <DetailsRoute searchClient={searchClient} insights={insights} />
          }
        />
        {isSupabaseConfigured && (
          <>
            <Route path={ROUTES.login} element={<LoginPage />} />
            <Route path={ROUTES.signup} element={<SignupPage />} />
            <Route
              path={ROUTES.forgotPassword}
              element={<ForgotPasswordPage />}
            />
            <Route
              path={ROUTES.resetPassword}
              element={<ResetPasswordPage />}
            />
            <Route path={ROUTES.account} element={<AccountPage />} />
          </>
        )}
        <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
      </Routes>
    </BrowserRouter>
  </AuthProvider>
);

function DetailsRoute({
  searchClient,
  insights,
}: Pick<InstantSearchOptions, 'searchClient' | 'insights'>) {
  const { objectID } = useParams<{ objectID: string }>();
  if (!objectID) {
    return <Navigate to={ROUTES.home} replace />;
  }

  return (
    <DetailsApp
      searchClient={searchClient}
      insights={insights}
      objectID={objectID}
    />
  );
}
