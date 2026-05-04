export function timeToMin(value?: string | number | null): number | null {
  if (value == null) return null;

  const s = String(value).trim();
  if (!s) return null;

  const match = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const h = Number(match[1]);
  const m = Number(match[2]);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;

  return h * 60 + m;
}

export function minToTime(min: number): string {
  const safe = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function trafficMultiplier(minOfDay: number): number {
  if (minOfDay >= 360 && minOfDay <= 540) return 1.18;
  if (minOfDay >= 900 && minOfDay <= 1080) return 1.16;
  return 1.04;
}