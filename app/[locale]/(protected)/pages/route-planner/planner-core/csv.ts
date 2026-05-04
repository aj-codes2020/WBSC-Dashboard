import type { CsvValue, Matrix, TripRecord } from "./types";
import {
  addressForExport,
  detectSeats,
  isLikelyReturn,
  normalizeAddress,
  parseMiles,
} from "./rules";

function parseBookingIdNumber(value: string): number | null {
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

export function parseCsvRows(rows: Matrix): TripRecord[] {
  const header = (rows[0] || []).map((x) => String(x ?? "").trim());
  const idx = (name: string) => header.indexOf(name);

  const get = (row: CsvValue[], name: string) => {
    const i = idx(name);
    return i >= 0 ? String(row[i] ?? "").trim() : "";
  };

  const isRaw = header.includes("Booking Id");
  const trips: TripRecord[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row.some(Boolean)) continue;

    if (isRaw) {
      const bookingId = get(row, "Booking Id");
      const memberName = get(row, "Client Name");
      const requestedTimePickup = get(row, "Requested Time Pickup") || undefined;
      const requestedLateDropoff = get(row, "Requested Late Dropoff") || undefined;

      const originRaw = get(row, "Origin");
      const destinationRaw = get(row, "Destination");

      const pickupComments = get(row, "Pickup Comments");
      const comments = get(row, "Comments");
      const directDistanceMiles = parseMiles(get(row, "Direct Distance"));
      const passengerTypes = get(row, "Passenger Types");
      const purpose = get(row, "Purpose");
      const date = get(row, "Date") || "";
      const seats = detectSeats(passengerTypes, comments, pickupComments);

      const origin = normalizeAddress(originRaw);
      const destination = normalizeAddress(destinationRaw);

      const originExport = addressForExport(originRaw);
      const destinationExport = addressForExport(destinationRaw);

      const isReturn = isLikelyReturn(purpose, destination, requestedTimePickup);

      trips.push({
        id: `raw-${i}-${bookingId}`,
        bookingId,
        bookingIdNumber: parseBookingIdNumber(bookingId),
        date,
        memberName,
        requestedTimePickup,
        requestedLateDropoff,
        origin,
        destination,
        originExport,
        destinationExport,
        pickupComments,
        comments,
        directDistanceMiles,
        passengerTypes,
        purpose,
        seats,
        isReturn,
      });
    } else {
      const bookingId = get(row, "Trip No.");
      const memberName = get(row, "Member's Name");
      const requestedTimePickup = get(row, "Requested Time Pickup") || undefined;
      const requestedLateDropoff = get(row, "Requested Late Dropoff") || undefined;

      const originRaw = get(row, "Origins");
      const destinationRaw = get(row, "Destination");

      const pickupComments = get(row, "Pickup Comments");
      const comments = get(row, "Pickup Comments");
      const directDistanceMiles = parseMiles(get(row, "Direct Distance"));
      const passengerTypes = get(row, "Passenger Types");
      const purpose = get(row, "Purpose");
      const date = get(row, "Date") || "";
      const seats = detectSeats(passengerTypes, comments, pickupComments);

      const origin = normalizeAddress(originRaw);
      const destination = normalizeAddress(destinationRaw);

      const originExport = addressForExport(originRaw);
      const destinationExport = addressForExport(destinationRaw);

      const isReturn = isLikelyReturn(purpose, destination, requestedTimePickup);

      trips.push({
        id: `converted-${i}-${bookingId}`,
        bookingId,
        bookingIdNumber: parseBookingIdNumber(bookingId),
        date,
        memberName,
        requestedTimePickup,
        requestedLateDropoff,
        origin,
        destination,
        originExport,
        destinationExport,
        pickupComments,
        comments,
        directDistanceMiles,
        passengerTypes,
        purpose,
        seats,
        isReturn,
      });
    }
  }

  return trips;
}