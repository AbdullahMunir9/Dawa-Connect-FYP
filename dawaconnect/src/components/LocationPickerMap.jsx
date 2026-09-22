import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle, MapPin, Search } from 'lucide-react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';

// Use the bundler's URLs directly. Icon.Default prepends an auto-detected image
// directory, which can break Vite asset URLs in the Electron renderer.
const pharmacyMarkerIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
});
const PAKISTAN_CENTER = [30.3753, 69.3451];

function MapClickHandler({ onSelect }) {
  useMapEvents({ click: (event) => onSelect(event.latlng.lat, event.latlng.lng) });
  return null;
}

function MapViewport({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, 17, { animate: true, duration: 0.8 });
  }, [map, position]);
  return null;
}

export default function LocationPickerMap({ latitude, longitude, confirmed, onChange }) {
  const [position, setPosition] = useState(() => confirmed ? [latitude, longitude] : null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(Boolean(confirmed));
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const active = useRef(true);
  const working = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  const selectPoint = (lat, lng) => {
    if (working.current || !searched) return;
    setPosition([Number(lat.toFixed(6)), Number(lng.toFixed(6))]);
    onChange(null);
    setError('');
  };

  const callLocation = async (action, payload) => {
    if (!window.electronAPI?.location?.[action]) throw new Error('Open this registration page in the updated Pharmacy desktop app.');
    const response = await window.electronAPI.location[action](payload);
    if (!response.ok) throw new Error(response.error || 'The address service could not complete this request.');
    return response.data;
  };

  const search = async () => {
    if (working.current) return;
    if (query.trim().length < 3) { setError('Enter at least 3 characters of an address or nearby landmark.'); return; }
    working.current = true;
    setBusy('search');
    setError('');
    setResults([]);
    setPosition(null);
    setSearched(false);
    onChange(null);
    try {
      const places = await callLocation('search', query.trim());
      if (!active.current) return;
      setResults(places);
      setSearched(places.length > 0);
      if (!places.length) setError('No matching address found. Try a nearby landmark and include the city.');
    } catch (e) {
      if (active.current) setError(e.message);
    } finally {
      working.current = false;
      if (active.current) setBusy('');
    }
  };

  const confirm = async () => {
    if (!position || working.current) return;
    working.current = true;
    setBusy('confirm');
    setError('');
    onChange(null);
    try {
      const location = await callLocation('confirm', { latitude: position[0], longitude: position[1] });
      if (active.current) onChange(location);
    } catch (e) {
      if (active.current) setError(e.message);
    } finally {
      working.current = false;
      if (active.current) setBusy('');
    }
  };

  return (
    <div className="location-picker">
      <label className="form-label" htmlFor="pharmacy-location-search">Find your pharmacy on the map *</label>
      <p className="location-picker-help">Search an address or nearby landmark in Pakistan, select a result, then move the pin to your pharmacy entrance and confirm it.</p>
      <div className="location-search-row">
        <input id="pharmacy-location-search" className="form-control" value={query} maxLength={300} disabled={Boolean(busy)}
          placeholder="e.g. Liberty Market, Gulberg, Lahore"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); search(); } }} />
        <button type="button" className="btn btn-outline" onClick={search} disabled={Boolean(busy)}>
          <Search size={16} /> {busy === 'search' ? 'Searching...' : 'Search address'}
        </button>
      </div>
      {results.length > 0 && <ul className="location-search-results" aria-label="Matching addresses">
        {results.map((place, index) => <li key={index}>
          <button type="button" disabled={Boolean(busy)} onClick={() => { selectPoint(place.latitude, place.longitude); setResults([]); }}>
            <MapPin size={16} /><span>{place.label}</span>
          </button>
        </li>)}
      </ul>}
      <div className="location-picker-map">
        <MapContainer center={position || PAKISTAN_CENTER} zoom={position ? 17 : 5} scrollWheelZoom>
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapClickHandler onSelect={(lat, lng) => { if (position) selectPoint(lat, lng); }} />
          <MapViewport position={position} />
          {position && <Marker position={position} icon={pharmacyMarkerIcon} alt="Pharmacy location" draggable={!busy} eventHandlers={{
            dragend(event) { const point = event.target.getLatLng(); selectPoint(point.lat, point.lng); },
          }} />}
        </MapContainer>
      </div>
      <p className="location-picker-help">Address search powered by <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Geoapify</a>. Search text and the confirmed pin are sent to the address service.</p>
      {position && <div className="location-picker-coordinates">
        <MapPin size={15} />
        <span>Latitude: <strong>{position[0].toFixed(6)}</strong></span>
        <span>Longitude: <strong>{position[1].toFixed(6)}</strong></span>
      </div>}
      <button type="button" className="btn btn-primary" onClick={confirm} disabled={!position || Boolean(busy)}>
        <CheckCircle size={16} /> {busy === 'confirm' ? 'Looking up address...' : 'Confirm exact location'}
      </button>
      <p className={confirmed ? 'location-picker-help' : 'location-picker-warning'} role="status">
        {confirmed ? 'Location confirmed. The address fields below are filled from this pin. Moving it requires confirmation again.'
          : 'You must confirm the pharmacy pin before continuing. A search result alone is not a confirmed location.'}
      </p>
      {error && <div className="location-picker-error" role="alert">{error}</div>}
    </div>
  );
}
