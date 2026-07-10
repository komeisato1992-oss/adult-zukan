import "server-only";

import { GoogleSearchConsoleError } from "@/lib/admin/google-search-console-errors";
import {
  getServiceAccountCredentialsFromEnv,
  parseServiceAccountJson,
  readGscSiteUrlFromEnv,
  readServiceAccountJsonRaw,
} from "@/lib/admin/seo-env";
import { buildSeoEnvDiagnostics } from "@/lib/admin/seo-env-diagnostics";

export type SeoConfigStatus = {
  configured: boolean;
  hasServiceAccountJson: boolean;
  hasGscSiteUrl: boolean;
  serviceAccountEmail?: string;
  gscSiteUrl?: string;
  configMessage?: string;
};

export function getSeoConfigStatus(): SeoConfigStatus {
  buildSeoEnvDiagnostics();

  const { raw: rawJson } = readServiceAccountJsonRaw();
  const hasSplitCredentials = Boolean(
    readServiceAccountJsonRaw().source ===
      "GOOGLE_SERVICE_ACCOUNT_EMAIL+PRIVATE_KEY",
  );
  const hasServiceAccountJson = Boolean(rawJson || hasSplitCredentials);
  const gscSiteUrl = readGscSiteUrlFromEnv();
  const hasGscSiteUrl = Boolean(gscSiteUrl);

  if (!hasServiceAccountJson && !hasGscSiteUrl) {
    return {
      configured: false,
      hasServiceAccountJson: false,
      hasGscSiteUrl: false,
      configMessage:
        "Google Search Console API の認証情報が未設定です。`.env.local` または Vercel Environment Variables に GOOGLE_SERVICE_ACCOUNT_JSON と GSC_SITE_URL を設定してください。",
    };
  }

  if (!hasServiceAccountJson) {
    return {
      configured: false,
      hasServiceAccountJson: false,
      hasGscSiteUrl,
      gscSiteUrl: gscSiteUrl ?? undefined,
      configMessage:
        "GOOGLE_SERVICE_ACCOUNT_JSON が未設定です。JSON 本体、BASE64、または EMAIL+PRIVATE_KEY のいずれかを設定してください。",
    };
  }

  if (rawJson && !parseServiceAccountJson(rawJson)) {
    return {
      configured: false,
      hasServiceAccountJson: true,
      hasGscSiteUrl,
      gscSiteUrl: gscSiteUrl ?? undefined,
      configMessage:
        "GOOGLE_SERVICE_ACCOUNT_JSON の形式が不正です。client_email と private_key を含む有効な JSON か確認してください。",
    };
  }

  const credentials = getServiceAccountCredentialsFromEnv();
  if (!credentials) {
    return {
      configured: false,
      hasServiceAccountJson: true,
      hasGscSiteUrl,
      gscSiteUrl: gscSiteUrl ?? undefined,
      configMessage:
        "GOOGLE_SERVICE_ACCOUNT_JSON の形式が不正です。client_email と private_key を含む有効な JSON か確認してください。",
    };
  }

  if (!hasGscSiteUrl) {
    return {
      configured: false,
      hasServiceAccountJson: true,
      hasGscSiteUrl: false,
      serviceAccountEmail: credentials.client_email,
      configMessage:
        "GSC_SITE_URL が未設定です。`.env.local` または Vercel Environment Variables に Search Console プロパティ URL（例: https://adult-zukan.jp/）を設定してください。",
    };
  }

  return {
    configured: true,
    hasServiceAccountJson: true,
    hasGscSiteUrl: true,
    serviceAccountEmail: credentials.client_email,
    gscSiteUrl: gscSiteUrl ?? undefined,
  };
}

export function isGoogleSearchConsoleConfigured(): boolean {
  return getSeoConfigStatus().configured;
}

export function assertGoogleSearchConsoleConfigured(): SeoConfigStatus {
  const status = getSeoConfigStatus();
  if (status.configured) return status;

  if (status.configMessage?.includes("JSON")) {
    throw new GoogleSearchConsoleError(
      "invalid_json",
      status.configMessage,
      400,
    );
  }

  if (!status.hasGscSiteUrl) {
    throw new GoogleSearchConsoleError(
      "missing_gsc_site_url",
      status.configMessage ??
        "GSC_SITE_URL が未設定です。`.env.local` または Vercel Environment Variables に Search Console プロパティ URL を設定してください。",
      400,
    );
  }

  throw new GoogleSearchConsoleError(
    "missing_config",
    status.configMessage ??
      "Google Search Console API の認証情報が未設定です。`.env.local` または Vercel Environment Variables に GOOGLE_SERVICE_ACCOUNT_JSON と GSC_SITE_URL を設定してください。",
    400,
  );
}

export { readGscSiteUrlFromEnv, readServiceAccountJsonFromEnv } from "@/lib/admin/seo-env";
