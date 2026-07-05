export const AGE_GATE_STORAGE_KEY = "adult_zukan_age_verified";
export const AGE_GATE_COOKIE_NAME = "adult_zukan_age_verified";
export const AGE_GATE_MAX_AGE_DAYS = 30;
export const AGE_GATE_MAX_AGE_SECONDS = AGE_GATE_MAX_AGE_DAYS * 24 * 60 * 60;

export type AgeGateRecord = {
  verified: boolean;
  expires: number;
};

export function isAgeGateRecord(value: unknown): value is AgeGateRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as AgeGateRecord;
  return (
    record.verified === true &&
    typeof record.expires === "number" &&
    record.expires > Date.now()
  );
}
