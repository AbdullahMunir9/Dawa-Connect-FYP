"use client";

import { useState } from "react";
import { Check, ChevronDown, Loader2, LocateFixed, MapPin, Navigation, Search, X } from "lucide-react";

export default function SearchDeliveryLocation({ value, onChange }) {
  const [open, setOpen] = useState(!value);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");

  const choose = (location, source = "entered") => {
    onChange({ ...location, source });
    setOpen(false);
    setMatches([]);
    setQuery("");
    setError("");
  };

  const useCurrentLocation = async () => {
    setError("");
    if (!("geolocation" in navigator)) {
      setError("This browser does not support location access. Search for an address instead.");
      return;
    }
    setLocating(true);
    try {
      const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5 * 60 * 1000,
      }));
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      const response = await fetch(`/api/locations?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Your address could not be identified.");
      choose({ ...data.location, latitude, longitude }, "device");
    } catch (locationError) {
      if (locationError?.code === 1) setError("Location permission was denied. Enter your home or delivery address below.");
      else if (locationError?.code === 2) setError("Your device could not determine its current location.");
      else if (locationError?.code === 3) setError("Location detection timed out. Please try again or enter an address.");
      else setError(locationError?.message || "Your location could not be detected.");
    } finally {
      setLocating(false);
    }
  };

  const searchLocations = async (event) => {
    event.preventDefault();
    const normalized = query.trim();
    if (normalized.length < 3) {
      setError("Enter at least 3 characters of an address, area or city.");
      return;
    }
    setSearching(true);
    setError("");
    try {
      const response = await fetch(`/api/locations?q=${encodeURIComponent(normalized)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Address search is temporarily unavailable.");
      setMatches(data.locations || []);
      if (!data.locations?.length) setError("No matching location was found in Pakistan. Try a nearby landmark or area.");
    } catch (searchError) {
      setMatches([]);
      setError(searchError.message || "Address search is temporarily unavailable.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <section className="mt-5 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-teal-50 shadow-sm" aria-label="Delivery location">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left sm:px-5"
        aria-expanded={open}
      >
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${value ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>
          {value ? <Check className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">Delivery destination</span>
          <span className="mt-0.5 block truncate text-sm font-semibold text-gray-900">
            {value?.label || "Choose where you want the medicines delivered"}
          </span>
          {!value && <span className="mt-0.5 block text-xs text-gray-500">Use your current position or enter a different home, office or city.</span>}
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-blue-100 px-4 py-4 sm:px-5">
          <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
            <button
              type="button"
              onClick={useCurrentLocation}
              disabled={locating}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-800 px-4 text-sm font-semibold text-white transition hover:bg-blue-900 disabled:cursor-wait disabled:opacity-60"
            >
              {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
              {locating ? "Finding you…" : "Use current location"}
            </button>
            <form onSubmit={searchLocations} className="flex min-w-0 gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Enter home address, area, landmark or city"
                  className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  maxLength={160}
                />
              </div>
              <button type="submit" disabled={searching} className="inline-flex h-11 items-center justify-center rounded-xl border border-blue-200 bg-white px-4 text-sm font-semibold text-blue-800 hover:bg-blue-50 disabled:opacity-60">
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Find"}
              </button>
            </form>
          </div>

          {error && <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>}
          {matches.length > 0 && (
            <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              {matches.map((location) => (
                <button key={location.id} type="button" onClick={() => choose(location)} className="flex w-full items-start gap-3 border-b border-gray-100 px-4 py-3 text-left last:border-b-0 hover:bg-blue-50">
                  <Navigation className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                  <span className="text-sm text-gray-700">{location.label}</span>
                </button>
              ))}
            </div>
          )}

          {value && (
            <button type="button" onClick={() => { onChange(null); setOpen(true); }} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-red-600">
              <X className="h-3.5 w-3.5" /> Clear selected destination
            </button>
          )}
        </div>
      )}
    </section>
  );
}
