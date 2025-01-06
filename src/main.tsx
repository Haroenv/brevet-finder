import algoliasearch from 'algoliasearch/lite';
import * as ReactDOM from 'react-dom/client';
import 'instantsearch.css/themes/satellite-min.css';
import type { InstantSearchOptions } from 'instantsearch.js';
import './map';
import { DetailsApp } from './details';
import { SearchApp } from './search';

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

const objectID = new URLSearchParams(location.search).get('objectID');
const App = objectID ? DetailsApp : SearchApp;

root.render(<App searchClient={searchClient} insights={insights} />);
