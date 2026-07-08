import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE,
} from "@/lib/admin/constants";

function getAdminPassword(): string | undefined {
  return process.env.ADMIN_PASSWORD?.trim() || undefined;
}

function createAdminSessionValue(): string | null {
  const password = getAdminPassword();
  if (!password) return null;

  return createHash("sha256")
    .update(`admin-session:${password}`)
    .digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export function verifyAdminPassword(password: string): boolean {
  const expected = getAdminPassword();
  if (!expected) return false;
  return safeEqual(password, expected);
}

export function verifyAdminSessionValue(value: string | undefined): boolean {
  if (!value) return false;

  const expected = createAdminSessionValue();
  if (!expected) return false;

  return safeEqual(value, expected);
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return verifyAdminSessionValue(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
}

export function getAdminSessionCookieOptions() {
  return {
    name: ADMIN_SESSION_COOKIE,
    value: createAdminSessionValue() ?? "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE,
  };
}
