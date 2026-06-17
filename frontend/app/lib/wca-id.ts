// Mirrors the backend's WCA_ID_PATTERN (YYYYLLLLNN, e.g. 2019CHIE01).
export const WCA_ID_PATTERN = /^\d{4}[A-Z]{4}\d{2}$/;

export function normalizeWcaId(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidWcaId(value: string): boolean {
  return WCA_ID_PATTERN.test(normalizeWcaId(value));
}
