import "server-only";

import { GoogleSearchConsoleError } from "@/lib/admin/google-search-console-errors";

type ServiceAccountCredentials = {
  client_email: string;
  private_key: string;
};

export type SeoConfigStatus = {
  configured: boolean;
  hasServiceAccountJson: boolean;
  hasGscSiteUrl: boolean;
  serviceAccountEmail?: string;
  gscSiteUrl?: string;
  configMessage?: string;
};

function parseServiceAccountJson(raw: string): ServiceAccountCredentials | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccountCredentials>;
    if (!parsed.client_email || !parsed.private_key) return null;
    return {
      client_email: parsed.client_email,
      private_key: parsed.private_key.replace(/\\n/g, "\n"),
    };
  } catch {
    return null;
  }
}

/** `.env.local` / Vercel 環境変数からサービスアカウント JSON を読み込む */
export function readServiceAccountJsonFromEnv(): string | null {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  return json || null;
}

/** `.env.local` / Vercel 環境変数から GSC プロパティ URL を読み込む */
export function readGscSiteUrlFromEnv(): string | null {
  const siteUrl = process.env.GSC_SITE_URL?.trim();
  return siteUrl || null;
}

export function getServiceAccountCredentialsFromEnv(): ServiceAccountCredentials | null {
  const json = readServiceAccountJsonFromEnv();
  if (json) {
    return parseServiceAccountJson(json);
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim();
  if (!email || !privateKey) return null;

  return {
    client_email: email,
    private_key: privateKey.replace(/\\n/g, "\n"),
  };
}

export function getSeoConfigStatus(): SeoConfigStatus {
  const rawJson = readServiceAccountJsonFromEnv();
  const hasSplitCredentials = Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim(),
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
        "Google Search Console API の認証情報が未設定です。`.env.local` に GOOGLE_SERVICE_ACCOUNT_JSON と GSC_SITE_URL を設定してください。",
    };
  }

  if (!hasServiceAccountJson) {
    return {
      configured: false,
      hasServiceAccountJson: false,
      hasGscSiteUrl,
      gscSiteUrl: gscSiteUrl ?? undefined,
      configMessage:
        "GOOGLE_SERVICE_ACCOUNT_JSON が未設定です。`.env.local` にサービスアカウント JSON を1行で設定してください。",
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
        "GSC_SITE_URL が未設定です。`.env.local` に Search Console プロパティ URL（例: https://adult-zukan.jp/）を設定してください。",
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
        "GSC_SITE_URL が未設定です。`.env.local` に Search Console プロパティ URL を設定してください。",
      400,
    );
  }

  throw new GoogleSearchConsoleError(
    "missing_config",
    status.configMessage ??
      "Google Search Console API の認証情報が未設定です。`.env.local` に GOOGLE_SERVICE_ACCOUNT_JSON と GSC_SITE_URL を設定してください。",
    400,
  );
}
