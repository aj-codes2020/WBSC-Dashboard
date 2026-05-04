"use client";

import React, { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SiteBreadcrumb from "@/components/site-breadcrumb";

import {
  DEFAULT_DRIVERS,
  DEFAULT_DURATION_RULES,
  DEFAULT_RIDER_RULES,
} from "./planner-core/constants";
import { parseCsvRows } from "./planner-core/csv";
import { downloadRoutesCsv } from "./planner-core/export";
import { planRoutes } from "./planner-core/planner";
import { minToTime } from "./planner-core/time";
import type {
  CsvValue,
  DriverShift,
  DurationRule,
  Matrix,
  PlannedRoute,
  RiderRule,
} from "./planner-core/types";

function fileToMatrix(file: File): Promise<Matrix> {
  const lower = file.name.toLowerCase();

  if (lower.endsWith(".csv")) {
    return new Promise((resolve, reject) => {
      Papa.parse<CsvValue[]>(file, {
        complete: (results) => resolve(results.data as Matrix),
        error: reject,
        skipEmptyLines: true,
      });
    });
  }

  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          const data = event.target?.result;
          if (!data) {
            reject(new Error("Unable to read uploaded file."));
            return;
          }

          const workbook = XLSX.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];

          const matrix = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            raw: false,
            defval: "",
          }) as Matrix;

          resolve(matrix);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error("Failed reading file."));
      reader.readAsArrayBuffer(file);
    });
  }

  return Promise.reject(
    new Error("Unsupported file type. Please upload a .csv or .xlsx file."),
  );
}

type SaveSection = "drivers" | "durationRules" | "riderRules";

