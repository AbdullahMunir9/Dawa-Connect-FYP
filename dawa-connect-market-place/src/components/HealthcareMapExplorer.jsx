"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, Building2, CarFront, Check, ChevronDown,
  CircleHelp, Clock3, Compass, Cross, ExternalLink, Footprints,
  Hospital, Info, List, LoaderCircle, LocateFixed, Map, MapPin,
  Navigation, Phone, Pill, RefreshCw, Search, ShieldCheck, SlidersHorizontal, X,
} from "lucide-react";
import styles from "./HealthcareMapExplorer.module.css";

const HealthcareMapCanvas = dynamic(() => import("./HealthcareMapCanvas"), {
  ssr: false,
  loading: () => <div className={styles.mapLoading}><LoaderCircle className={styles.spin} size={26} /><span>Preparing your map…</span></div>,
});

const TYPE_META = {
  pharmacy: { label: "Pharmacies", single: "Pharmacy", Icon: Pill },
  hospital: { label: "Hospitals", single: "Hospital", Icon: Hospital },
  clinic: { label: "Clinics", single: "Clinic", Icon: Cross },
};
const ALL_TYPES = { pharmacy: true, hospital: true, clinic: true };
const EMPTY_RESULTS = { registered: [], external: [], warnings: [] };

function formatDistance(distance) {
  if (!Number.isFinite(distance)) return "Distance unavailable";
  return distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`;
}

function formatDuration(minutes) {
  if (!Number.isFinite(minutes)) return "Time unavailable";
  const rounded = Math.max(1, Math.round(minutes));
  return rounded < 60 ? `${rounded} min` : `${Math.floor(rounded / 60)} hr ${rounded % 60} min`;
}

async function readResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || "We couldn’t complete this request. Please try again.");
  return payload;
}

function FacilityCard({ facility, selected, onSelect }) {
  const { Icon, single } = TYPE_META[facility.type] || TYPE_META.clinic;
  return (
    <button
      type="button"
      className={`${styles.facilityCard} ${selected ? styles.facilitySelected : ""}`}
      onClick={() => onSelect(facility)}
      aria-pressed={selected}
      aria-label={`${facility.name}, ${single}, ${formatDistance(facility.distanceKm)} away. View details`}
    >
      <span className={`${styles.facilityIcon} ${styles[facility.type]} ${facility.registered ? styles.memberIcon : ""}`}><Icon size={20} strokeWidth={1.8} /></span>
      <span className={styles.facilityText}>
        <span className={styles.facilityName}>{facility.name}</span>
        <span className={styles.facilityAddress}>{facility.address || facility.city || "Select to view this location"}</span>
        <span className={styles.facilityMeta}>
          <span>{single}</span><span className={styles.metaDot}>·</span>
          <span>{formatDistance(facility.distanceKm)}</span>
          {typeof facility.isOpen === "boolean" && <><span className={styles.metaDot}>·</span><span className={facility.isOpen ? styles.open : styles.closed}>{facility.isOpen ? "Open now" : "Closed now"}</span></>}
        </span>
        {facility.registered && <span className={styles.memberLabel}><ShieldCheck size={12} /> On DAWA Connect</span>}
      </span>
      <ArrowRight className={styles.cardArrow} size={17} aria-hidden="true" />
    </button>
  );
}

export default function HealthcareMapExplorer() {
  const [center, setCenter] = useState(null);
  const [deviceLocation, setDeviceLocation] = useState(null);
  const [radius, setRadius] = useState(10);
  const [types, setTypes] = useState(ALL_TYPES);
  const [query, setQuery] = useState("");
  const [areaQuery, setAreaQuery] = useState("");
  const [areas, setAreas] = useState([]);
  const [areaSearched, setAreaSearched] = useState(false);
  const [areaLoading, setAreaLoading] = useState(false);
  const [areaError, setAreaError] = useState("");
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [results, setResults] = useState(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState('');
  const moreAbort = useRef(null);
  const [selectedId, setSelectedId] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState("");
  const [mode, setMode] = useState("drive");
  const [mobileView, setMobileView] = useState("map");
  const areaAbort = useRef(null);
  const routeAbort = useRef(null);
  const locationSequence = useRef(0);
  const detailsRef = useRef(null);

  const clearRoute = useCallback(() => {
    routeAbort.current?.abort();
    setRouteInfo(null);
    setRouteError("");
    setRouteLoading(false);
  }, []);

  useEffect(() => () => {
    moreAbort.current?.abort();
    areaAbort.current?.abort();
    routeAbort.current?.abort();
    locationSequence.current += 1;
  }, []);

  useEffect(() => {
    if (!center) return;
    const controller = new AbortController();
    moreAbort.current?.abort();
    setLoadingMore(false);
    setMoreError('');
    setLoading(true);
    setError("");
    setResults(EMPTY_RESULTS);
    setSelectedId(null);
    clearRoute();
    const params = new URLSearchParams({ lat: String(center.latitude), lng: String(center.longitude), radius: String(radius) });
    fetch(`/api/healthcare/nearby?${params}`, { signal: controller.signal })
      .then(readResponse)
      .then((data) => {
        if (!controller.signal.aborted) setResults({
          registered: Array.isArray(data.registered) ? data.registered : [],
          external: Array.isArray(data.external) ? data.external : [],
          warnings: Array.isArray(data.warnings) ? data.warnings : [],
          truncated: Boolean(data.truncated),
          sources: data.sources || {},
          nextOffset: data.nextOffset ?? null,
        });
      })
      .catch((err) => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [center, radius, refresh, clearRoute]);

  async function loadMore() {
    if (!center || loadingMore || results.nextOffset == null) return;
    const controller = new AbortController();
    moreAbort.current = controller;
    setLoadingMore(true); setMoreError('');
    try {
      const params = new URLSearchParams({ lat: String(center.latitude), lng: String(center.longitude), radius: String(radius), offset: String(results.nextOffset) });
      const data = await readResponse(await fetch(`/api/healthcare/nearby?${params}`, { signal: controller.signal }));
      if (controller.signal.aborted) return;
      if (data.sources?.external === false) throw new Error('More healthcare listings could not be loaded. Please try again.');
      setResults((current) => ({ ...current,
        external: [...new globalThis.Map([...current.external, ...(data.external || [])].map((place) => [place.id, place])).values()].sort((a, b) => a.distanceKm - b.distanceKm),
        truncated: Boolean(data.truncated), nextOffset: data.nextOffset ?? null,
      }));
    } catch (error) { if (!controller.signal.aborted) setMoreError(error.message); }
    finally { if (!controller.signal.aborted) setLoadingMore(false); }
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const matches = (facility) => types[facility.type] && Number.isFinite(facility.distanceKm) && facility.distanceKm <= radius && (!needle || `${facility.name} ${facility.address || ""} ${facility.city || ""}`.toLocaleLowerCase().includes(needle));
    return { registered: results.registered.filter(matches), external: results.external.filter(matches) };
  }, [results, types, query, radius]);
  const facilities = useMemo(() => [...filtered.registered, ...filtered.external], [filtered]);
  const selected = facilities.find((facility) => facility.id === selectedId) || null;
  const routeOrigin = deviceLocation || center;
  const routeContext = `${center?.latitude},${center?.longitude}:${radius}:${selectedId}:${mode}:${routeOrigin?.latitude},${routeOrigin?.longitude}`;
  const activeRoute = routeInfo?.context === routeContext && selected ? routeInfo : null;

  useEffect(() => {
    if (selectedId && !selected) {
      setSelectedId(null);
      clearRoute();
    }
  }, [selectedId, selected, clearRoute]);

  function selectFacility(facility) {
    if (facility.id !== selectedId) clearRoute();
    setSelectedId(facility.id);
    setMobileView("list");
    requestAnimationFrame(() => detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

  function chooseCenter(nextCenter) {
    areaAbort.current?.abort();
    setAreaLoading(false);
    locationSequence.current += 1;
    setLocating(false);
    setLocationError("");
    setSelectedId(null);
    setResults(EMPTY_RESULTS);
    clearRoute();
    setCenter(nextCenter);
    setAreas([]);
    setAreaSearched(false);
    setMobileView("map");
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationError("This browser does not support location access. Search for an area instead.");
      return;
    }
    const sequence = ++locationSequence.current;
    setLocating(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition((position) => {
      if (sequence !== locationSequence.current) return;
      const location = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        label: "Your current location",
        kind: "device",
        accuracy: position.coords.accuracy,
      };
      setDeviceLocation(location);
      chooseCenter(location);
    }, (err) => {
      if (sequence !== locationSequence.current) return;
      setLocating(false);
      setLocationError(err.code === 1
        ? "Location permission was denied. Allow location in your browser settings, or search for an area below."
        : err.code === 3
          ? "Finding your location took too long. Try again or search for an area."
          : "We couldn’t find your location. Check your device’s location settings or search for an area.");
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }

  async function searchArea(event) {
    event.preventDefault();
    const text = areaQuery.trim();
    if (text.length < 3) {
      setAreaError("Enter at least 3 characters, for example Gulberg, Lahore.");
      return;
    }
    areaAbort.current?.abort();
    const controller = new AbortController();
    areaAbort.current = controller;
    setAreaLoading(true);
    setAreaError("");
    setAreaSearched(false);
    setAreas([]);
    try {
      const data = await readResponse(await fetch(`/api/healthcare/areas?${new URLSearchParams({ q: text })}`, { signal: controller.signal }));
      if (!controller.signal.aborted) {
        setAreas(Array.isArray(data.areas) ? data.areas : []);
        setAreaSearched(true);
      }
    } catch (err) {
      if (!controller.signal.aborted) setAreaError(err.message);
    } finally {
      if (!controller.signal.aborted) setAreaLoading(false);
    }
  }

  async function startDirections() {
    if (!selected || !routeOrigin) return;
    clearRoute();
    const controller = new AbortController();
    routeAbort.current = controller;
    setRouteLoading(true);
    const context = routeContext;
    const params = new URLSearchParams({
      fromLat: String(routeOrigin.latitude), fromLng: String(routeOrigin.longitude),
      toLat: String(selected.latitude), toLng: String(selected.longitude), mode,
    });
    try {
      const data = await readResponse(await fetch(`/api/healthcare/directions?${params}`, { signal: controller.signal }));
      if (!controller.signal.aborted) {
        setRouteInfo({ ...data, context });
        setMobileView("map");
      }
    } catch (err) {
      if (!controller.signal.aborted) setRouteError(err.message);
    } finally {
      if (!controller.signal.aborted) setRouteLoading(false);
    }
  }

  const directionsUrl = selected ? `https://www.google.com/maps/dir/?${new URLSearchParams({
    api: "1", destination: `${selected.latitude},${selected.longitude}`, travelmode: mode === "walk" ? "walking" : "driving",
  })}` : "";
  const hasFiltered = query.trim() || Object.values(types).some((enabled) => !enabled);
  const total = facilities.length;
  const safePhone = selected?.phone?.replace(/[^+\d]/g, "") || "";

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <Link className={styles.backLink} href="/pharmacies"><ArrowLeft size={15} /> Pharmacy directory</Link>
        <header className={styles.hero}>
          <div>
            <div className={styles.eyebrow}><span className={styles.eyebrowDot} /> CARE, CLOSER TO YOU</div>
            <h1>Find care around <span>the corner.</span></h1>
            <p>Discover nearby pharmacies, hospitals and clinics. Find your place, then find your way.</p>
          </div>
          <div className={styles.publicBadge}><Compass size={20} /><span>Explore freely<small>No account needed</small></span></div>
        </header>

        <section className={styles.locationBar} aria-label="Choose your search location">
          <div className={styles.locationIntro}><span className={styles.locationIcon}><MapPin size={21} /></span><div><strong>{center ? "Searching around" : "Where are you looking for care?"}</strong><span>{center?.label || "Use your location or choose an area to begin"}</span></div></div>
          <button className={styles.locateButton} type="button" onClick={useCurrentLocation} disabled={locating}>
            {locating ? <LoaderCircle size={17} className={styles.spin} /> : <LocateFixed size={17} />}{locating ? "Finding you…" : "Use my location"}
          </button>
          <span className={styles.or}>or</span>
          <form className={styles.areaForm} onSubmit={searchArea}>
            <label className={styles.srOnly} htmlFor="healthcare-area-search">Search for a city or area</label>
            <Search size={17} aria-hidden="true" />
            <input id="healthcare-area-search" type="search" value={areaQuery} onChange={(event) => {
              areaAbort.current?.abort();
              setAreaLoading(false);
              setAreaSearched(false);
              setAreaError("");
              setAreas([]);
              setAreaQuery(event.target.value);
            }} placeholder="Area or city, e.g. Gulberg, Lahore" maxLength={120} autoComplete="off" />
            <button type="submit" disabled={areaLoading} aria-label="Search area">{areaLoading ? <LoaderCircle size={17} className={styles.spin} /> : <ArrowRight size={18} />}</button>
          </form>
        </section>
        {(locationError || areaError) && <div className={styles.feedback} role="alert"><Info size={17} /><span>{locationError || areaError}</span></div>}
        {(areas.length > 0 || areaSearched) && <section className={styles.areaResults} aria-label="Matching search areas">
          <div className={styles.areaResultsHeading}><strong>{areas.length ? "Choose your search area" : "No matching areas found"}</strong><button type="button" onClick={() => { setAreas([]); setAreaSearched(false); }} aria-label="Close area results"><X size={17} /></button></div>
          {areas.length ? areas.map((area) => <button key={area.id} type="button" onClick={() => chooseCenter({ ...area, kind: "area" })}><MapPin size={17} /><span>{area.label}</span><ArrowRight size={16} /></button>) : <p>Try a neighbourhood or city with its country.</p>}
        </section>}

        <section className={styles.workspace} aria-label="Healthcare map explorer">
          <div className={styles.filterBar}>
            <fieldset className={styles.typeFilters}>
              <legend className={styles.srOnly}>Healthcare types shown on the map</legend>
              {Object.entries(TYPE_META).map(([type, { label, Icon }]) => <label className={`${styles.typeChip} ${types[type] ? styles.typeActive : ""} ${styles[`filter${type}`]}`} key={type}>
                <input type="checkbox" checked={types[type]} onChange={(event) => setTypes((current) => ({ ...current, [type]: event.target.checked }))} />
                <Icon size={16} /><span>{label}</span>{types[type] && <Check size={13} />}
              </label>)}
            </fieldset>
            <div className={styles.radiusControl}><SlidersHorizontal size={15} /><label htmlFor="healthcare-radius">Within</label><select id="healthcare-radius" value={radius} onChange={(event) => { clearRoute(); setSelectedId(null); setRadius(Number(event.target.value)); }}>{[2, 5, 10, 20, 50].map((value) => <option key={value} value={value}>{value} km</option>)}</select></div>
            <div className={styles.mobileToggle} aria-label="Results display"><button type="button" aria-pressed={mobileView === "list"} onClick={() => setMobileView("list")}><List size={15} />List{center && !loading ? ` (${total})` : ""}</button><button type="button" aria-pressed={mobileView === "map"} onClick={() => setMobileView("map")}><Map size={15} />Map</button></div>
          </div>

          <div className={styles.workspaceBody}>
            <aside className={`${styles.sidebar} ${mobileView === "map" ? styles.mobileHidden : ""}`} aria-label="Nearby healthcare results">
              <div className={styles.resultsToolbar}>
                <div><h2>Nearby healthcare</h2><span aria-live="polite">{loading ? "Finding places around you…" : center ? `${total} ${total === 1 ? "place" : "places"} within ${radius} km` : "Choose an area to explore"}</span></div>
                {center && <button className={styles.iconButton} type="button" onClick={() => setRefresh((value) => value + 1)} disabled={loading} aria-label="Refresh nearby healthcare"><RefreshCw size={17} className={loading ? styles.spin : ""} /></button>}
              </div>
              <div className={styles.nameSearch}><Search size={16} /><label className={styles.srOnly} htmlFor="healthcare-name-filter">Filter healthcare results by name or address</label><input id="healthcare-name-filter" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter healthcare results…" maxLength={150} disabled={!center} /></div>

              <div className={styles.resultsScroll}>
                {selected && <section className={styles.detail} ref={detailsRef} aria-label={`Details for ${selected.name}`}>
                  <div className={styles.detailTop}><span className={selected.registered ? styles.registeredTag : styles.externalTag}>{selected.registered ? <ShieldCheck size={13} /> : <MapPin size={13} />}{selected.registered ? "DAWA Connect pharmacy" : "External healthcare listing"}</span><button className={styles.iconButton} type="button" onClick={() => { setSelectedId(null); clearRoute(); }} aria-label="Close place details"><X size={17} /></button></div>
                  <h3>{selected.name}</h3>
                  <p className={styles.detailAddress}><MapPin size={15} /><span>{selected.address || selected.city || `${Number(selected.latitude).toFixed(5)}, ${Number(selected.longitude).toFixed(5)}`}</span></p>
                  <div className={styles.detailFacts}><span>{TYPE_META[selected.type]?.single || "Healthcare"}</span><span>{formatDistance(selected.distanceKm)} straight-line</span></div>
                  {safePhone && <a className={styles.phoneLink} href={`tel:${safePhone}`}><Phone size={14} />{selected.phone}</a>}
                  {selected.registered && selected.href?.startsWith("/") && <Link className={styles.pharmacyLink} href={selected.href}>View pharmacy & products <ArrowRight size={15} /></Link>}
                  {!selected.registered && <p className={styles.membershipNote}>Not matched to DAWA Connect. Membership and availability may not be up to date.</p>}
                  <div className={styles.routeDivider} />
                  <div className={styles.directionsHeading}><strong>Get there</strong><div className={styles.travelModes} aria-label="Travel mode"><button type="button" aria-pressed={mode === "drive"} onClick={() => { setMode("drive"); clearRoute(); }}><CarFront size={15} />Drive</button><button type="button" aria-pressed={mode === "walk"} onClick={() => { setMode("walk"); clearRoute(); }}><Footprints size={15} />Walk</button></div></div>
                  <p className={styles.originNote}>From {deviceLocation ? "your detected device location" : "the selected search area (not your live location)"}.</p>
                  <button className={styles.directionsButton} type="button" onClick={startDirections} disabled={routeLoading}>{routeLoading ? <LoaderCircle size={16} className={styles.spin} /> : <Navigation size={16} />}{routeLoading ? "Finding a route…" : activeRoute ? "Refresh directions" : "Start directions"}</button>
                  {routeError && <p role="alert" className={styles.routeError}>{routeError}</p>}
                  {activeRoute && <div className={styles.routeDetails}>
                    <div className={styles.routeStats}><strong><Clock3 size={16} />{formatDuration(activeRoute.durationMinutes)}</strong><span>{formatDistance(activeRoute.distanceKm)} route</span></div>
                    <p>Estimated route. No live traffic or turn-by-turn tracking.</p>
                    {Array.isArray(activeRoute.steps) && activeRoute.steps.length > 0 && <details><summary>Route steps <ChevronDown size={14} /></summary><ol>{activeRoute.steps.map((step, index) => <li key={index}><span>{step.instruction || "Continue on the route"}</span>{Number.isFinite(step.distanceMeters) && <small>{formatDistance(step.distanceMeters / 1000)}</small>}</li>)}</ol></details>}
                  </div>}
                  <a className={styles.navigationLink} href={directionsUrl} target="_blank" rel="noopener noreferrer">Open Google Maps navigation <ExternalLink size={13} /></a>
                </section>}

                {!center && <div className={styles.emptyState}><span className={styles.emptyIcon}><LocateFixed size={28} strokeWidth={1.5} /></span><h3>Your neighbourhood.<br />Your care network.</h3><p>Share your location or search an area above to find healthcare within 10 km. You can adjust the range anytime.</p><button type="button" className={styles.emptyAction} onClick={useCurrentLocation} disabled={locating}>{locating ? <LoaderCircle className={styles.spin} size={16} /> : <LocateFixed size={16} />}Use my location</button><small>Location is only requested when you choose.</small></div>}
                {loading && <div className={styles.loadingState} role="status"><LoaderCircle size={24} className={styles.spin} /><strong>Finding care nearby</strong><p>Checking DAWA Connect and local healthcare listings.</p><div className={styles.skeleton} /><div className={styles.skeleton} /><div className={styles.skeleton} /></div>}
                {error && <div className={styles.emptyState} role="alert"><span className={styles.emptyIcon}><CircleHelp size={27} /></span><h3>We couldn’t load this area</h3><p>{error}</p><button type="button" className={styles.emptyAction} onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={15} />Try again</button></div>}
                {center && !loading && !error && <>
                  {results.warnings.length > 0 && <div className={styles.dataNotice} role="status"><Info size={16} /><div>{results.warnings.map((warning, index) => <p key={index}>{warning}</p>)}</div></div>}
                  {results.truncated && <div className={styles.limitNotice}><p>Showing the nearest loaded listings. More healthcare may be available in this range.</p>{results.nextOffset != null ? <button type="button" className={styles.emptyAction} onClick={loadMore} disabled={loadingMore}>{loadingMore ? 'Loading more...' : 'Load more healthcare'}</button> : <p>Reduce the range to explore this busy area in more detail.</p>}{moreError && <p role="alert">{moreError}</p>}</div>}
                  {total === 0 && <div className={styles.noMatches}><Search size={23} /><h3>{hasFiltered ? "No matching healthcare" : results.warnings.length ? "Some listings could not load" : "No places found in this area"}</h3><p>{hasFiltered ? "Try another name or include more healthcare types." : results.warnings.length ? "Refresh the results to try again. Missing results do not mean there is no healthcare nearby." : "Try a wider range or a different area. Listings may be incomplete."}</p>{hasFiltered && <button type="button" onClick={() => { setTypes(ALL_TYPES); setQuery(""); }}>Clear result filters</button>}</div>}
                  <section className={styles.resultGroup} aria-labelledby="registered-nearby-heading"><div className={styles.groupHeading}><span className={styles.groupSymbol}><ShieldCheck size={15} /></span><h3 id="registered-nearby-heading">DAWA Connect pharmacies</h3><span className={styles.count}>{filtered.registered.length}</span></div><p className={styles.groupCaption}>Registered pharmacies near you. Explore their products.</p>{filtered.registered.length ? filtered.registered.map((facility) => <FacilityCard key={facility.id} facility={facility} selected={selectedId === facility.id} onSelect={selectFacility} />) : <p className={styles.groupEmpty}>{results.sources?.registered === false ? "Registered pharmacies are temporarily unavailable." : types.pharmacy ? "No matching DAWA Connect pharmacies in this range." : "Turn on the pharmacy filter to see registered pharmacies."}</p>}</section>
                  <section className={styles.resultGroup} aria-labelledby="external-nearby-heading"><div className={styles.groupHeading}><span className={`${styles.groupSymbol} ${styles.externalSymbol}`}><Building2 size={15} /></span><h3 id="external-nearby-heading">Other healthcare nearby</h3><span className={styles.count}>{filtered.external.length}</span></div><p className={styles.groupCaption}>Pharmacies, hospitals & clinics not matched to DAWA Connect.</p>{filtered.external.length ? filtered.external.map((facility) => <FacilityCard key={facility.id} facility={facility} selected={selectedId === facility.id} onSelect={selectFacility} />) : <p className={styles.groupEmpty}>No matching external listings in this range.</p>}</section>
                </>}
              </div>
              <div className={styles.sidebarFooter}><Info size={13} /><span>Nearest first · Straight-line distance, not travel distance</span></div>
            </aside>

            <section className={`${styles.mapPanel} ${mobileView === "list" ? styles.mobileHidden : ""}`} aria-label="Interactive healthcare map">
              <HealthcareMapCanvas center={center} radius={radius} facilities={facilities} selectedId={selectedId} onSelect={selectFacility} route={activeRoute?.coordinates || []} />
              {!center && <div className={styles.mapWelcome}><span><Compass size={19} /></span><div><strong>Choose a search area</strong><p>Lahore is a starting view, not your current location.</p></div></div>}
              {center && <div className={styles.mapAreaBadge}><span className={styles.liveDot} /><span>{radius} km search area</span>{loading && <LoaderCircle size={13} className={styles.spin} />}</div>}
              {activeRoute && <div className={styles.routeOverlay}><span className={styles.routeOverlayIcon}>{mode === "walk" ? <Footprints size={21} /> : <CarFront size={21} />}</span><div><strong>{formatDuration(activeRoute.durationMinutes)} <span>· {formatDistance(activeRoute.distanceKm)}</span></strong><p>To {selected?.name}</p></div><button className={styles.iconButton} type="button" onClick={clearRoute} aria-label="Clear directions"><X size={17} /></button></div>}
              <div className={styles.mapLegend} aria-label="Map marker legend"><span><i className={styles.legendRegistered} />DAWA Connect</span><span><i className={styles.legendPharmacy} />Pharmacy</span><span><i className={styles.legendHospital} />Hospital</span><span><i className={styles.legendClinic} />Clinic</span></div>
            </section>
          </div>
        </section>

        <footer className={styles.mapNotes}><Info size={16} /><p>DAWA Connect pharmacies use their saved registration coordinates. Other places come from third-party healthcare listings, not Google’s directory; coverage and details may be incomplete. Confirm opening hours with the facility before travelling. Search and route locations are sent to Geoapify; the map viewport is shared with OpenFreeMap. Your location is not saved to a profile. Routes are estimates, not emergency navigation.{center?.kind === "device" && Number.isFinite(center.accuracy) ? ` Your device reported an accuracy of approximately ${Math.round(center.accuracy)} m.` : ""}</p></footer>
      </div>
    </div>
  );
}
