/** Reads a property off an object matching the given name case-insensitively, returning "" if absent. */
export function getFieldCI(obj: Record<string, unknown> | null | undefined, name: string): string {
  if (!obj) return "";
  const key = Object.keys(obj).find((k) => k.toLowerCase() === name.toLowerCase());
  if (!key) return "";
  const value = obj[key];
  return value === null || value === undefined ? "" : String(value);
}
