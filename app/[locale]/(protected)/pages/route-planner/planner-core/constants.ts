import type { Coord, DriverShift, DurationRule, RiderRule } from "./types";

export const BASE_ADDRESS =
  "590 Missouri Ave, Jeffersonville, IN, United States";

export const BASE_COORD: Coord = {
  lat: 38.27355,
  lon: -85.75059,
};

export const DEFAULT_DRIVERS: DriverShift[] = [
  {
    id: "d1",
    driverName: "Driver 1",
    vehicleId: "Car 1",
    startTime: "04:00",
    endTime: "14:00",
  },
  {
    id: "d2",
    driverName: "Driver 2",
    vehicleId: "Car 2",
    startTime: "05:00",
    endTime: "15:00",
  },
  {
    id: "d3",
    driverName: "Driver 3",
    vehicleId: "Car 3",
    startTime: "07:00",
    endTime: "17:00",
  },
  {
    id: "d4",
    driverName: "Driver 4",
    vehicleId: "Car 4",
    startTime: "09:00",
    endTime: "19:00",
  },
];

export const DEFAULT_DURATION_RULES: DurationRule[] = [
  {
    contains: "7509 CHARLESTOWN PIKE",
    appointmentDuration: 15,
  },
  {
    contains: "2202 STATE ST",
    appointmentDuration: 45,
  },
  {
    contains: "355 Quartermaster Ct",
    appointmentDuration: 60,
  },
  {
    contains: "810 EASTERN BLVD",
    appointmentDuration: 75,
  },
];

export const DEFAULT_RIDER_RULES: RiderRule[] = [
  {
    nameContains: "Loretta Lewellen",
    RequestedPickup: "04:20",
    note: "Okay going much earlier than listed ready time.",
  },
  {
    nameContains: "PULIDO, LYAM SANDOVAL",
    RequestedPickup: "08:20",
    maxLateMinutes: 5,
  },
];