import * as XLSX from "xlsx";
import { minToTime } from "./time";
import type { PlannedRoute } from "./types";

export function downloadRoutesCsv(routes: PlannedRoute[]) {
  const rows = [
    [
      "Date",
      "Route ID",
      "Driver",
      "Vehicle",
      "Start",
      "End",
      "Seats",
      "Miles",
      "Riders",
      "Stop Type",
      "Stop Time",
      "Stop Address",
      "Notes",
    ],
  ];

  for (const route of routes) {
    for (const stop of route.stops) {
      rows.push([
        route.date,
        route.routeId,
        route.driverName,
        route.vehicleId,
        minToTime(route.startMin),
        minToTime(route.endMin),
        String(route.totalSeats),
        String(route.totalMiles),
        route.riders.join(" | "),
        stop.kind,
        minToTime(stop.plannedTimeMin),
        stop.exportAddress || stop.address,
        route.notes.join(" | "),
      ]);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Route Plan");
  XLSX.writeFile(wb, "route-plan.csv.xlsx");
}