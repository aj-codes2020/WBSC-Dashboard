import { BASE_ADDRESS, BASE_COORD } from "./constants";
import { facilityKey } from "./rules";
import { trafficMultiplier } from "./time";
import type { Coord } from "./types";

export function haversineMiles(a: Coord, b: Coord): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(x));
}

export function fallbackDriveEstimate(
  a: Coord,
  b: Coord,
  departMin: number,
): { miles: number; minutes: number } {
  const miles = haversineMiles(a, b) * 1.22;
  const mph = departMin >= 360 && departMin <= 540 ? 24 : 28;
  const minutes = (miles / mph) * 60 * trafficMultiplier(departMin);

  return { miles, minutes };
}

function parseCoordinateInput(value: string): Coord | null {
  const text = value.trim();

  const simpleMatch = text.match(
    /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/,
  );
  if (simpleMatch) {
    const lat = Number(simpleMatch[1]);
    const lon = Number(simpleMatch[2]);

    if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
      return { lat, lon };
    }
  }

  const compassMatch = text.match(
    /^\s*([NS])\s*(\d+(?:\.\d+)?)\s*,\s*([EW])\s*(\d+(?:\.\d+)?)\s*$/i,
  );
  if (compassMatch) {
    let lat = Number(compassMatch[2]);
    let lon = Number(compassMatch[4]);

    if (compassMatch[1].toUpperCase() === "S") lat = -lat;
    if (compassMatch[3].toUpperCase() === "W") lon = -lon;

    if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
      return { lat, lon };
    }
  }

  return null;
}

const KNOWN_COORDS: Record<string, Coord> = {
  [facilityKey("590 Missouri Ave, Jeffersonville, IN, United States")]:
    BASE_COORD,

  [facilityKey("7509 Charlestown Pike, Charlestown, IN 47111, United States")]:
    {
      lat: 38.3738,
      lon: -85.6872,
    },

  [facilityKey("7509 Charlestown Pike, Charlestown, IN 47111")]: {
    lat: 38.3738,
    lon: -85.6872,
  },

  [facilityKey("7509 Charlestown Pike, Charlestown, IN")]: {
    lat: 38.3738,
    lon: -85.6872,
  },
};

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function geocodeAddress(
  address: string,
  cache: Record<string, Coord>,
): Promise<Coord | null> {
  const typedCoords = parseCoordinateInput(address);
  if (typedCoords) {
    return typedCoords;
  }

  const key = facilityKey(address);
  if (!key) return null;

  if (cache[key]) {
    return cache[key];
  }

  if (KNOWN_COORDS[key]) {
    cache[key] = KNOWN_COORDS[key];
    return KNOWN_COORDS[key];
  }

  if (key === facilityKey(BASE_ADDRESS)) {
    cache[key] = BASE_COORD;
    return BASE_COORD;
  }

  const res = await fetch(
    `/api/geocode?address=${encodeURIComponent(address)}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    },
  );

  if (!res.ok) {
    return null;
  }

  const data = (await res.json()) as {
    lat?: number;
    lon?: number;
  };

  if (
    typeof data.lat !== "number" ||
    typeof data.lon !== "number" ||
    Number.isNaN(data.lat) ||
    Number.isNaN(data.lon)
  ) {
    return null;
  }

  const coord = {
    lat: data.lat,
    lon: data.lon,
  };

  cache[key] = coord;
  return coord;
}

export async function driveEstimate(
  from: Coord,
  to: Coord,
  departMin: number,
): Promise<{ miles: number; minutes: number }> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${from.lon},${from.lat};${to.lon},${to.lat}` +
    `?overview=false&alternatives=false&steps=false`;

  const data = await fetchJson<{
    routes?: Array<{ distance: number; duration: number }>;
  }>(url);

  const route = data?.routes?.[0];
  if (!route) {
    return fallbackDriveEstimate(from, to, departMin);
  }

  const miles = route.distance / 1609.34;
  const minutes = (route.duration / 60) * trafficMultiplier(departMin);

  return { miles, minutes };
}