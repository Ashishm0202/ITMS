export function isValidMobileNo(value: string): boolean {
  return /^\d{10}$/.test(value.trim());
}

export function isValidAadharNo(value: string): boolean {
  return /^\d{12}$/.test(value.trim());
}

export function mobileNoError(value: string): string | undefined {
  return value && !isValidMobileNo(value) ? "Mobile number must be 10 digits" : undefined;
}

export function aadharNoError(value: string): string | undefined {
  return value && !isValidAadharNo(value) ? "Aadhar number must be 12 digits" : undefined;
}

/** True for a numeric string greater than zero - used for weights and quantities. */
export function isPositiveNumber(value: string): boolean {
  const parsed = Number(value.trim());
  return value.trim() !== "" && Number.isFinite(parsed) && parsed > 0;
}

export function isFutureDate(date: Date | null): boolean {
  if (!date) return false;
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return date.getTime() > today.getTime();
}

export function isExpired(date: Date | null): boolean {
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const check = new Date(date);
  check.setHours(0, 0, 0, 0);
  return check.getTime() < today.getTime();
}

export function expiryError(date: Date | null, label: string): string | undefined {
  return isExpired(date) ? `${label} has expired` : undefined;
}
