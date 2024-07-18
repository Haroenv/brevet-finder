import {
  GeoJSONSource,
  Map,
  Marker,
  Popup,
  type IControl,
  type MapOptions,
} from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { HTMLAttributes, Ref } from 'react';
import { Brevet } from '../types';
import { debounce } from './debounce';

declare module 'react/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements {
      'mapbox-map': HTMLAttributes<HTMLDivElement> & { ref: Ref<HTMLElement> };
    }
  }
}

export interface Point {
  objectID: string;
  selected: boolean;
  latitude: number;
  longitude: number;
  title: string;
  link: string;
  _item: Brevet;
}

class MapboxMap extends HTMLElement {
  // @ts-ignore
  map: Map;
  // @ts-ignore
  markers: Array<Marker>;
  // @ts-ignore
  container: HTMLDivElement;

  connectedCallback() {
    this.container = Object.assign(document.createElement('div'), {
      style: 'height: 80ch',
    });
    this.parentNode!.insertBefore(this.container, this);

    if (
      !this.dataset.latitude ||
      !this.dataset.longitude ||
      !this.dataset.zoom ||
      !this.dataset.accesstoken ||
      !this.dataset.points
    ) {
      throw new Error('Missing required attributes', this.dataset);
    }

    const options = {
      container: this.container,
      accessToken: this.dataset.accesstoken,
      interactive: this.dataset.interactive === 'interactive',
      center: [
        parseFloat(this.dataset.longitude),
        parseFloat(this.dataset.latitude),
      ],
      zoom: parseFloat(this.dataset.zoom),
      style: this.dataset.mapstyle,
    } satisfies MapOptions;

    this.map = new Map(options);

    this.map.on(
      'move',
      debounce(() => {
        this.dispatchEvent(
          new CustomEvent('map-move', {
            detail: { bounds: this.map.getBounds() },
          })
        );
      }, 100)
    );

    class ResetControl implements IControl {
      _container: HTMLDivElement;
      _button: HTMLButtonElement;
      _map?: Map;

      constructor() {
        this._button = document.createElement('button');
        this._button.className = 'mapboxgl-ctrl-geolocate';
        this._button.type = 'button';
        this._button.title = 'Reset';
        this._button.innerHTML =
          '<span class="mapboxgl-ctrl-icon" aria-hidden="true" title="Reset location"></span>';
        this._button.addEventListener('click', this._reset);

        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl-group mapboxgl-ctrl';
        this._container.appendChild(this._button);
      }

      onAdd(map: Map) {
        this._map = map;
        return this._container;
      }

      onRemove() {
        this._container!.parentNode!.removeChild(this._container!);
        this._map = undefined;
      }

      _reset = () => {
        this._map!.setZoom(options.zoom).setCenter(options.center);
      };
    }

    this.map.addControl(new ResetControl(), 'top-right');

    this.dispatchEvent(
      new CustomEvent('map-move', { detail: { bounds: this.map.getBounds() } })
    );

    this.map.on('load', () => {
      this.map
        .addSource('points', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [],
          },
          cluster: true,
          clusterMaxZoom: 3,
        })
        .addLayer({
          id: 'clusters',
          type: 'circle',
          source: 'points',
          filter: ['has', 'point_count'],
          paint: {
            'circle-radius': [
              'step',
              ['get', 'point_count'],
              20,
              100,
              30,
              750,
              40,
            ],
            'circle-color': '#b6b7d5',
            'circle-stroke-width': 1,
            'circle-stroke-color': '#fff',
          },
        })
        .addLayer({
          id: 'unclustered-points',
          type: 'circle',
          source: 'points',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-radius': 6,
            'circle-color': [
              'case',
              ['boolean', ['get', 'selected'], true],
              '#3c4fe0',
              '#b6b7d5',
            ],
            'circle-stroke-width': 1,
            'circle-stroke-color': '#fff',
          },
        })
        .on('click', 'clusters', (e) => {
          const features = this.map.queryRenderedFeatures(e.point, {
            layers: ['clusters'],
          });
          const feature = features[0] as any;
          const clusterId = feature.properties.cluster_id;
          this.map
            .getSource<GeoJSONSource>('points')!
            .getClusterExpansionZoom(clusterId, (err, zoom) => {
              if (err) return;

              this.map.easeTo({
                center: feature.geometry.coordinates,
                zoom: zoom!,
              });
            });
        })
        .on('click', 'unclustered-points', (e) => {
          const features = this.map.queryRenderedFeatures(e.point, {
            layers: ['unclustered-points'],
          }) as any;

          this.dispatchEvent(
            new CustomEvent('marker-click', {
              detail: {
                points: features.map((f: any) =>
                  typeof f.properties._item === 'string'
                    ? JSON.parse(f.properties._item)
                    : f.properties._item
                ),
              },
            })
          );
        });

      this.attributeChangedCallback('data-points', '', this.dataset.points!);
    });
  }

  disconnectedCallback() {
    this.container.parentNode!.removeChild(this.container);
    this.map.remove();
  }

  static observedAttributes = ['data-points'];
  attributeChangedCallback(
    name: 'data-points',
    oldValue: string,
    newValue: string
  ) {
    if (name === 'data-points' && oldValue !== newValue && this.map) {
      const points: Array<Point> = JSON.parse(this.dataset.points!);

      this.map.getSource<GeoJSONSource>('points')?.setData({
        type: 'FeatureCollection',
        features: points.map((point) => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [point.longitude, point.latitude],
          },
          properties: point,
        })),
      });
    }
  }
}

window.customElements.define('mapbox-map', MapboxMap);
