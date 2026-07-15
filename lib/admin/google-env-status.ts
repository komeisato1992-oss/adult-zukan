import "server-only";

import {
  detectRuntimeEnvironment,
  getServiceAccountCredentialsFromEnv,
  getServiceAccountJsonSource,
  readEnv,
  readGscSiteUrlFromEnv,
} from "@/lib/admin/seo-env";
import type {
  EnvPresenceLabel,
  GoogleEnvPresence,
} from "@/lib/admin/google-env-presence-types";

export type { EnvPresenceLabel, GoogleEnvPresence };

function presence(name: string): EnvPresenceLabel {
  return readEnv(name) ? "存在する" : "存在しない";
}

/**
 * 値は返さず、キーの有無だけ。
 * GOOGLE_SERVICE_ACCOUNT_JSON / GA4_PROPERTY_ID / GSC_SITE_URL は名前どおりのキーのみ判定
 * （BASE64 等のフォールバックは「存在する」にしない）。
 */
export function getGoogleEnvPresence(): GoogleEnvPresence {
  return {
    GOOGLE_SERVICE_ACCOUNT_JSON: presence("GOOGLE_SERVICE_ACCOUNT_JSON"),
    GA4_PROPERTY_ID: presence("GA4_PROPERTY_ID"),
    GSC_SITE_URL: presence("GSC_SITE_URL"),
  };
}

export function getGa4PropertyIdFromEnv(): string | null {
  return (
    readEnv("GA4_PROPERTY_ID") ||
    readEnv("GOOGLE_ANALYTICS_PROPERTY_ID") ||
    null
  );
}

export function buildSearchConsoleStatusPayload() {
  const env = getGoogleEnvPresence();
  const credentials = getServiceAccountCredentialsFromEnv();
  const gscSiteUrl = readGscSiteUrlFromEnv();
  const credentialSource = getServiceAccountJsonSource();

  return {
    success: true as const,
    service: "search-console" as const,
    runtimeEnvironment: detectRuntimeEnvironment(),
    /** 管理画面表示用（値は含めない） */
    env,
    /** この API / Search Console 連携が実際に読むキー */
    reads: [
      "GOOGLE_SERVICE_ACCOUNT_JSON",
      "GOOGLE_SERVICE_ACCOUNT_JSON_BASE64",
      "GOOGLE_SERVICE_ACCOUNT_JSON_PATH",
      "GOOGLE_SERVICE_ACCOUNT_EMAIL",
      "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
      "GOOGLE_CLOUD_PROJECT",
      "GSC_SITE_URL",
    ] as const,
    hasCredentials: Boolean(credentials),
    credentialSource,
    hasGscSiteUrl: Boolean(gscSiteUrl),
    configured: Boolean(credentials && gscSiteUrl),
  };
}

export function buildGa4StatusPayload() {
  const env = getGoogleEnvPresence();
  const credentials = getServiceAccountCredentialsFromEnv();
  const propertyIdRaw = getGa4PropertyIdFromEnv();
  const propertyId = propertyIdRaw
    ? propertyIdRaw.replace(/^properties\//i, "").trim() || null
    : null;
  const credentialSource = getServiceAccountJsonSource();

  return {
    success: true as const,
    service: "ga4" as const,
    runtimeEnvironment: detectRuntimeEnvironment(),
    env,
    /** この API / GA4 Data API 連携が実際に読むキー */
    reads: [
      "GOOGLE_SERVICE_ACCOUNT_JSON",
      "GOOGLE_SERVICE_ACCOUNT_JSON_BASE64",
      "GOOGLE_SERVICE_ACCOUNT_JSON_PATH",
      "GOOGLE_SERVICE_ACCOUNT_EMAIL",
      "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
      "GOOGLE_CLOUD_PROJECT",
      "GA4_PROPERTY_ID",
      "GOOGLE_ANALYTICS_PROPERTY_ID",
    ] as const,
    hasCredentials: Boolean(credentials),
    credentialSource,
    hasPropertyId: Boolean(propertyId),
    /** 値そのものではなく、プロパティIDが解決できたかだけ */
    propertyIdResolved: Boolean(propertyId),
    configured: Boolean(credentials && propertyId),
  };
}
