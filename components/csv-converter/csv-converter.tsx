import * as XLSX from "xlsx";

export type Row = any[];      // you can tighten this up later
export type Matrix = any[][]; // 2D array

const parseDate = (s: string | null | undefined): Date | null => {
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

export const processData = (rows: Matrix): Matrix => {
  const H = rows[0] || [];
  const idx = (h: string) => H.indexOf(h);
  const get = (row: Row, h: string) => {
    const i = idx(h);
    return i >= 0 ? row[i] : "";
  };

  const targetHeaders = [
    "Date","Trip No.","Member's Name",
    "Requested Time Pickup","Requested Late Dropoff",
    "Pick-up Time","Origins","Drop-off Time","Destination",
    "Total Mileage","Client Signature","Member Unable to Sign UTS?","Pickup Comments",
    "Direct Distance","Passenger Types","Space Types","Driver","Outcome","Has Note","Purpose","Provider Cost"
  ];

  const out: Matrix = [targetHeaders];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row.some(Boolean)) continue;

    const tripNo = get(row, "Booking Id");
    const member = (get(row, "Client Name") || "") as string;
    let memberFmt = member;

    if (member && !member.includes(",") && member.includes(" ")) {
      const parts = member.trim().split(/\s+/);
      if (parts.length >= 2) {
        const lastName = parts[parts.length - 1].replace(/,$/, "");
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
    ].filter(Boolean).join("\n");

    const destination = [
      get(row, "Site Name(dest)"),
      get(row, "Destination"),
      // get(row, "City (Dest)"),
      get(row, "Phone Dropoff"),
    ].filter(Boolean).join("\n");

    const dateRaw = get(row, "Date") as string;
    const dObj = parseDate(dateRaw);
    const dateDisp = dObj
      ? dObj.toLocaleDateString("en-US", { year: "numeric", month: "numeric", day: "numeric" })
      : (dateRaw || "");

    const pickUpTime = "";        
    const dropOffTime = "";       
    const totalMileage = "";      
    const clientSignature = "";   
    const uts = "";               
    const pickupComments = get(row, "Comments");

    let directDistance = get(row, "Direct Distance");
    if (directDistance) {
      directDistance = directDistance
        .toString()
        .replace(/\s*mi(?:les?)?$/i, "")
        .trim();
    }

    const passengerTypes = get(row, "Passenger Types");
    const spaceTypes = get(row, "Space Types");
    const driverManual = "";
    const outcomeManual = "";
    const hasNoteManual = "";
    const purpose = get(row, "Purpose");
    const providerCostManual = "";

    out.push([
      dateDisp,             // Date
      tripNo,               // Trip No.
      memberFmt,            // Member's Name
      reqTimePickup,        // Requested Time Pickup
      reqLateDropoff,       // Requested Late Dropoff
      pickUpTime,           // Pick-up Time (manual)
      origins,              // Origins
      dropOffTime,          // Drop-off Time (manual)
      destination,          // Destination
      totalMileage,         // Total Mileage (manual)
      clientSignature,      // Client Signature (manual)
      uts,                  // Member Unable to Sign UTS? (manual)
      pickupComments,       // Pickup Comments
      directDistance,       // Direct Distance (cleaned)
      passengerTypes,       // Passenger Types
      spaceTypes,           // Space Types
      driverManual,         // Driver (manual)
      outcomeManual,        // Outcome (manual)
      hasNoteManual,        // Has Note (manual)
      purpose,              // Purpose
      providerCostManual    // Provider Cost (manual)
    ]);
  }

  return out;
};

export const formatAndDownloadXLSX = (matrix: Matrix) => {
  const ws = XLSX.utils.aoa_to_sheet(matrix);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Processed Trips");
  XLSX.writeFile(wb, "converted-trip-file.xlsx");
};