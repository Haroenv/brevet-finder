import { useEffect, useRef } from 'react';
import { Brevet } from './types';
import { useGeoSearch } from 'react-instantsearch';
import { type Hit as AlgoliaHit } from 'instantsearch.js';
import { LngLatBounds } from 'mapbox-gl';

const { VITE_MAPBOX = '' } = import.meta.env;
if (!VITE_MAPBOX) {
  throw new Error('Missing VITE_MAPBOX env variable');
}

export function GeoSearch({
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
