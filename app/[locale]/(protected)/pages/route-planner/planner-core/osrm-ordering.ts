import type { Coord } from "./types";
import { osrmRoute, osrmTable } from "./osrm";

export async function orderOutboundPickupsByFurthestFirst(
  pickupCoords: Coord[],
  destinationCoord: Coord,
): Promise<number[]> {
  if (pickupCoords.length <= 1) {
    return pickupCoords.map((_, i) => i);
  }

  const coords = [...pickupCoords, destinationCoord];
  const destIndex = coords.length - 1;

  const { distances } = await osrmTable(coords);

  return pickupCoords
    .map((_, i) => ({
      index: i,
      distanceToDestination: distances[i]?.[destIndex] ?? 0,
    }))
    .sort((a, b) => b.distanceToDestination - a.distanceToDestination)
    .map((x) => x.index);
}

export async function orderReturnDropoffsClosestFirst(
  facilityCoord: Coord,
  dropoffCoords: Coord[],
): Promise<number[]> {
  if (dropoffCoords.length <= 1) {
    return dropoffCoords.map((_, i) => i);
  }

  const coords = [facilityCoord, ...dropoffCoords];
  const { distances } = await osrmTable(coords);

  return dropoffCoords
    .map((_, i) => ({
      index: i,
      distanceFromFacility: distances[0]?.[i + 1] ?? 0,
    }))
    .sort((a, b) => a.distanceFromFacility - b.distanceFromFacility)
    .map((x) => x.index);
}

export async function routeLegsTotal(coords: Coord[]) {
  return osrmRoute(coords);
}

export async function canDoSideTripAndReturn(params: {
  fromFacility: Coord;
  candidatePickup: Coord;
  candidateDropoff: Coord;
  returnFacility: Coord;
  minutesAvailable: number;
}) {
  const {
    fromFacility,
    candidatePickup,
    candidateDropoff,
    returnFacility,
    minutesAvailable,
  } = params;

  const route = await osrmRoute([
    fromFacility,
    candidatePickup,
    candidateDropoff,
    returnFacility,
  ]);

  return {
    fits: route.minutes <= minutesAvailable,
    routeMinutes: route.minutes,
    routeMiles: route.miles,
  };
}