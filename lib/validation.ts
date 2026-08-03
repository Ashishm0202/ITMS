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
