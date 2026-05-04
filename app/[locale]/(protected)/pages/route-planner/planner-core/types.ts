export type CsvValue = string | number | null | undefined;
export type Matrix = CsvValue[][];

export type Coord = {
  lat: number;
  lon: number;
};

export type DriverShift = {
  id: string;
  driverName: string;
  vehicleId: string;
  startTime: string;
  endTime: string;
};

export type DurationRule = {
  contains: string;
  appointmentDuration: number;
};

export type RiderRule = {
  nameContains: string;
  RequestedPickup?: string;
  maxLateMinutes?: number;
  preferredEarlyArrivalMinutes?: number;
  returnPickupTime?: string;
  note?: string;
};

export type TripRecord = {
  id: string;
  bookingId: string;
  bookingIdNumber: number | null;
  date: string;
  memberName: string;
  requestedTimePickup?: string;
  requestedLateDropoff?: string;

  origin: string;
  destination: string;

  originExport: string;
  destinationExport: string;

  pickupComments: string;
  comments: string;
  directDistanceMiles: number;
  passengerTypes: string;
  purpose: string;
  seats: number;
  isReturn: boolean;
};

export type Job = {
  id: string;
  tripIds: string[];
  date: string;
  riderNames: string[];
  kind: "outbound" | "return";
  facilityKey: string;

  originStops: string[];
  destinationStops: string[];

  originExportStops: string[];
  destinationExportStops: string[];

  requestedPickupMins: number[];
  seats: number;

  earliestPickupMin: number;
  latestPickupMin: number;
  targetArrivalMin?: number;
  explicitPickupMin?: number;

  notes: string[];
  serviceDurationMin: number;
  pairKey?: string;
  holdUntilMin?: number;
  holdAddress?: string;
};

export type RouteStop = {
  kind: "pickup" | "dropoff";
  address: string;
  exportAddress?: string;
  riders: string[];
  plannedTimeMin: number;
};

export type PlannedRoute = {
  routeId: string;
  date: string;
  driverName: string;
  vehicleId: string;
  totalSeats: number;
  totalMiles: number;
  startMin: number;
  endMin: number;
  riders: string[];
  notes: string[];
  stops: RouteStop[];
  tripGroupKey?: string;
  segmentType?: "initial" | "return";
};