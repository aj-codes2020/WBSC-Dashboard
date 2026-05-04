import { BASE_ADDRESS, BASE_COORD } from "./constants";
import { driveEstimate, geocodeAddress } from "./geo";
import {
  canShareVehicle,
  estimateAppointmentDuration,
  facilityKey,
} from "./rules";
import { timeToMin } from "./time";
import {
  canDoSideTripAndReturn,
  orderOutboundPickupsByFurthestFirst,
  orderReturnDropoffsClosestFirst,
} from "./osrm-ordering";
import type {
  Coord,
  DriverShift,
  DurationRule,
  Job,
  PlannedRoute,
  RiderRule,
  RouteStop,
  TripRecord,
} from "./types";

function findRiderRule(memberName: string, riderRules: RiderRule[]) {
  return riderRules.find((r) =>
    memberName.toLowerCase().includes(r.nameContains.toLowerCase()),
  );
}

function riderScopedNotes(
  memberName: string,
  values: Array<string | undefined | null>,
): string[] {
  return values
    .map((value) => (value ?? "").trim())
    .filter(Boolean)
    .map((value) => `[${memberName}] ${value}`);
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function buildPairedTripMap(trips: TripRecord[]) {
  const byRiderDate = new Map<string, TripRecord[]>();

  for (const trip of trips) {
    const key = `${trip.date}__${trip.memberName}`;
    if (!byRiderDate.has(key)) byRiderDate.set(key, []);
    byRiderDate.get(key)!.push(trip);
  }

  const nextTripById = new Map<string, TripRecord>();
  const prevTripById = new Map<string, TripRecord>();

  for (const riderTrips of Array.from(byRiderDate.values())) {
    const numericTrips = riderTrips
      .filter((t) => t.bookingIdNumber != null)
      .sort((a, b) => a.bookingIdNumber! - b.bookingIdNumber!);

    for (let i = 0; i < numericTrips.length - 1; i++) {
      const current = numericTrips[i];
      const next = numericTrips[i + 1];

      if (
        current.bookingIdNumber != null &&
        next.bookingIdNumber != null &&
        next.bookingIdNumber === current.bookingIdNumber + 1
      ) {
        nextTripById.set(current.id, next);
        prevTripById.set(next.id, current);
      }
    }
  }

  return { nextTripById, prevTripById };
}

function buildIndividualOutboundJobs(
  trips: TripRecord[],
  durationRules: DurationRule[],
  riderRules: RiderRule[],
  nextTripById: Map<string, TripRecord>,
  prevTripById: Map<string, TripRecord>,
): Job[] {
  const jobs: Job[] = [];

  for (const trip of trips) {
    if (prevTripById.has(trip.id)) continue;

    const riderRule = findRiderRule(trip.memberName, riderRules);

    const ready = timeToMin(trip.requestedTimePickup);
    const lateDrop = timeToMin(trip.requestedLateDropoff);
    const specialRequestedPickup = timeToMin(riderRule?.RequestedPickup);
    const maxLate = riderRule?.maxLateMinutes ?? 10;
    const preferredEarlyArrival =
      riderRule?.preferredEarlyArrivalMinutes ?? 30;

    const firstPickupBase =
      specialRequestedPickup ??
      ready ??
      (lateDrop != null ? Math.max(0, lateDrop - 75) : 0);

    // FIX:
    // do not automatically move the planned pickup 15 minutes early
    const earliestPickup = firstPickupBase;
    const latestPickup = firstPickupBase + maxLate;

    const targetArrivalMin =
      lateDrop != null
        ? Math.max(0, lateDrop - preferredEarlyArrival)
        : undefined;

    const nextTrip = nextTripById.get(trip.id);

    let holdUntilMin: number | undefined;
    if (nextTrip) {
      const explicitReturn =
        timeToMin(riderRule?.returnPickupTime) ??
        timeToMin(nextTrip.requestedTimePickup);

      if (explicitReturn != null) {
        holdUntilMin = explicitReturn;
      } else {
        const arrivalEstimate =
          targetArrivalMin ?? lateDrop ?? firstPickupBase + 30;

        holdUntilMin =
          arrivalEstimate +
          estimateAppointmentDuration(trip.destination, durationRules);
      }
    }

    jobs.push({
      id: `job-out-${trip.id}`,
      tripIds: [trip.id],
      date: trip.date,
      riderNames: [trip.memberName],
      kind: "outbound",
      facilityKey: facilityKey(trip.destination),

      originStops: [trip.origin],
      destinationStops: [trip.destination],

      originExportStops: [trip.originExport],
      destinationExportStops: [trip.destinationExport],

      requestedPickupMins: [firstPickupBase],
      seats: trip.seats,

      earliestPickupMin: earliestPickup,
      latestPickupMin: latestPickup,
      targetArrivalMin,
      explicitPickupMin: firstPickupBase,
      notes: riderScopedNotes(trip.memberName, [
        trip.comments,
        trip.pickupComments,
        riderRule?.note,
        riderRule?.RequestedPickup
          ? `Special first-trip pickup: ${riderRule.RequestedPickup}`
          : "",
        nextTrip ? "Has consecutive second trip" : "",
        trip.seats > 1 ? `Seats used: ${trip.seats}` : "",
      ]),
      serviceDurationMin: estimateAppointmentDuration(
        trip.destination,
        durationRules,
      ),
      pairKey: trip.id,
      holdUntilMin,
      holdAddress: trip.destination,
    });
  }

  return jobs;
}

function scoreClusterCandidate(seed: Job, candidate: Job): number {
  let score = 0;

  const seedPickup = seed.requestedPickupMins[0] ?? seed.explicitPickupMin ?? 0;
  const candidatePickup =
    candidate.requestedPickupMins[0] ?? candidate.explicitPickupMin ?? 0;

  const seedOrigin = seed.originStops[0] ?? "";
  const candidateOrigin = candidate.originStops[0] ?? "";

  if (seedOrigin && candidateOrigin && seedOrigin === candidateOrigin) {
    score += 1000;
  }

  const timeDiff = Math.abs(seedPickup - candidatePickup);
  score += Math.max(0, 120 - timeDiff);

  if (
    seed.explicitPickupMin != null &&
    candidate.explicitPickupMin != null &&
    seed.explicitPickupMin === candidate.explicitPickupMin
  ) {
    score += 250;
  }

  return score;
}

function clusterOutboundJobs(jobs: Job[]): Job[] {
  const sorted = [...jobs].sort((a, b) => {
    const ta = a.explicitPickupMin ?? a.targetArrivalMin ?? a.earliestPickupMin;
    const tb = b.explicitPickupMin ?? b.targetArrivalMin ?? b.earliestPickupMin;
    return ta - tb;
  });

  const used = new Set<string>();
  const clusters: Job[] = [];

  for (const seed of sorted) {
    if (used.has(seed.id)) continue;

    const clusterMembers = [seed];
    used.add(seed.id);

    const candidatePool = sorted
      .filter((candidate) => {
        if (used.has(candidate.id)) return false;
        if (candidate.date !== seed.date) return false;
        if (candidate.kind !== "outbound") return false;
        if (candidate.facilityKey !== seed.facilityKey) return false;

        const seedAnchor =
          seed.explicitPickupMin ??
          seed.targetArrivalMin ??
          seed.earliestPickupMin;
        const candidateAnchor =
          candidate.explicitPickupMin ??
          candidate.targetArrivalMin ??
          candidate.earliestPickupMin;

        const windowDiff = Math.abs(seedAnchor - candidateAnchor);
        if (windowDiff > 30) return false;

        const currentSeats = clusterMembers.reduce((sum, x) => sum + x.seats, 0);
        if (!canShareVehicle(currentSeats, candidate.seats)) return false;

        return true;
      })
      .sort(
        (a, b) =>
          scoreClusterCandidate(seed, b) - scoreClusterCandidate(seed, a),
      );

    for (const candidate of candidatePool) {
      const currentSeats = clusterMembers.reduce((sum, x) => sum + x.seats, 0);
      if (!canShareVehicle(currentSeats, candidate.seats)) continue;

      clusterMembers.push(candidate);
      used.add(candidate.id);
    }

    if (clusterMembers.length === 1) {
      clusters.push(seed);
      continue;
    }

    const earliestPickupMin = Math.min(
      ...clusterMembers.map((x) => x.earliestPickupMin),
    );
    const latestPickupMin = Math.min(
      ...clusterMembers.map((x) => x.latestPickupMin),
    );
    const explicitPickupVals = clusterMembers
      .map((x) => x.explicitPickupMin)
      .filter((x): x is number => x != null);
    const targetArrivalVals = clusterMembers
      .map((x) => x.targetArrivalMin)
      .filter((x): x is number => x != null);
    const holdVals = clusterMembers
      .map((x) => x.holdUntilMin)
      .filter((x): x is number => x != null);

    clusters.push({
      id: `cluster-out-${clusterMembers.map((x) => x.id).join("__")}`,
      tripIds: clusterMembers.flatMap((x) => x.tripIds),
      date: seed.date,
      riderNames: clusterMembers.flatMap((x) => x.riderNames),
      kind: "outbound",
      facilityKey: seed.facilityKey,

      originStops: clusterMembers.flatMap((x) => x.originStops),
      destinationStops: [clusterMembers[0].destinationStops[0]],

      originExportStops: clusterMembers.flatMap((x) => x.originExportStops),
      destinationExportStops: [clusterMembers[0].destinationExportStops[0]],

      requestedPickupMins: clusterMembers.flatMap((x) => x.requestedPickupMins),
      seats: clusterMembers.reduce((sum, x) => sum + x.seats, 0),

      earliestPickupMin,
      latestPickupMin,
      explicitPickupMin:
        explicitPickupVals.length > 0 ? Math.min(...explicitPickupVals) : undefined,
      targetArrivalMin:
        targetArrivalVals.length > 0 ? Math.min(...targetArrivalVals) : undefined,
      notes: uniqueStrings(clusterMembers.flatMap((x) => x.notes)),
      serviceDurationMin: Math.max(
        ...clusterMembers.map((x) => x.serviceDurationMin),
      ),
      pairKey: `pair-${clusterMembers.map((x) => x.tripIds[0]).join("__")}`,
      holdUntilMin: holdVals.length > 0 ? Math.min(...holdVals) : undefined,
      holdAddress: clusterMembers[0].destinationStops[0],
    });
  }

  return clusters;
}

function buildSharedReturnJobs(
  outboundClusters: Job[],
  nextTripById: Map<string, TripRecord>,
  riderRules: RiderRule[],
  durationRules: DurationRule[],
): Job[] {
  const returnJobs: Job[] = [];

  for (const outbound of outboundClusters) {
    const returnTrips = outbound.tripIds
      .map((tripId) => nextTripById.get(tripId))
      .filter((t): t is TripRecord => t != null);

    if (returnTrips.length === 0) continue;

    const explicitOrEstimatedTimes: number[] = [];

    for (const returnTrip of returnTrips) {
      const riderRule = findRiderRule(returnTrip.memberName, riderRules);
      const explicitReturn =
        timeToMin(riderRule?.returnPickupTime) ??
        timeToMin(returnTrip.requestedTimePickup);

      if (explicitReturn != null) {
        explicitOrEstimatedTimes.push(explicitReturn);
      }
    }

    let sharedPickupMin: number;
    if (explicitOrEstimatedTimes.length > 0) {
      sharedPickupMin = Math.min(...explicitOrEstimatedTimes);
    } else {
      const outboundAnchor =
        outbound.targetArrivalMin ??
        outbound.explicitPickupMin ??
        outbound.earliestPickupMin;

      sharedPickupMin =
        outboundAnchor +
        estimateAppointmentDuration(outbound.destinationStops[0], durationRules);
    }

    const maxLate = Math.max(
      ...returnTrips.map((trip) => {
        const riderRule = findRiderRule(trip.memberName, riderRules);
        return riderRule?.maxLateMinutes ?? 10;
      }),
      10,
    );

    returnJobs.push({
      id: `job-ret-${outbound.id}`,
      tripIds: returnTrips.map((t) => t.id),
      date: outbound.date,
      riderNames: returnTrips.map((t) => t.memberName),
      kind: "return",
      facilityKey: facilityKey(outbound.destinationStops[0]),

      originStops: [outbound.destinationStops[0]],
      destinationStops: returnTrips.map((t) => t.destination),

      originExportStops: [outbound.destinationExportStops[0]],
      destinationExportStops: returnTrips.map((t) => t.destinationExport),

      requestedPickupMins: [sharedPickupMin],
      seats: returnTrips.reduce((sum, t) => sum + t.seats, 0),

      earliestPickupMin: sharedPickupMin,
      latestPickupMin: sharedPickupMin + maxLate,
      explicitPickupMin: sharedPickupMin,
      notes: [
        ...riderScopedNotes("ROUTE", [
          "Shared second-trip pickup based on outbound shared ride",
        ]),
        ...returnTrips.flatMap((trip) => {
          const riderRule = findRiderRule(trip.memberName, riderRules);
          return riderScopedNotes(trip.memberName, [
            trip.comments,
            trip.pickupComments,
            riderRule?.note,
            trip.seats > 1 ? `Seats used: ${trip.seats}` : "",
          ]);
        }),
      ],
      serviceDurationMin: estimateAppointmentDuration(
        outbound.destinationStops[0],
        durationRules,
      ),
      pairKey: outbound.pairKey,
    });
  }

  return returnJobs;
}

type DriverReservation = {
  pairKey: string;
  address: string;
  coord: Coord;
  dueMin: number;
};

function buildUnassignedStops(job: Job): RouteStop[] {
  const stops: RouteStop[] = [];

  if (job.kind === "outbound") {
    let cursor = job.explicitPickupMin ?? job.earliestPickupMin;

    const grouped = new Map<
      string,
      {
        address: string;
        exportAddress: string;
        riders: string[];
        pickupMins: number[];
      }
    >();

    for (let i = 0; i < job.originStops.length; i++) {
      const key = job.originStops[i];
      const existing = grouped.get(key);

      if (existing) {
        existing.riders.push(job.riderNames[i] ?? job.riderNames[0]);
        existing.pickupMins.push(job.requestedPickupMins[i] ?? cursor);
      } else {
        grouped.set(key, {
          address: job.originStops[i],
          exportAddress: job.originExportStops[i],
          riders: [job.riderNames[i] ?? job.riderNames[0]],
          pickupMins: [job.requestedPickupMins[i] ?? cursor],
        });
      }
    }

    for (const stop of Array.from(grouped.values())) {
      const stopTime = Math.max(cursor, ...stop.pickupMins);

      stops.push({
        kind: "pickup",
        address: stop.address,
        exportAddress: stop.exportAddress,
        riders: stop.riders,
        plannedTimeMin: stopTime,
      });

      cursor = stopTime + 5;
    }

    stops.push({
      kind: "dropoff",
      address: job.destinationStops[0],
      exportAddress: job.destinationExportStops[0],
      riders: [...job.riderNames],
      plannedTimeMin: cursor + 15,
    });

    return stops;
  }

  const pickupTime = job.explicitPickupMin ?? job.earliestPickupMin;
  stops.push({
    kind: "pickup",
    address: job.originStops[0],
    exportAddress: job.originExportStops[0],
    riders: [...job.riderNames],
    plannedTimeMin: pickupTime,
  });

  let cursor = pickupTime + 15;
  for (let i = 0; i < job.destinationStops.length; i++) {
    stops.push({
      kind: "dropoff",
      address: job.destinationStops[i],
      exportAddress: job.destinationExportStops[i],
      riders: [job.riderNames[i] ?? job.riderNames[0]],
      plannedTimeMin: cursor,
    });
    cursor += 5;
  }

  return stops;
}

export async function planRoutes(
  trips: TripRecord[],
  drivers: DriverShift[],
  durationRules: DurationRule[],
  riderRules: RiderRule[],
  setProgress: (value: string) => void,
): Promise<PlannedRoute[]> {
  const { nextTripById, prevTripById } = buildPairedTripMap(trips);

  const individualOutboundJobs = buildIndividualOutboundJobs(
    trips,
    durationRules,
    riderRules,
    nextTripById,
    prevTripById,
  );

  const outboundJobs = clusterOutboundJobs(individualOutboundJobs);
  const returnJobs = buildSharedReturnJobs(
    outboundJobs,
    nextTripById,
    riderRules,
    durationRules,
  );

  const jobs = [...outboundJobs, ...returnJobs].sort((a, b) => {
    const ta = a.explicitPickupMin ?? a.targetArrivalMin ?? a.earliestPickupMin;
    const tb = b.explicitPickupMin ?? b.targetArrivalMin ?? b.earliestPickupMin;
    return ta - tb;
  });

  if (drivers.length === 0) return [];

  const uniqueAddresses = new Set<string>();
  uniqueAddresses.add(BASE_ADDRESS);

  for (const job of jobs) {
    job.originStops.forEach((x) => uniqueAddresses.add(x));
    job.destinationStops.forEach((x) => uniqueAddresses.add(x));
    if (job.holdAddress) uniqueAddresses.add(job.holdAddress);
  }

  const coordCache: Record<string, Coord> = {
    [facilityKey(BASE_ADDRESS)]: BASE_COORD,
  };

  let idx = 0;
  for (const address of Array.from(uniqueAddresses)) {
    idx += 1;
    setProgress(
      `Geocoding ${idx}/${uniqueAddresses.size}: ${address.slice(0, 40)}`,
    );
    if (facilityKey(address) === facilityKey(BASE_ADDRESS)) continue;
    const coord = await geocodeAddress(address, coordCache);
    if (coord) coordCache[facilityKey(address)] = coord;
  }

  type DriverState = {
    driver: DriverShift;
    currentTime: number;
    currentCoord: Coord;
    currentAddress: string;
    routes: PlannedRoute[];
    reservation?: DriverReservation;
  };

  const states: DriverState[] = drivers.map((d) => ({
    driver: d,
    currentTime: timeToMin(d.startTime) ?? 0,
    currentCoord: BASE_COORD,
    currentAddress: BASE_ADDRESS,
    routes: [],
  }));

  const routes: PlannedRoute[] = [];

  for (const job of jobs) {
    setProgress(
      `Planning ${job.kind} for ${job.riderNames.join(", ")} (${job.date})`,
    );

    let best:
      | {
          stateIndex: number;
          route: PlannedRoute;
          finishTime: number;
          finishCoord: Coord;
          finishAddress: string;
          score: number;
          newReservation?: DriverReservation;
          clearReservation?: boolean;
        }
      | undefined;

    for (let s = 0; s < states.length; s++) {
      const state = states[s];
      const shiftEnd = timeToMin(state.driver.endTime) ?? 1439;
      if (state.currentTime > shiftEnd) continue;

      const reservation = state.reservation;
      const isReservedReturn =
        reservation != null &&
        job.kind === "return" &&
        job.pairKey != null &&
        reservation.pairKey === job.pairKey;

      let cursorTime = state.currentTime;
      let cursorCoord = state.currentCoord;
      let totalMiles = 0;
      const stops: RouteStop[] = [];

      if (job.kind === "outbound") {
        const destinationCoord = coordCache[facilityKey(job.destinationStops[0])];

        const pickupStopsRaw: Array<{
          address: string;
          exportAddress: string;
          rider: string;
          coord: Coord;
          requestedPickupMin: number;
        }> = job.originStops
          .map((address, i) => {
            const coord = coordCache[facilityKey(address)];
            if (!coord) return null;
            return {
              address,
              exportAddress: job.originExportStops[i],
              rider: job.riderNames[i] ?? job.riderNames[0],
              coord,
              requestedPickupMin:
                job.requestedPickupMins[i] ??
                job.explicitPickupMin ??
                job.earliestPickupMin,
            };
          })
          .filter(
            (
              x,
            ): x is {
              address: string;
              exportAddress: string;
              rider: string;
              coord: Coord;
              requestedPickupMin: number;
            } => x != null,
          );

        const groupedMap = new Map<
          string,
          {
            address: string;
            exportAddress: string;
            riders: string[];
            coord: Coord;
            requestedPickupMin: number;
          }
        >();

        for (const stop of pickupStopsRaw) {
          const existing = groupedMap.get(stop.address);

          if (existing) {
            existing.riders.push(stop.rider);
            existing.requestedPickupMin = Math.max(
              existing.requestedPickupMin,
              stop.requestedPickupMin,
            );
          } else {
            groupedMap.set(stop.address, {
              address: stop.address,
              exportAddress: stop.exportAddress,
              riders: [stop.rider],
              coord: stop.coord,
              requestedPickupMin: stop.requestedPickupMin,
            });
          }
        }

        const pickupStops = Array.from(groupedMap.values());

        if (destinationCoord && pickupStops.length > 1) {
          const order = await orderOutboundPickupsByFurthestFirst(
            pickupStops.map((x) => x.coord),
            destinationCoord,
          );

          const ordered = order.map((i) => pickupStops[i]);
          pickupStops.length = 0;
          pickupStops.push(...ordered);
        }

        for (const stop of pickupStops) {
          const travel = await driveEstimate(cursorCoord, stop.coord, cursorTime);
          cursorTime += travel.minutes;
          totalMiles += travel.miles;

          const waitUntil = Math.max(cursorTime, stop.requestedPickupMin);
          cursorTime = waitUntil;

          stops.push({
            kind: "pickup",
            address: stop.address,
            exportAddress: stop.exportAddress,
            riders: stop.riders,
            plannedTimeMin: cursorTime,
          });

          cursorTime += 4;
          cursorCoord = stop.coord;
        }

        if (!destinationCoord) continue;

        const finalDropAddress = job.destinationStops[0];
        const finalDropExportAddress = job.destinationExportStops[0];

        const leg = await driveEstimate(cursorCoord, destinationCoord, cursorTime);
        cursorTime += leg.minutes;
        totalMiles += leg.miles;

        stops.push({
          kind: "dropoff",
          address: finalDropAddress,
          exportAddress: finalDropExportAddress,
          riders: [...job.riderNames],
          plannedTimeMin: cursorTime,
        });

        const firstPickup =
          stops.find((x) => x.kind === "pickup")?.plannedTimeMin ?? cursorTime;

        if (firstPickup > job.latestPickupMin) continue;
        if (cursorTime > shiftEnd) continue;

        if (reservation && !isReservedReturn) {
          const candidatePickupCoord =
            pickupStops[0]?.coord ?? reservation.coord;

          const sideTripCheck = await canDoSideTripAndReturn({
            fromFacility: reservation.coord,
            candidatePickup: candidatePickupCoord,
            candidateDropoff: destinationCoord,
            returnFacility: reservation.coord,
            minutesAvailable: reservation.dueMin - state.currentTime,
          });

          if (!sideTripCheck.fits) {
            continue;
          }
        }

        const latenessPenalty =
          job.targetArrivalMin != null && cursorTime > job.targetArrivalMin
            ? (cursorTime - job.targetArrivalMin) * 8
            : 0;

        const underFillPenalty =
          job.seats <= 3 ? Math.max(0, 3 - job.seats) * 0.75 : 0;

        const score = totalMiles + latenessPenalty + underFillPenalty;

        const route: PlannedRoute = {
          routeId: `route-${job.id}-${state.driver.id}`,
          date: job.date,
          driverName: state.driver.driverName,
          vehicleId: state.driver.vehicleId,
          totalSeats: job.seats,
          totalMiles: Number(totalMiles.toFixed(2)),
          startMin: firstPickup,
          endMin: cursorTime,
          riders: [...job.riderNames],
          notes: uniqueStrings(job.notes),
          stops,
          tripGroupKey: job.pairKey ?? job.id,
          segmentType: "initial",
        };

        let newReservation: DriverReservation | undefined;
        if (job.pairKey && job.holdUntilMin && job.holdAddress) {
          newReservation = {
            pairKey: job.pairKey,
            address: job.holdAddress,
            coord: destinationCoord,
            dueMin: job.holdUntilMin,
          };
        }

        if (!best || score < best.score) {
          best = {
            stateIndex: s,
            route,
            finishTime: cursorTime + 6,
            finishCoord: destinationCoord,
            finishAddress: finalDropAddress,
            score,
            newReservation,
          };
        }
      } else {
        const pickupAddress = job.originStops[0];
        const pickupExportAddress = job.originExportStops[0];
        const pickupCoord = coordCache[facilityKey(pickupAddress)];
        if (!pickupCoord) continue;

        const legToPickup = await driveEstimate(cursorCoord, pickupCoord, cursorTime);
        cursorTime += legToPickup.minutes;
        totalMiles += legToPickup.miles;

        cursorTime = Math.max(job.earliestPickupMin, cursorTime);

        stops.push({
          kind: "pickup",
          address: pickupAddress,
          exportAddress: pickupExportAddress,
          riders: [...job.riderNames],
          plannedTimeMin: cursorTime,
        });

        cursorTime += 4;
        cursorCoord = pickupCoord;

        const dropoffs: Array<{
          address: string;
          exportAddress: string;
          rider: string;
          coord: Coord;
        }> = job.destinationStops
          .map((address, i) => {
            const coord = coordCache[facilityKey(address)];
            if (!coord) return null;
            return {
              address,
              exportAddress: job.destinationExportStops[i],
              rider: job.riderNames[i] ?? job.riderNames[0],
              coord,
            };
          })
          .filter(
            (
              x,
            ): x is {
              address: string;
              exportAddress: string;
              rider: string;
              coord: Coord;
            } => x != null,
          );

        if (dropoffs.length > 1) {
          const order = await orderReturnDropoffsClosestFirst(
            pickupCoord,
            dropoffs.map((x) => x.coord),
          );

          const ordered = order.map((i) => dropoffs[i]);
          dropoffs.length = 0;
          dropoffs.push(...ordered);
        }

        for (const stop of dropoffs) {
          const leg = await driveEstimate(cursorCoord, stop.coord, cursorTime);
          cursorTime += leg.minutes;
          totalMiles += leg.miles;

          stops.push({
            kind: "dropoff",
            address: stop.address,
            exportAddress: stop.exportAddress,
            riders: [stop.rider],
            plannedTimeMin: cursorTime,
          });

          cursorTime += 3;
          cursorCoord = stop.coord;
        }

        const firstPickup =
          stops.find((x) => x.kind === "pickup")?.plannedTimeMin ?? cursorTime;

        if (firstPickup > job.latestPickupMin) continue;
        if (cursorTime > shiftEnd) continue;

        const score = totalMiles;

        const route: PlannedRoute = {
          routeId: `route-${job.id}-${state.driver.id}`,
          date: job.date,
          driverName: state.driver.driverName,
          vehicleId: state.driver.vehicleId,
          totalSeats: job.seats,
          totalMiles: Number(totalMiles.toFixed(2)),
          startMin: firstPickup,
          endMin: cursorTime,
          riders: [...job.riderNames],
          notes: uniqueStrings(job.notes),
          stops,
          tripGroupKey: job.pairKey ?? job.id,
          segmentType: "return",
        };

        if (!best || score < best.score) {
          best = {
            stateIndex: s,
            route,
            finishTime: cursorTime + 6,
            finishCoord: cursorCoord,
            finishAddress:
              dropoffs.length > 0
                ? dropoffs[dropoffs.length - 1].address
                : pickupAddress,
            score,
            clearReservation: true,
          };
        }
      }
    }

    if (best) {
      const state = states[best.stateIndex];
      state.currentTime = best.finishTime;
      state.currentCoord = best.finishCoord;
      state.currentAddress = best.finishAddress;
      state.routes.push(best.route);

      if (best.clearReservation) {
        state.reservation = undefined;
      }
      if (best.newReservation) {
        state.reservation = best.newReservation;
      }

      routes.push(best.route);
    } else {
      const stops = buildUnassignedStops(job);
      routes.push({
        routeId: `unassigned-${job.id}`,
        date: job.date,
        driverName: "UNASSIGNED",
        vehicleId: "-",
        totalSeats: job.seats,
        totalMiles: 0,
        startMin:
          stops[0]?.plannedTimeMin ??
          (job.explicitPickupMin ?? job.earliestPickupMin),
        endMin:
          stops[stops.length - 1]?.plannedTimeMin ??
          (job.explicitPickupMin ?? job.earliestPickupMin),
        riders: [...job.riderNames],
        notes: [
          "Could not place inside current driver schedule or hold window.",
          ...job.notes,
        ],
        stops,
        tripGroupKey: job.pairKey ?? job.id,
        segmentType: job.kind === "outbound" ? "initial" : "return",
      });
    }
  }

  const groupStartMap = new Map<string, number>();
  for (const route of routes) {
    const key = route.tripGroupKey ?? route.routeId;
    const current = groupStartMap.get(key);
    if (current == null || route.startMin < current) {
      groupStartMap.set(key, route.startMin);
    }
  }

  const segmentRank = (route: PlannedRoute) => {
    if (route.segmentType === "initial") return 0;
    if (route.segmentType === "return") return 1;
    return 2;
  };

  return routes.sort((a, b) => {
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }

    const aGroup = a.tripGroupKey ?? a.routeId;
    const bGroup = b.tripGroupKey ?? b.routeId;

    const aGroupStart = groupStartMap.get(aGroup) ?? a.startMin;
    const bGroupStart = groupStartMap.get(bGroup) ?? b.startMin;

    if (aGroupStart !== bGroupStart) {
      return aGroupStart - bGroupStart;
    }

    if (aGroup !== bGroup) {
      return aGroup.localeCompare(bGroup);
    }

    const rankDiff = segmentRank(a) - segmentRank(b);
    if (rankDiff !== 0) return rankDiff;

    return a.startMin - b.startMin;
  });
}