export default function Page() {
  const [file, setFile] = useState<File | null>(null);

  const [driversJson, setDriversJson] = useState(
    JSON.stringify(DEFAULT_DRIVERS, null, 2),
  );
  const [durationJson, setDurationJson] = useState(
    JSON.stringify(DEFAULT_DURATION_RULES, null, 2),
  );
  const [riderRulesJson, setRiderRulesJson] = useState(
    JSON.stringify(DEFAULT_RIDER_RULES, null, 2),
  );

  const [routes, setRoutes] = useState<PlannedRoute[]>([]);
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  const [settingsLoading, setSettingsLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState("");
  const [savingSection, setSavingSection] = useState<SaveSection | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setSettingsLoading(true);

        const res = await fetch("/api/planner-settings", {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
        });

        if (!res.ok) {
          setSettingsLoading(false);
          return;
        }

        const data = (await res.json()) as {
          drivers?: unknown[];
          durationRules?: unknown[];
          riderRules?: unknown[];
        };

        if (Array.isArray(data.drivers) && data.drivers.length > 0) {
          setDriversJson(JSON.stringify(data.drivers, null, 2));
        }

        if (
          Array.isArray(data.durationRules) &&
          data.durationRules.length > 0
        ) {
          setDurationJson(JSON.stringify(data.durationRules, null, 2));
        }

        if (Array.isArray(data.riderRules) && data.riderRules.length > 0) {
          setRiderRulesJson(JSON.stringify(data.riderRules, null, 2));
        }
      } catch {
        // leave defaults in place
      } finally {
        setSettingsLoading(false);
      }
    };

    void loadSettings();
  }, []);

  const totals = useMemo(() => {
    const assigned = routes.filter((r) => r.driverName !== "UNASSIGNED");
    const unassigned = routes.filter((r) => r.driverName === "UNASSIGNED");

    return {
      assigned: assigned.length,
      unassigned: unassigned.length,
      totalTrips: routes.length,
    };
  }, [routes]);

  const saveSection = async (section: SaveSection) => {
    try {
      setSaveMessage("");
      setSavingSection(section);

      let parsedValue: unknown[];

      if (section === "drivers") {
        parsedValue = JSON.parse(driversJson) as unknown[];
      } else if (section === "durationRules") {
        parsedValue = JSON.parse(durationJson) as unknown[];
      } else {
        parsedValue = JSON.parse(riderRulesJson) as unknown[];
      }

      if (!Array.isArray(parsedValue)) {
        throw new Error(`${section} must be a JSON array.`);
      }

      const res = await fetch("/api/planner-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          section,
          value: parsedValue,
        }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        savedCount?: number;
      };

      if (!res.ok) {
        throw new Error(data.error || `Failed to save ${section}.`);
      }

      setSaveMessage(
        `${section} saved successfully (${data.savedCount ?? 0} items).`,
      );
    } catch (error) {
      setSaveMessage(
        error instanceof Error ? error.message : `Failed to save ${section}.`,
      );
    } finally {
      setSavingSection(null);
    }
  };

  const handlePlan = async () => {
    if (!file) return;

    setLoading(true);
    setErrors([]);
    setRoutes([]);
    setSummary("");
    setProgress("Reading file...");

    try {
      const matrix = await fileToMatrix(file);

      const drivers = JSON.parse(driversJson) as DriverShift[];
      const durationRules = JSON.parse(durationJson) as DurationRule[];
      const riderRules = JSON.parse(riderRulesJson) as RiderRule[];

      const trips = parseCsvRows(matrix);
      if (trips.length === 0) {
        throw new Error("No trips were parsed from the uploaded file.");
      }

      const plannedRoutes = await planRoutes(
        trips,
        drivers,
        durationRules,
        riderRules,
        setProgress,
      );

      setRoutes(plannedRoutes);

      const methadoneTrips = trips.filter((t) =>
        t.destination.toUpperCase().includes("7509 CHARLESTOWN PIKE"),
      ).length;

      setSummary(
        [
          `Parsed ${trips.length} trip rows.`,
          `Found ${methadoneTrips} trips tied to 7509 Charlestown Pike.`,
          `Assigned ${
            plannedRoutes.filter((r) => r.driverName !== "UNASSIGNED").length
          } route blocks.`,
          `Unassigned ${
            plannedRoutes.filter((r) => r.driverName === "UNASSIGNED").length
          } route blocks.`,
        ].join(" "),
      );
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Unknown planner error"]);
    } finally {
      setLoading(false);
      setProgress("");
    }
  };

  return (
    <div className="space-y-6">
      <SiteBreadcrumb />

      <Card>
        <CardHeader>
          <CardTitle>Route Planner</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          <div className="flex flex-wrap items-center gap-3">
            <Button asChild>
              <label className="cursor-pointer">
                Choose Route File
                <input
                  className="hidden"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </Button>

            <Button onClick={handlePlan} disabled={!file || loading}>
              {loading ? "Planning..." : "Create Route Plan"}
            </Button>

            <Button
              variant="outline"
              onClick={() => downloadRoutesCsv(routes)}
              disabled={routes.length === 0}
            >
              Download Route Plan
            </Button>
          </div>

          {file && (
            <div className="text-sm">
              <strong>Selected file:</strong> {file.name}
            </div>
          )}

          {progress && <div className="text-sm">{progress}</div>}
          {summary && <div className="text-sm">{summary}</div>}

          {saveMessage && (
            <div className="rounded border border-blue-300 p-3 text-sm text-blue-700">
              {saveMessage}
            </div>
          )}

          {errors.length > 0 && (
            <div className="rounded border border-red-300 p-3 text-sm text-red-700">
              {errors.map((e) => (
                <div key={e}>{e}</div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Drivers</CardTitle>
            <Button
              variant="outline"
              onClick={() => void saveSection("drivers")}
              disabled={settingsLoading || savingSection === "drivers"}
            >
              {savingSection === "drivers" ? "Saving..." : "Save"}
            </Button>
          </CardHeader>
          <CardContent>
            <textarea
              value={driversJson}
              onChange={(e) => setDriversJson(e.target.value)}
              className="min-h-[320px] w-full rounded border p-3 font-mono text-xs"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Appointment Duration Rules</CardTitle>
            <Button
              variant="outline"
              onClick={() => void saveSection("durationRules")}
              disabled={settingsLoading || savingSection === "durationRules"}
            >
              {savingSection === "durationRules" ? "Saving..." : "Save"}
            </Button>
          </CardHeader>
          <CardContent>
            <textarea
              value={durationJson}
              onChange={(e) => setDurationJson(e.target.value)}
              className="min-h-[320px] w-full rounded border p-3 font-mono text-xs"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Special Rider Rules</CardTitle>
            <Button
              variant="outline"
              onClick={() => void saveSection("riderRules")}
              disabled={settingsLoading || savingSection === "riderRules"}
            >
              {savingSection === "riderRules" ? "Saving..." : "Save"}
            </Button>
          </CardHeader>
          <CardContent>
            <textarea
              value={riderRulesJson}
              onChange={(e) => setRiderRulesJson(e.target.value)}
              className="min-h-[320px] w-full rounded border p-3 font-mono text-xs"
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Assigned routes</div>
            <div className="text-2xl font-semibold">{totals.assigned}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Unassigned routes</div>
            <div className="text-2xl font-semibold">{totals.unassigned}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Total trips</div>
            <div className="text-2xl font-semibold">{totals.totalTrips}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Planned Routes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {routes.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No routes yet. Upload a file and click Create Route Plan.
            </div>
          ) : (
            routes.map((route) => (
              <div key={route.routeId} className="rounded border p-4">
                <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <div>
                    <strong>{route.driverName}</strong> / {route.vehicleId}
                  </div>
                  <div>{route.date}</div>
                  <div>
                    {minToTime(route.startMin)} - {minToTime(route.endMin)}
                  </div>
                  <div>Seats: {route.totalSeats}</div>
                </div>

                <div className="mb-2 text-sm">
                  <strong>Riders:</strong> {route.riders.join(", ")}
                </div>

                {route.notes.length > 0 && (
                  <div className="mb-3 space-y-1 text-xs text-muted-foreground">
                    {route.notes.map((note, noteIndex) => {
                      const isUnassignedWarning =
                        note ===
                        "Could not place inside current driver schedule or hold window.";

                      return (
                        <div
                          key={`${route.routeId}-note-${noteIndex}`}
                          className={isUnassignedWarning ? "text-red-600 font-medium" : ""}
                        >
                          {note}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="space-y-2">
                  {route.stops.map((stop, i) => (
                    <div
                      key={`${route.routeId}-${i}`}
                      className="rounded bg-muted/40 p-2 text-sm"
                    >
                      <strong>{stop.kind.toUpperCase()}</strong> —{" "}
                      {minToTime(stop.plannedTimeMin)} — {stop.address}
                      <div className="text-xs text-muted-foreground">
                        {stop.riders.join(", ")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}