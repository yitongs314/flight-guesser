import maplibregl from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import { greatCirclePoints } from '../lib/geo';
import type { ClueMap, Reveal } from '../types';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

function planeEl(track: number): HTMLElement {
  const el = document.createElement('div');
  el.className = 'map-plane';
  el.innerHTML = `<svg viewBox="0 0 24 24" width="28" height="28" style="transform: rotate(${track}deg)"><path d="M12 2 L14 9 L21 12 L14 13.5 L14 19 L16.5 21 L12 20 L7.5 21 L10 19 L10 13.5 L3 12 L10 9 Z" fill="#ffb454" stroke="#0a1020" stroke-width="1"/></svg>`;
  return el;
}

function pulseEl(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'map-pulse';
  return el;
}

function chipEl(text: string, kind: 'origin' | 'dest'): HTMLElement {
  const el = document.createElement('div');
  el.className = `map-chip ${kind}`;
  el.textContent = text;
  return el;
}

interface Props {
  view?: ClueMap | null;
  reveal?: Reveal | null;
}

/**
 * Renders one of two map variants: a clue view (a position, exact or coarse)
 * or a reveal view (full route arc + aircraft position). Parents remount it
 * with a `key` when the content changes.
 */
export default function MapPanel({ view, reveal }: Props) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;
    if (!view && !reveal) return;

    const map = new maplibregl.Map({
      container: container.current,
      style: STYLE_URL,
      center: view ? [view.lon, view.lat] : [0, 20],
      zoom: view ? view.zoom : 1.2,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    if (view) {
      const marker = view.track !== undefined ? planeEl(view.track) : pulseEl();
      new maplibregl.Marker({ element: marker }).setLngLat([view.lon, view.lat]).addTo(map);
    }

    if (reveal) {
      const { origin, destination, snapshot } = reveal;
      const arc = greatCirclePoints(origin, destination);

      map.on('load', () => {
        map.addSource('route', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: arc } },
        });
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          paint: { 'line-color': '#4cc3ff', 'line-width': 2, 'line-dasharray': [2, 2] },
        });
      });

      new maplibregl.Marker({ element: chipEl(origin.iata || origin.icao, 'origin') })
        .setLngLat([origin.lon, origin.lat])
        .addTo(map);
      new maplibregl.Marker({ element: chipEl(destination.iata || destination.icao, 'dest') })
        .setLngLat([destination.lon, destination.lat])
        .addTo(map);
      new maplibregl.Marker({ element: planeEl(snapshot.track) })
        .setLngLat([snapshot.lon, snapshot.lat])
        .addTo(map);

      const bounds = new maplibregl.LngLatBounds();
      for (const [lon, lat] of arc) bounds.extend([lon, lat]);
      bounds.extend([snapshot.lon, snapshot.lat]);
      map.fitBounds(bounds, { padding: 60, duration: 0 });

      // The overlay may still be laying out when the map measures itself;
      // re-measure on the next frame and refit.
      requestAnimationFrame(() => {
        map.resize();
        map.fitBounds(bounds, { padding: 60, duration: 0 });
      });
    }

    return () => map.remove();
    // Parents remount via key; props are read once per mount by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div className="map-panel" ref={container} />;
}
