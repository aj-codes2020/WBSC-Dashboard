"use client";

import React, { useState } from "react";
import Papa, { ParseResult } from "papaparse";
import * as XLSX from "xlsx";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import SiteBreadcrumb from "@/components/site-breadcrumb";

import CSVHistory from "./csv-history";
import type { DataProps } from "./csv-history/columns";
import { initialData } from "./csv-history/data";

type Row = (string | number | null | undefined)[];
type Matrix = Row[];
type MatrixOut = (string | number)[][];

export default function Page() {
  const [file, setFile] = useState<File | null>(null);

  // rows for the table
  const [history, setHistory] = useState<DataProps[]>(initialData);

  // map from history row id -> processed matrix
  const [processedFiles, setProcessedFiles] = useState<
    Record<string | number, MatrixOut>
  >({});

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] ?? null;
    setFile(selectedFile);
  };

  const processData = (rows: Matrix): MatrixOut => {
    const H = (rows[0] ?? []) as string[];
    const idx = (h: string) => H.indexOf(h);

    const get = (row: Row, h: string): string => {
      const i = idx(h);
      const val = i >= 0 ? row[i] : "";
      return val != null ? String(val) : "";
    };

    const parseDate = (s: string): Date | null => {
      if (!s) return null;
      const dISO = new Date(s);
      if (!Number.isNaN(dISO.getTime())) return dISO;
      const mdy = s.split(/[\/\-]/);
      if (mdy.length === 3) {
        const [m, d, y] = mdy.map((t) => t.trim());
        const dte = new Date(+y, +m - 1, +d);
        if (!Number.isNaN(dte.getTime())) return dte;
      }
      return null;
    };

    const targetHeaders: string[] = [
      "Date",
      "Trip No.",
      "Member's Name",
      "Requested Time Pickup",
      "Requested Late Dropoff",
      "Pick-up Time",
      "Origins",
      "Drop-off Time",
      "Destination",
      "Total Mileage",
      "Client Signature",
      "Member Unable to Sign UTS?",
      "Pickup Comments",
      "Direct Distance",
      "Passenger Types",
      "Space Types",
      "Driver",
      "Outcome",
      "Has Note",
      "Purpose",
      "Provider Cost",
    ];

    let out: MatrixOut = [targetHeaders];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || !row.some(Boolean)) continue;

      const tripNo = get(row, "Booking Id");
      const member = get(row, "Client Name") || "";
      let memberFmt = member;

      // Convert "First Last" to "Last, First"
      if (member && !member.includes(",") && member.includes(" ")) {
        const parts = member.trim().split(/\s+/);
        if (parts.length >= 2) {
          const lastName = (parts.at(-1) ?? "").replace(/,$/, "");
          const firstNames = parts.slice(0, -1).join(" ");
          memberFmt = `${lastName}, ${firstNames}`;
        }
      }

      const reqTimePickup = get(row, "Requested Time Pickup");
      const reqLateDropoff = get(row, "Requested Late Dropoff");

      const origins = [
        get(row, "Site Name(orig)"),
        get(row, "Origin"),
        // get(row, "City (Orig)"),
        get(row, "Phone Pickup"),
      ]
        .filter(Boolean)
        .join("\n");

      const destination = [
        get(row, "Site Name(dest)"),
        get(row, "Destination"),
        // get(row, "City (Dest)"),
        get(row, "Phone Dropoff"),
      ]
        .filter(Boolean)
        .join("\n");

      const dateRaw = get(row, "Date");
      const dObj = parseDate(dateRaw);
      const dateDisp = dObj
        ? dObj.toLocaleDateString("en-US", {
            year: "numeric",
            month: "numeric",
            day: "numeric",
          })
        : dateRaw || "";

      const pickUpTime = "";
      const dropOffTime = "";
      const totalMileage = "";
      const clientSignature = "";
      const uts = "";
      const pickupComments = get(row, "Comments");

      // Strip "mi"/"miles" and convert mileage to integer
      let directDistance = get(row, "Direct Distance");
      let mileageNumber = 0;

      if (directDistance) {
        const cleaned = directDistance
          .toString()
          .replace(/\s*mi(?:les?)?$/i, "")
          .trim();

        const parsed = parseInt(cleaned, 10);
        mileageNumber = Number.isNaN(parsed) ? 0 : parsed;
      }

      const passengerTypes = get(row, "Passenger Types");
      const spaceTypes = get(row, "Space Types");
      const driverManual = "";
      const outcomeManual = "";
      const hasNoteManual = "";
      const purpose = get(row, "Purpose");
      const providerCostManual = "";

      out.push([
        dateDisp,
        tripNo,
        memberFmt,
        reqTimePickup,
        reqLateDropoff,
        pickUpTime,
        origins,
        dropOffTime,
        destination,
        totalMileage,
        clientSignature,
        uts,
        pickupComments,
        mileageNumber, // integer mileage
        passengerTypes,
        spaceTypes,
        driverManual,
        outcomeManual,
        hasNoteManual,
        purpose,
        providerCostManual,
      ]);
    }

    // ---- SORT OUTPUT: BY EARLIEST TIME PER NAME, THEN WITHIN NAME BY TIME ----

    // helper: convert "HH:MM" → minutes; blanks -> NaN
    const rawToMinutes = (timeStr: string | number): number | null => {
      if (!timeStr || typeof timeStr !== "string") return null;
      const [hStr, mStr] = timeStr.split(":");
      const h = Number(hStr);
      const m = Number(mStr);
      if (Number.isNaN(h) || Number.isNaN(m)) return null;
      return h * 60 + m;
    };

    // Build earliestTimeByName from rowsOnly
    const header = out[0];
    const rowsOnly = out.slice(1);

    const earliestTimeByName = new Map<string, number>();

    for (const row of rowsOnly) {
      const name = String(row[2] ?? "");
      const t = rawToMinutes(row[3]);
      if (t == null) continue;
      const current = earliestTimeByName.get(name);
      if (current == null || t < current) {
        earliestTimeByName.set(name, t);
      }
    }

    // when no time at all for a name, we treat earliest as very large to push that group later
    const DEFAULT_LATE = 24 * 60 + 1; // 1441

    rowsOnly.sort((a, b) => {
      const nameA = String(a[2] ?? "");
      const nameB = String(b[2] ?? "");

      const groupTimeA = earliestTimeByName.get(nameA) ?? DEFAULT_LATE;
      const groupTimeB = earliestTimeByName.get(nameB) ?? DEFAULT_LATE;

      // 1) sort by earliest time across that name's rows
      if (groupTimeA !== groupTimeB) {
        return groupTimeA - groupTimeB;
      }

      // 2) if same earliest time, sort by name alphabetically (stable grouping)
      const nameCmp = nameA.localeCompare(nameB);
      if (nameCmp !== 0) return nameCmp;

      // 3) within the same name, we want:
      //    - rows WITH time first (earliest -> latest)
      //    - rows WITHOUT time afterwards
      const tA = rawToMinutes(a[3]);
      const tB = rawToMinutes(b[3]);

      const hasTimeA = tA != null;
      const hasTimeB = tB != null;

      if (hasTimeA && !hasTimeB) return -1;
      if (!hasTimeA && hasTimeB) return 1;

      if (hasTimeA && hasTimeB) {
        return (tA as number) - (tB as number);
      }

      // both have no time → keep original relative order
      return 0;
    });

    out = [header, ...rowsOnly];

    return out;
  };

  const formatAndDownloadXLSX = (matrix: MatrixOut) => {
    const ws = XLSX.utils.aoa_to_sheet(matrix);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Processed Trips");
    XLSX.writeFile(wb, "converted-trip-file.xlsx");
  };

  const handleDownloadFromHistory = (id: string | number) => {
    const matrix = processedFiles[id];
    if (!matrix) return;
    formatAndDownloadXLSX(matrix);
  };

  const processCSV = () => {
    if (!file) return;

    new Promise<ParseResult<Row>>((resolve, reject) => {
      const timeoutId = window.setTimeout(
        () => reject(new Error("Processing timed out after 20 seconds")),
        20000,
      );

      Papa.parse<Row>(file, {
        complete: (results) => {
          clearTimeout(timeoutId);
          resolve(results);
        },
        error: (error) => {
          clearTimeout(timeoutId);
          reject(error);
        },
      });
    })
      .then(({ data }) => {
        const processed = processData(data as Matrix);

        // create a new history row
        const id = history.length + 1;
        const newEntry: DataProps = {
          id,
          order: id,
          customer: {
            name: file?.name || "Imported CSV",
            image: "",
          },
          date: new Date().toLocaleDateString("en-US"),
          quantity: Math.max(processed.length - 1, 0), // minus header row
          action: null,
        };

        setHistory((prev) => [...prev, newEntry]);
        setProcessedFiles((prev) => ({
          ...prev,
          [id]: processed,
        }));
      })
      .catch(console.error);
  };

  return (
    <div className="">
      <SiteBreadcrumb />

      <div className="flex items-center gap-3 mb-6">
        <Button asChild>
          <label className="cursor-pointer">
            Choose CSV
            <input
              className="hidden"
              type="file"
              onChange={handleFileChange}
              accept=".csv"
            />
          </label>
        </Button>

        <Button onClick={processCSV} disabled={!file}>
          Process CSV
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <CSVHistory data={history} onDownload={handleDownloadFromHistory} />
        </CardContent>
      </Card>
    </div>
  );
}