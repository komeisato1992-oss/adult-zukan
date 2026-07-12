import "server-only";

import {
  assertGoogleSearchConsoleConfigured,
  getSeoConfigStatus,
  isGoogleSearchConsoleConfigured,
} from "@/lib/admin/seo-config";
import { getServiceAccountCredentialsFromEnv } from "@/lib/admin/seo-env";
import {
  getGoogleAccessTokenForScopes,
  GOOGLE_SCOPE_WEBMASTERS,
} from "@/lib/admin/google-access-token";

export { getSeoConfigStatus, isGoogleSearchConsoleConfigured };

export function getServiceAccountEmail(): string | null {
  const credentials = getServiceAccountCredentialsFromEnv();
  return credentials?.client_email ?? null;
}

export async function getGoogleAccessToken(): Promise<string> {
  assertGoogleSearchConsoleConfigured();
  return getGoogleAccessTokenForScopes([GOOGLE_SCOPE_WEBMASTERS]);
}
