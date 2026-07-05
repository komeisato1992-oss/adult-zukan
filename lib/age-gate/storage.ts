"use client";

import {
  AGE_GATE_COOKIE_NAME,
  AGE_GATE_MAX_AGE_SECONDS,
  AGE_GATE_STORAGE_KEY,
  type AgeGateRecord,
  isAgeGateRecord,
} from "@/lib/age-gate/constants";

function readCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split("; ")
    .some((row) => row.startsWith(`${AGE_GATE_COOKIE_NAME}=1`));
}

function readLocalStorage(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const raw = localStorage.getItem(AGE_GATE_STORAGE_KEY);
    if (!raw) return false;
    const parsed: unknown = JSON.parse(raw);
    return isAgeGateRecord(parsed);
  } catch {
    return false;
  }
}

export function isAgeVerified(): boolean {
  return readCookie() || readLocalStorage();
}

export function saveAgeVerification(): void {
  const expires = Date.now() + AGE_GATE_MAX_AGE_SECONDS * 1000;
  const record: AgeGateRecord = { verified: true, expires };

  localStorage.setItem(AGE_GATE_STORAGE_KEY, JSON.stringify(record));
  document.cookie = `${AGE_GATE_COOKIE_NAME}=1; path=/; max-age=${AGE_GATE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

export function clearAgeVerification(): void {
  localStorage.removeItem(AGE_GATE_STORAGE_KEY);
  document.cookie = `${AGE_GATE_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
}
