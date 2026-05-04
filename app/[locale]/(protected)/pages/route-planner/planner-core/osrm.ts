import type { Coord } from "./types";

const OSRM_BASE_URL =
  process.env.NEXT_PUBLIC_OSRM_BASE_URL || "https://router.project-osrm.org";

type OsrmRouteResponse = {
  code: string;
  routes?: Array<{
    distance: number;
    duration: number;
  }>;
};

type OsrmTableResponse = {
  code: string;
  durations?: Array<Array<number | null>>;
  distances?: Array<Array<number | null>>;
};

function coordsToOsrmString(coords: Coord[]): string {
  return coords.map((c) => `${c.lon},${c.lat}`).join(";");
}

export async function osrmRoute(
  coords: Coord[],
): Promise<{ miles: number; minutes: number }> {
  if (coords.length < 2) {
    return { miles: 0, minutes: 0 };
  }

  const coordString = coordsToOsrmString(coords);
  const url =
    `${OSRM_BASE_URL}/route/v1/driving/${coordString}` +
    `?overview=false&steps=false&alternatives=false`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`OSRM route request failed: ${res.status}`);
  }

  const data = (await res.json()) as OsrmRouteResponse;

  if (data.code !== "Ok" || !data.routes?.[0]) {
    throw new Error(`OSRM route error: ${data.code}`);
  }

  return {
    miles: data.routes[0].distance / 1609.34,
    minutes: data.routes[0].duration / 60,
  };
}

export async function osrmTable(
  coords: Coord[],
): Promise<{
  durations: Array<Array<number | null>>;
  distances: Array<Array<number | null>>;
}> {
  if (coords.length < 2) {
    return {
      durations: [[0]],
      distances: [[0]],
    };
  }

  const coordString = coordsToOsrmString(coords);
  const url =
    `${OSRM_BASE_URL}/table/v1/driving/${coordString}` +
    `?annotations=duration,distance`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`OSRM table request failed: ${res.status}`);
  }

  const data = (await res.json()) as OsrmTableResponse;

  if (data.code !== "Ok" || !data.durations || !data.distances) {
    throw new Error(`OSRM table error: ${data.code}`);
  }

  return {
    durations: data.durations,
    distances: data.distances,
  };
}