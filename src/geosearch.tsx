import { useEffect, useRef } from 'react';
import { Brevet } from './types';
import { useGeoSearch } from 'react-instantsearch';
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
  onMarkerClick: (objectIDs: string[]) => void;
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
    const element = ref.current;
    if (!element) return;

    const handleMarkerClick = (event: Event) => {
      const customEvent = event as CustomEvent<{
        points: { objectID: string }[];
      }>;
      const rawPoints: { objectID: string }[] =
        typeof customEvent.detail.points === 'string'
          ? JSON.parse(customEvent.detail.points)
          : customEvent.detail.points;
      sendEvent('click', rawPoints as any, 'Hit clicked (geo)', {
        positions: undefined,
      });
      onMarkerClick(rawPoints.map((p) => p.objectID));
    };

    const handleMapMove = (event: Event) => {
      if (!refineOnMapMove) return;
      const customEvent = event as CustomEvent<{ bounds: LngLatBounds }>;
      const bounds = customEvent.detail.bounds;
      if (bounds) {
        refine({ northEast: bounds._ne, southWest: bounds._sw });
      }
    };

    element.addEventListener('marker-click', handleMarkerClick);
    element.addEventListener('map-move', handleMapMove);

    return () => {
      element.removeEventListener('marker-click', handleMarkerClick);
      element.removeEventListener('map-move', handleMapMove);
    };
  }, [refineOnMapMove, refine, sendEvent, onMarkerClick]);

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
              (item.category || item.distance) + ' km',
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
