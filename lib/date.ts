const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatDdMmYyyy(d: Date): string {
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

export function formatHhMmSs(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function formatYyyyMmDd(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

/** Formats a date for the API, or the "not set" placeholder "00000000" the backend itself uses. */
export function formatDateForApi(d: Date | null): string {
  return d ? formatYyyyMmDd(d) : "00000000";
}

/** Parses the "M/d/yyyy h:mm:ss tt" weighbridge timestamp format used in TP QR payloads. */
export function parseUsDateTime(input: string): Date | null {
  const match = input
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  const [, mm, dd, yyyy, hh, min, ss, ampm] = match;
  let hour = Number(hh) % 12;
  if (ampm.toUpperCase() === "PM") hour += 12;
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd), hour, Number(min), Number(ss));
}

/** Parses the "dd-MM-yyyy HH:mm:ss" 24-hour timestamp format seen in some weighbridge QR payloads. */
export function parseDdMmYyyyDateTime(input: string): Date | null {
  const match = input.trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, dd, mm, yyyy, hh, min, ss] = match;
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min), Number(ss));
}

/** Parses a weighbridge QR date/time, trying both formats seen in practice. */
export function parseScanDateTime(input: string): Date | null {
  return parseUsDateTime(input) ?? parseDdMmYyyyDateTime(input);
}

/** Parses a "yyyyMMdd" master-data date (falling back to a generic parse) into a Date. */
export function parseMasterDate(dateStr?: string | null): Date | null {
  if (!dateStr || dateStr === "00000000") return null;
  const strict = dateStr.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (strict) {
    const [, yyyy, mm, dd] = strict;
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  }
  const generic = new Date(dateStr);
  return Number.isNaN(generic.getTime()) ? null : generic;
}

/** Renders a "yyyyMMdd" master-data date (falling back to a generic parse) as "dd MMM yyyy". */
export function formatMasterDate(dateStr?: string | null): string {
  if (!dateStr || dateStr === "00000000") return "";
  const strict = dateStr.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (strict) {
    const [, yyyy, mm, dd] = strict;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return `${pad(d.getDate())} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  }
  const generic = new Date(dateStr);
  if (!Number.isNaN(generic.getTime())) {
    return `${pad(generic.getDate())} ${MONTH_NAMES[generic.getMonth()]} ${generic.getFullYear()}`;
  }
  return dateStr;
}
