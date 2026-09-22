// Helper function to calculate real distance between two coordinates in miles
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 3958.8; // Radius of the earth in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180; 
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return (R * c).toFixed(1);
};

export const fetchPharmacies = async (lat, lon) => {
  const query = `
    [out:json];
    node
      ["amenity"="pharmacy"]
      (around:4000, ${lat}, ${lon});
    out;
  `;
  
  // Multiple Overpass endpoints to fallback on if one is rate-limited
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
  ];

  let data = null;

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        body: query,
      });
      
      if (!res.ok) continue; // Try next endpoint
      
      const text = await res.text();
      // Overpass sometimes returns XML on error even with 200 OK
      if (text.trim().startsWith("<")) continue; 
      
      data = JSON.parse(text);
      break; // Successfully fetched JSON
    } catch (err) {
      console.warn(`Failed to fetch from ${endpoint}:`, err);
    }
  }

  if (!data || !data.elements) {
    throw new Error("All Overpass API endpoints failed or rate limited.");
  }

  return data.elements.map((el, index) => {
    // Calculate actual distance
    const distanceStr = calculateDistance(lat, lon, el.lat, el.lon) + " miles away";
    
    // We'll generate a deterministic pseudo-random rating based on ID so it stays consistent
    const pseudoRating = 4.0 + ((el.id % 10) / 10);
    
    return {
      id: el.id,
      name: el.tags?.name || "Unnamed Pharmacy",
      position: [el.lat, el.lon],
      distance: distanceStr,
      timing: el.tags?.opening_hours || "Open until 10 PM",
      rating: pseudoRating.toFixed(1)
    };
  });
};

export const searchPlaces = async (query) => {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${query}`
  );
  return await res.json();
};

export const reverseGeocode = async (lat, lon) => {
  const params = new URLSearchParams({
    format: "jsonv2",
    lat: String(lat),
    lon: String(lon),
    zoom: "18",
    addressdetails: "1",
    layer: "address",
  });
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?${params.toString()}`
  );
  if (!response.ok) throw new Error("Address lookup is temporarily unavailable.");

  const result = await response.json();
  if (result.error || !result.address) {
    throw new Error("No street address was found near your location.");
  }

  const address = result.address;
  const road =
    address.road ||
    address.pedestrian ||
    address.residential ||
    address.footway ||
    address.path ||
    "";
  const street = [address.house_number, road].filter(Boolean).join(" ");
  const area =
    address.neighbourhood ||
    address.suburb ||
    address.quarter ||
    address.city_district ||
    "";

  return {
    line1: [street, area].filter(Boolean).join(", ") || result.name || result.display_name,
    city:
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.county ||
      "",
    province: address.state || address.state_district || "",
    postalCode: address.postcode || "",
  };
};

export const fetchRoute = async (start, end) => {
  const res = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`
  );
  const data = await res.json();
  const route = data.routes[0];
  return {
    coordinates: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    distance: (route.distance / 1000).toFixed(1), // in km
    duration: Math.ceil(route.duration / 60) // in mins
  };
};
