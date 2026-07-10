import "server-only";

import {
  parseServiceAccountJson,
  readEnv,
  readGscSiteUrlFromEnv,
  readServiceAccountJsonRaw,
} from "@/lib/admin/seo-env";
import { getSeoCacheBackend } from "@/lib/admin/seo-cache-store";

export type SeoEnvDiagnostics = {
  nodeEnv: string;
  vercelEnv: string | null;
  runtime: "vercel" | "local" | "other";
  cacheBackend: "memory";
  envSources: string[];
  envPresence: Record<string, boolean>;
  googleServiceAccountJson: {
    present: boolean;
    source: string | null;
    length: number;
    parseOk: boolean;
    clientEmail?: string;
  };
  gscSiteUrl: {
    present: boolean;
    value: string | null;
  };
  splitCredentials: {
    emailPresent: boolean;
    privateKeyPresent: boolean;
  };
  logs: string[];
};

const TRACKED_ENV_VARS = [
  "GOOGLE_SERVICE_ACCOUNT_JSON",
  "GOOGLE_SERVICE_ACCOUNT_JSON_BASE64",
  "GOOGLE_SERVICE_ACCOUNT_JSON_PATH",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
  "GSC_SITE_URL",
] as const;

function detectRuntime(): SeoEnvDiagnostics["runtime"] {
  if (process.env.VERCEL) return "vercel";
  if (process.env.NODE_ENV === "development") return "local";
  return "other";
}

function detectEnvSources(): string[] {
  const sources: string[] = [];
  if (process.env.VERCEL) {
    sources.push("Vercel Environment Variables");
  }
  if (process.env.NODE_ENV === "development") {
    sources.push(".env.local");
  }
  if (sources.length === 0) {
    sources.push("process.env");
  }
  return sources;
}

function envFlag(name: string): boolean {
  return Boolean(readEnv(name));
}

export function logSeoEnvPresence(): Record<string, boolean> {
  const presence = Object.fromEntries(
    TRACKED_ENV_VARS.map((name) => [name, envFlag(name)]),
  ) as Record<string, boolean>;

  console.info("[seo-env] ===== environment variable check =====");
  console.info(`[seo-env] NODE_ENV=${process.env.NODE_ENV ?? "unknown"}`);
  console.info(`[seo-env] VERCEL=${Boolean(process.env.VERCEL)}`);
  console.info(`[seo-env] VERCEL_ENV=${process.env.VERCEL_ENV ?? "(unset)"}`);
  console.info(`[seo-env] cacheBackend=${getSeoCacheBackend()}`);

  for (const name of TRACKED_ENV_VARS) {
    console.info(`[seo-env] ${name}=${presence[name]}`);
  }

  console.info("[seo-env] ========================================");

  return presence;
}

export function buildSeoEnvDiagnostics(): SeoEnvDiagnostics {
  const envPresence = logSeoEnvPresence();
  const { raw, source } = readServiceAccountJsonRaw();
  const parsed = raw ? parseServiceAccountJson(raw) : null;
  const gscSiteUrl = readGscSiteUrlFromEnv();

  const logs = [
    `[seo-env] NODE_ENV=${process.env.NODE_ENV ?? "unknown"}`,
    `[seo-env] VERCEL=${Boolean(process.env.VERCEL)}`,
    `[seo-env] VERCEL_ENV=${process.env.VERCEL_ENV ?? "(unset)"}`,
    `[seo-env] runtime=${detectRuntime()}`,
    `[seo-env] cacheBackend=${getSeoCacheBackend()}`,
    ...TRACKED_ENV_VARS.map((name) => `[seo-env] ${name}=${envPresence[name]}`),
    `[seo-env] resolved service account source=${source ?? "none"} rawLength=${raw?.length ?? 0} parseOk=${Boolean(parsed)}`,
    `[seo-env] GSC_SITE_URL value=${gscSiteUrl ?? "(unset)"}`,
  ];

  return {
    nodeEnv: process.env.NODE_ENV ?? "unknown",
    vercelEnv: process.env.VERCEL_ENV ?? null,
    runtime: detectRuntime(),
    cacheBackend: "memory",
    envSources: detectEnvSources(),
    envPresence,
    googleServiceAccountJson: {
      present: Boolean(raw),
      source,
      length: raw?.length ?? 0,
      parseOk: Boolean(parsed),
      clientEmail: parsed?.client_email,
    },
    gscSiteUrl: {
      present: Boolean(gscSiteUrl),
      value: gscSiteUrl,
    },
    splitCredentials: {
      emailPresent: envPresence.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      privateKeyPresent: envPresence.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
    },
    logs,
  };
}

export function logSeoGscConnectionResult(options: {
  success: boolean;
  siteUrl?: string;
  error?: string;
  summary?: {
    clicks28d: number;
    impressions28d: number;
    queries: number;
    pages: number;
    sitemaps: number;
  };
}): void {
  if (options.success) {
    console.info("[seo-gsc] Google Search Console API connection: SUCCESS");
    if (options.siteUrl) {
      console.info(`[seo-gsc] siteUrl=${options.siteUrl}`);
    }
    if (options.summary) {
      console.info(
        `[seo-gsc] fetched clicks28d=${options.summary.clicks28d} impressions28d=${options.summary.impressions28d} queries=${options.summary.queries} pages=${options.summary.pages} sitemaps=${options.summary.sitemaps}`,
      );
    }
    return;
  }

  console.error(
    `[seo-gsc] Google Search Console API connection: FAILED${options.error ? ` - ${options.error}` : ""}`,
  );
}
