import fs from "fs/promises";
import path from "path";
import type { Coord } from "./types";

const CACHE_DIR = path.join(process.cwd(), "data");
const CACHE_FILE = path.join(CACHE_DIR, "geocode-cache.json");

export type GeocodeCacheMap = Record<string, Coord>;

async function ensureCacheFile() {
  await fs.mkdir(CACHE_DIR, { recursive: true });

  try {
    await fs.access(CACHE_FILE);
  } catch {
    await fs.writeFile(CACHE_FILE, JSON.stringify({}, null, 2), "utf8");
  }
}

export async function readGeocodeCache(): Promise<GeocodeCacheMap> {
  await ensureCacheFile();

  try {
    const raw = await fs.readFile(CACHE_FILE, "utf8");
    const parsed = JSON.parse(raw) as GeocodeCacheMap;
    return parsed ?? {};
  } catch {
    return {};
  }
}

export async function writeGeocodeCache(
  cache: GeocodeCacheMap,
): Promise<void> {
  await ensureCacheFile();
  await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), "utf8");
}

export async function getCachedCoordinate(
  key: string,
): Promise<Coord | null> {
  const cache = await readGeocodeCache();
  return cache[key] ?? null;
}

export async function setCachedCoordinate(
  key: string,
  coord: Coord,
): Promise<void> {
  const cache = await readGeocodeCache();
  cache[key] = coord;
  await writeGeocodeCache(cache);
}