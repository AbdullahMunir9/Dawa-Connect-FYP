'use client';

import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import styles from './HealthcareMapCanvas.module.css';

const COLORS = { registered: '#087f78', pharmacy: '#3973d7', hospital: '#c65770', clinic: '#8556b8' };
const EMPTY = { type: 'FeatureCollection', features: [] };
function circle(center, radius) {
  if (!center) return EMPTY;
  const lat = center.latitude * Math.PI / 180, lng = center.longitude * Math.PI / 180, distance = radius / 6371;
  const ring = Array.from({ length: 97 }, (_, i) => {
    const angle = i * Math.PI * 2 / 96;
    const y = Math.asin(Math.sin(lat) * Math.cos(distance) + Math.cos(lat) * Math.sin(distance) * Math.cos(angle));
    const x = lng + Math.atan2(Math.sin(angle) * Math.sin(distance) * Math.cos(lat), Math.cos(distance) - Math.sin(lat) * Math.sin(y));
    return [x * 180 / Math.PI, y * 180 / Math.PI];
  });
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
}

export default function HealthcareMapCanvas({ center, radius = 10, facilities = [], selectedId, onSelect, route = [] }) {
  const container = useRef(null), mapRef = useRef(null), onSelectRef = useRef(onSelect), facilitiesRef = useRef(facilities);
  const [ready, setReady] = useState(false), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  onSelectRef.current = onSelect;
  facilitiesRef.current = facilities;

  useEffect(() => {
    let map, disposed = false, hasLoaded = false;
    setReady(false); setError('');
    const loadTimer = setTimeout(() => {
      if (!disposed && !hasLoaded) setError('The map is taking longer than expected. Check your connection or retry; the healthcare list remains available.');
    }, 25000);
    try {
      maplibregl.setWorkerUrl('/api/healthcare/renderer/maplibre-gl-worker.mjs');
      map = new maplibregl.Map({
        container: container.current,
        style: '/api/healthcare/basemap',
        center: [74.3587, 31.5204], zoom: 10,
        attributionControl: { compact: true, customAttribution: 'Search & routes: <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Geoapify</a> | Map: <a href="https://openfreemap.org/" target="_blank" rel="noreferrer">OpenFreeMap</a>' },
        maxZoom: 18, minZoom: 4
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
      map.on('load', () => {
        if (disposed) return;
        hasLoaded = true;
        clearTimeout(loadTimer);
        const font = map.getStyle().layers.find((layer) => Array.isArray(layer.layout?.['text-font']) && layer.layout['text-font'].every((value) => typeof value === 'string'))?.layout['text-font'] || ['Noto Sans Regular'];
        map.addSource('search-radius', { type: 'geojson', data: EMPTY });
        map.addLayer({ id: 'search-radius-fill', type: 'fill', source: 'search-radius', paint: { 'fill-color': '#0d9488', 'fill-opacity': 0.035 } });
        map.addLayer({ id: 'search-radius-line', type: 'line', source: 'search-radius', paint: { 'line-color': '#0d9488', 'line-opacity': 0.5, 'line-width': 1.5, 'line-dasharray': [3, 3] } });
        map.addSource('healthcare-facilities', { type: 'geojson', data: EMPTY, cluster: true, clusterMaxZoom: 13, clusterRadius: 42 });
        map.addLayer({ id: 'healthcare-clusters', type: 'circle', source: 'healthcare-facilities', filter: ['has', 'point_count'], paint: { 'circle-color': '#155e66', 'circle-radius': ['step', ['get', 'point_count'], 19, 10, 23, 50, 28], 'circle-stroke-width': 4, 'circle-stroke-color': '#fff' } });
        map.addLayer({ id: 'healthcare-cluster-count', type: 'symbol', source: 'healthcare-facilities', filter: ['has', 'point_count'], layout: { 'text-field': '{point_count_abbreviated}', 'text-size': 12, 'text-font': font }, paint: { 'text-color': '#fff' } });
        map.addLayer({ id: 'healthcare-points', type: 'circle', source: 'healthcare-facilities', filter: ['!', ['has', 'point_count']], paint: { 'circle-radius': ['case', ['boolean', ['get', 'selected'], false], 14, 10], 'circle-color': ['get', 'color'], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3 } });
        map.addLayer({ id: 'healthcare-symbols', type: 'symbol', source: 'healthcare-facilities', filter: ['!', ['has', 'point_count']], layout: { 'text-field': '+', 'text-size': 17, 'text-allow-overlap': true, 'text-font': font }, paint: { 'text-color': '#fff' } });
        map.addSource('healthcare-route', { type: 'geojson', data: EMPTY });
        map.addLayer({ id: 'healthcare-route-outline', type: 'line', source: 'healthcare-route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#fff', 'line-width': 9 } });
        map.addLayer({ id: 'healthcare-route-line', type: 'line', source: 'healthcare-route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#2563eb', 'line-width': 5 } });
        map.addSource('search-origin', { type: 'geojson', data: EMPTY });
        map.addLayer({ id: 'search-origin-point', type: 'circle', source: 'search-origin', paint: { 'circle-radius': 7, 'circle-color': '#162d49', 'circle-stroke-color': '#fff', 'circle-stroke-width': 3 } });
        setReady(true);
        setError('');
      });
      map.on('click', 'healthcare-points', (event) => {
        const facility = facilitiesRef.current.find((item) => String(item.id) === event.features?.[0]?.properties?.id);
        if (facility) onSelectRef.current?.(facility);
      });
      map.on('click', 'healthcare-clusters', async (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        try {
          const zoom = await map.getSource('healthcare-facilities').getClusterExpansionZoom(feature.properties.cluster_id);
          if (!disposed) map.easeTo({ center: feature.geometry.coordinates, zoom });
        } catch { /* A refreshed search may replace this cluster. */ }
      });
      for (const layer of ['healthcare-points', 'healthcare-clusters']) {
        map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
      }
      map.on('error', () => { if (!disposed) setError('Some map tiles could not load. You can still use the healthcare list.'); });
    } catch { setError('Interactive maps need WebGL support. Use the healthcare list or try a different browser.'); }
    const observer = new ResizeObserver(() => map?.resize());
    if (container.current) observer.observe(container.current);
    return () => { disposed = true; clearTimeout(loadTimer); observer.disconnect(); map?.remove(); mapRef.current = null; };
  }, [attempt]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.getSource('search-radius').setData(circle(center, radius));
    map.getSource('search-origin').setData(center ? { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [center.longitude, center.latitude] } } : EMPTY);
    if (center) {
      const polygon = circle(center, radius).geometry.coordinates[0];
      const bounds = polygon.reduce((box, point) => box.extend(point), new maplibregl.LngLatBounds());
      map.fitBounds(bounds, { padding: 45, duration: 750, maxZoom: 15 });
    }
  }, [ready, center, radius]);

  useEffect(() => {
    if (!ready) return;
    mapRef.current?.getSource('healthcare-facilities')?.setData({ type: 'FeatureCollection', features: facilities.map((item) => ({ type: 'Feature', properties: { id: String(item.id), selected: item.id === selectedId, color: COLORS[item.registered ? 'registered' : item.type] }, geometry: { type: 'Point', coordinates: [item.longitude, item.latitude] } })) });
  }, [ready, facilities, selectedId]);

  useEffect(() => {
    if (!ready || !selectedId) return;
    const item = facilitiesRef.current.find((item) => item.id === selectedId);
    if (item) mapRef.current?.easeTo({ center: [item.longitude, item.latitude], zoom: Math.max(14, mapRef.current.getZoom()), duration: 600 });
  }, [ready, selectedId]);

  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    map?.getSource('healthcare-route')?.setData(route.length > 1 ? { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: route.map(([lat, lng]) => [lng, lat]) } } : EMPTY);
    if (route.length > 1) {
      const bounds = route.reduce((box, [lat, lng]) => box.extend([lng, lat]), new maplibregl.LngLatBounds());
      map.fitBounds(bounds, { padding: 65, duration: 750, maxZoom: 16 });
    }
  }, [ready, route]);

  return <div className={styles.wrapper} data-map-ready={ready}>
    <div ref={container} className={styles.map} role="region" aria-label="Healthcare locations map. Select a facility in the results list for keyboard-accessible details." />
    {!ready && !error && <div className={styles.status} role="status">Loading your healthcare map…</div>}
    {error && <div className={styles.status} role="alert">{error}<button type="button" onClick={() => setAttempt((value) => value + 1)}>Retry map</button></div>}
    {!center && ready && <div className={styles.hint}>Choose your location or search an area to find nearby care.</div>}
  </div>;
}
