"use client";

import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  Polyline
} from "react-leaflet";
import L from "leaflet";
import { Search, Loader2, Navigation, Clock } from "lucide-react";
import { fetchPharmacies, searchPlaces, fetchRoute } from "@/lib/osm";

// ✅ Leaflet CSS
import "leaflet/dist/leaflet.css";

// 🧠 Fix default icon issue
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

// 🚀 Fly to user location
function LocationFlyTo({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position, 14, {
        animate: true,
        duration: 1.5,
      });
    }
  }, [position, map]);
  return null;
}

// 🎯 Custom icons
const userIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const pharmacyIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// --- Extracted API Helpers are now imported from @/lib/osm ---

export default function LeafletMap() {
  const [userLocation, setUserLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  
  const [pharmacies, setPharmacies] = useState([]);
  const [isLoadingPharmacies, setIsLoadingPharmacies] = useState(false);
  
  const [route, setRoute] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);
  const [isRouting, setIsRouting] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const defaultCenter = [31.5204, 74.3587];

  // 1. Initial Location
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation([pos.coords.latitude, pos.coords.longitude]);
        },
        () => {
          console.warn("Location access denied or unavailable.");
          setUserLocation(defaultCenter);
        }
      );
    } else {
      console.warn("Geolocation not supported.");
      setUserLocation(defaultCenter);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Fetch Pharmacies
  useEffect(() => {
    if (userLocation) {
      setIsLoadingPharmacies(true);
      fetchPharmacies(userLocation[0], userLocation[1])
        .then(setPharmacies)
        .catch((err) => {
          console.error("Failed to load pharmacies", err);
          setErrorMsg("Could not fetch live pharmacies.");
        })
        .finally(() => setIsLoadingPharmacies(false));
    }
  }, [userLocation]);

  // 3. Search Handler
  const handleSearch = async (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (query.length > 2) {
      setIsSearching(true);
      try {
        const results = await searchPlaces(query);
        setSearchResults(results);
      } catch (err) {
        console.error("Search error", err);
      } finally {
        setIsSearching(false);
      }
    } else {
      setSearchResults([]);
    }
  };

  const selectPlace = (place) => {
    const lat = parseFloat(place.lat);
    const lon = parseFloat(place.lon);
    setUserLocation([lat, lon]); // Map will fly here and fetch new pharmacies
    setSearchQuery("");
    setSearchResults([]);
    setRoute([]); 
    setRouteInfo(null);
  };

  // 4. Route Handler
  const handlePharmacyClick = async (pharmacy) => {
    if (!userLocation) return;
    setIsRouting(true);
    setErrorMsg("");
    try {
      const data = await fetchRoute(userLocation, pharmacy.position);
      setRoute(data.coordinates);
      setRouteInfo({ distance: data.distance, duration: data.duration, name: pharmacy.name });
    } catch (err) {
      console.error("Routing error", err);
      setErrorMsg("Failed to calculate route. Pharmacy might be inaccessible.");
    } finally {
      setIsRouting(false);
    }
  };

  return (
    <div className="w-full h-[500px] lg:h-[600px] relative z-0 flex flex-col rounded-xl overflow-hidden shadow-sm border border-gray-200 bg-gray-50">
      
      {/* 🔍 Search Overlay */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] w-[90%] max-w-md">
        <div className="relative bg-white/95 backdrop-blur-md rounded-xl shadow-lg flex items-center p-2 border border-gray-200">
          <Search className="w-5 h-5 text-gray-400 ml-2" />
          <input
            type="text"
            placeholder="Search city, neighborhood..."
            value={searchQuery}
            onChange={handleSearch}
            className="w-full px-3 py-2 outline-none text-sm bg-transparent text-gray-800 placeholder-gray-400"
          />
          {isSearching && <Loader2 className="w-4 h-4 text-blue-500 animate-spin mr-2" />}
        </div>
        
        {searchResults.length > 0 && (
          <ul className="mt-2 bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-gray-100 max-h-60 overflow-y-auto divide-y divide-gray-50">
            {searchResults.map((place) => (
              <li
                key={place.place_id}
                onClick={() => selectPlace(place)}
                className="p-3 text-sm hover:bg-blue-50 cursor-pointer transition-colors text-gray-700 truncate"
              >
                {place.display_name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 🧭 Route Info Card Overlay */}
      {routeInfo && !isRouting && (
        <div className="absolute top-4 right-4 z-[1000] bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-blue-100 p-4 w-64">
          <h3 className="font-bold text-gray-900 mb-2 truncate">{routeInfo.name}</h3>
          <div className="flex items-center gap-4 text-sm text-gray-700 bg-gray-50 p-2 rounded-lg border border-gray-100">
            <div className="flex items-center gap-1 text-blue-600">
              <Navigation className="w-4 h-4" />
              <span className="font-semibold">{routeInfo.distance} km</span>
            </div>
            <div className="flex items-center gap-1 text-orange-500">
              <Clock className="w-4 h-4" />
              <span className="font-semibold">{routeInfo.duration} min</span>
            </div>
          </div>
          <button 
            onClick={() => { setRoute([]); setRouteInfo(null); }}
            className="w-full mt-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            Clear Route
          </button>
        </div>
      )}

      {/* 📢 Notifications overlay */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] flex flex-col gap-2 items-center w-[90%] max-w-sm pointer-events-none">
        {errorMsg && (
           <div className="bg-red-100 text-red-700 px-4 py-2 rounded-full shadow-lg text-sm font-medium border border-red-200 pointer-events-auto">
             {errorMsg}
           </div>
        )}
        
        {isLoadingPharmacies && (
           <div className="bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium flex items-center gap-2 pointer-events-auto">
             <Loader2 className="w-4 h-4 animate-spin" /> Finding pharmacies...
           </div>
        )}

        {isRouting && (
           <div className="bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium flex items-center gap-2 pointer-events-auto">
             <Loader2 className="w-4 h-4 animate-spin" /> Calculating route...
           </div>
        )}
      </div>

      {/* 🗺️ Map Container */}
      <MapContainer
        center={defaultCenter}
        zoom={13}
        scrollWheelZoom
        style={{ height: '100%', width: '100%', zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* 📍 User Marker */}
        {userLocation && (
          <>
            <Marker position={userLocation} icon={userIcon}>
              <Popup><div className="font-semibold">You are here</div></Popup>
            </Marker>
            <LocationFlyTo position={userLocation} />
          </>
        )}

        {/* 🛣️ Route Polyline */}
        {route.length > 0 && (
          <Polyline positions={route} color="#3b82f6" weight={5} opacity={0.8} />
        )}

        {/* 💊 Pharmacy Markers */}
        {pharmacies.map((p) => (
          <Marker 
            key={p.id} 
            position={p.position} 
            icon={pharmacyIcon}
            eventHandlers={{ click: () => handlePharmacyClick(p) }}
          >
            <Popup>
              <div className="font-semibold text-gray-900">{p.name}</div>
              <div className="text-xs text-gray-500 mb-2">Pharmacy</div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handlePharmacyClick(p);
                }}
                className="w-full bg-blue-50 text-blue-600 text-xs font-semibold py-1 rounded hover:bg-blue-100 transition-colors"
              >
                Get Directions
              </button>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}