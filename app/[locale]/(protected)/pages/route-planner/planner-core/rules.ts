import type { DurationRule } from "./types";

export function stripPhoneNumber(value?: string): string {
  const text = value || "";

  return text
    .replace(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function formatSingleStreetLine(line: string): string {
  const cleaned = line.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";

  const parts = cleaned.split(" ");
  if (parts.length < 4) return cleaned;

  const zipMatch = cleaned.match(/\b\d{5}(?:-\d{4})?$/);
  const zip = zipMatch?.[0] ?? "";

  let withoutZip = zip ? cleaned.slice(0, cleaned.length - zip.length).trim() : cleaned;
  const tokens = withoutZip.split(" ");
  if (tokens.length < 3) return cleaned;

  const state = tokens[tokens.length - 1];
  const city = tokens[tokens.length - 2];
  const street = tokens.slice(0, -2).join(" ");

  return [street, city, `${state}${zip ? ` ${zip}` : ""}`]
    .filter(Boolean)
    .join(", ");
}

export function formatAddressWithCommas(value?: string): string {
  if (!value) return "";

  const noPhone = stripPhoneNumber(value)
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .trim();

  const lines = noPhone
    .split("\n")
    .map((x) => x.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (lines.length === 0) return "";

  // Most of your source cells are:
  // line 1 = label/facility name
  // line 2 = street + city + state + zip
  if (lines.length >= 2) {
    const label = lines[0];
    const streetLine = formatSingleStreetLine(lines[1]);
    return [label, streetLine].filter(Boolean).join(", ");
  }

  // Single-line fallback:
  // Try to separate the trailing city/state/zip from the front portion
  const single = lines[0];
  const zipMatch = single.match(/\b\d{5}(?:-\d{4})?$/);
  const zip = zipMatch?.[0] ?? "";

  let withoutZip = zip ? single.slice(0, single.length - zip.length).trim() : single;
  const tokens = withoutZip.split(" ");

  if (tokens.length >= 4) {
    const state = tokens[tokens.length - 1];
    const city = tokens[tokens.length - 2];
    const front = tokens.slice(0, -2).join(" ");
    return [front, city, `${state}${zip ? ` ${zip}` : ""}`]
      .filter(Boolean)
      .join(", ");
  }

  return single;
}

export function normalizeAddress(value?: string): string {
  return formatAddressWithCommas(value)
    .replace(/\s*,\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function addressForExport(value?: string): string {
  if (!value) return "";

  const cleaned = value
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .trim();

  const phoneMatch = cleaned.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  const phone = phoneMatch?.[0] ?? "";

  const display = formatAddressWithCommas(cleaned);

  return phone ? `${display}, ${phone}` : display;
}

export function facilityKey(address: string): string {
  return normalizeAddress(address).toUpperCase();
}

export function parseMiles(value?: string | number | null): number {
  if (value == null) return 0;
  const cleaned = String(value).replace(/[^\d.]/g, "");
  const n = Number(cleaned);
  return Number.isNaN(n) ? 0 : n;
}

export function detectSeats(
  passengerTypes: string,
  comments: string,
  pickupComments: string,
): number {
  let seats = 0;

  const tokens = (passengerTypes || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  for (const token of tokens) {
    const match = token.match(/^(ADULT|CHILD|CHLDRN|ESC)(\d+)$/i);
    if (!match) continue;
    const count = Number(match[2]);
    if (!Number.isNaN(count)) seats += count;
  }

  const text = `${comments} ${pickupComments}`.toLowerCase();
  const escortRegex =
    /\b(escort|esc\b|boyfriend|girlfriend|mother|mom|father|dad|wife|husband|daughter|son)\b/i;

  const hasStructuredEscort = tokens.some((t) => /^ESC\d+$/i.test(t));
  if (!hasStructuredEscort && escortRegex.test(text)) {
    seats += 1;
  }

  return Math.max(seats, 1);
}

export function canShareVehicle(existingSeats: number, candidateSeats: number): boolean {
  if (existingSeats > 3 || candidateSeats > 3) return false;
  return existingSeats + candidateSeats <= 3;
}

export function sameish(a: string, b: string): boolean {
  return facilityKey(a) === facilityKey(b);
}

export function isLikelyReturn(
  purpose: string,
  destination: string,
  pickupTime?: string,
): boolean {
  const p = (purpose || "").toUpperCase();
  if (p === "RSDNC" || p === "DLYSRES") return true;
  if (pickupTime && p.includes("RES")) return true;

  const d = destination.toUpperCase();
  return /\bHOME\b/.test(d);
}

export function estimateAppointmentDuration(
  address: string,
  rules: DurationRule[],
): number {
  const upper = facilityKey(address);
  const match = rules.find((r) =>
    upper.includes(r.contains.toUpperCase()),
  );
  return match?.appointmentDuration ?? 60;
}