import { ScanData } from "@/types/models";

/**
 * Weighbridge QR/barcode payloads are pipe-delimited with a fixed logical field layout, except
 * the full Transit Pass number (e.g. "I72601718/130") is spliced in at a variable position -
 * data[0] is the logical ("baseline") position of that splice. Every other field's logical
 * position shifts by +1 in the actual payload once the splice point is reached, so any field
 * at or before data[0] reads at its own position, and any field after it reads one position later.
 * This mirrors the real weighbridge payloads observed in production - see BASELINE below.
 */
const BASELINE = {
  TP_VALIDITY: 5,
  DO_NO_RAW: 19,
  PROCESS_TYPE: 21,
  COAL_GRADE: 24,
  GROSS: 30,
  TARE: 31,
  NET: 32,
  VEHICLE: 33,
  MINES_CODE: 36,
} as const;

function resolve(parts: string[], index0: number, baselinePos: number): string {
  const outPos = baselinePos > index0 ? baselinePos + 1 : baselinePos;
  return parts[outPos] ?? "";
}

export function parseScanData(raw: string): ScanData | null {
  if (!raw || !raw.includes("|")) return null;

  const parts = raw.split("|");
  if (parts.length <= 5) return null;

  const index0 = parseInt(parts[0], 10);
  if (Number.isNaN(index0)) return null;

  const doNoRaw = resolve(parts, index0, BASELINE.DO_NO_RAW);

  return {
    tpNo: parts[index0 + 1] ?? "",
    tpValidityDateRaw: resolve(parts, index0, BASELINE.TP_VALIDITY),
    vehicle: resolve(parts, index0, BASELINE.VEHICLE),
    grossWeight: resolve(parts, index0, BASELINE.GROSS),
    tareWeight: resolve(parts, index0, BASELINE.TARE),
    netWeight: resolve(parts, index0, BASELINE.NET),
    coalGrade: resolve(parts, index0, BASELINE.COAL_GRADE),
    processType: resolve(parts, index0, BASELINE.PROCESS_TYPE),
    minesCode: resolve(parts, index0, BASELINE.MINES_CODE),
    doNoRaw,
    doNo: doNoRaw.split("-")[0] ?? "",
  };
}
