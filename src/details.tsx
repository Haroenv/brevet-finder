import { Configure, InstantSearch, useHits } from 'react-instantsearch';
import 'instantsearch.css/themes/satellite-min.css';
import type { InstantSearchOptions } from 'instantsearch.js';
import type { Brevet } from './types';
import './map';
import { useEffect } from 'react';
import { Footer, Logo } from './shared';
import { GeoSearch } from './geosearch';
import { HitCard } from './hitcard';

const objectID = new URLSearchParams(location.search).get('objectID');

export function DetailsApp({
  searchClient,
  insights,
}: Pick<InstantSearchOptions, 'searchClient' | 'insights'>) {
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
      <WindowTitle />
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

function WindowTitle() {
  const { items } = useHits<Brevet>();

  useEffect(() => {
    if (items[0]) {
      const brevet = items[0];
      const location = brevet.city || brevet.region || brevet.country;
      document.title = `${location} ${brevet.date}  ${brevet.distance}km - Brevet Finder`;
    }
  }, [items[0]?.objectID]);

  return null;
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
        <HitCard hit={items[0]} />
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
