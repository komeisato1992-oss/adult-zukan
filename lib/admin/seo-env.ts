import "server-only";

import { existsSync, readFileSync } from "fs";
import path from "path";

export type ServiceAccountCredentials = {
  client_email: string;
  private_key: string;
};

export type ServiceAccountJsonSource =
  | "GOOGLE_SERVICE_ACCOUNT_JSON"
  | "GOOGLE_SERVICE_ACCOUNT_JSON_BASE64"
  | "GOOGLE_SERVICE_ACCOUNT_JSON_PATH"
  | "GOOGLE_SERVICE_ACCOUNT_EMAIL+PRIVATE_KEY"
  | null;

function normalizeEnvScalar(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;

  let value = raw.trim();
  if (
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('"') && value.endsWith('"'))
  ) {
    value = value.slice(1, -1).trim();
  }

  return value || null;
}

export function readEnv(name: string): string | null {
  return normalizeEnvScalar(process.env[name]);
}

function readEnvInternal(name: string): string | null {
  return readEnv(name);
}

export function parseServiceAccountJson(
  raw: string,
): ServiceAccountCredentials | null {
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

function readServiceAccountJsonFromPath(filePath: string): string | null {
  const resolved = path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath);

  if (!existsSync(resolved)) {
    return null;
  }

  return readFileSync(resolved, "utf-8");
}

export function readServiceAccountJsonRaw(): {
  raw: string | null;
  source: ServiceAccountJsonSource;
} {
  const direct = readEnvInternal("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (direct) {
    return { raw: direct, source: "GOOGLE_SERVICE_ACCOUNT_JSON" };
  }

  const base64 = readEnvInternal("GOOGLE_SERVICE_ACCOUNT_JSON_BASE64");
  if (base64) {
    try {
      return {
        raw: Buffer.from(base64, "base64").toString("utf-8"),
        source: "GOOGLE_SERVICE_ACCOUNT_JSON_BASE64",
      };
    } catch {
      return { raw: null, source: "GOOGLE_SERVICE_ACCOUNT_JSON_BASE64" };
    }
  }

  if (process.env.NODE_ENV === "development") {
    const jsonPath = readEnvInternal("GOOGLE_SERVICE_ACCOUNT_JSON_PATH");
    if (jsonPath) {
      const fromFile = readServiceAccountJsonFromPath(jsonPath);
      if (fromFile) {
        return {
          raw: fromFile,
          source: "GOOGLE_SERVICE_ACCOUNT_JSON_PATH",
        };
      }
    }
  }

  const email = readEnvInternal("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = readEnvInternal("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
  if (email && privateKey) {
    return {
      raw: JSON.stringify({
        client_email: email,
        private_key: privateKey.replace(/\\n/g, "\n"),
      }),
      source: "GOOGLE_SERVICE_ACCOUNT_EMAIL+PRIVATE_KEY",
    };
  }

  return { raw: null, source: null };
}

/** `.env.local` / Vercel Environment Variables からサービスアカウント JSON を読み込む */
export function readServiceAccountJsonFromEnv(): string | null {
  return readServiceAccountJsonRaw().raw;
}

export function getServiceAccountJsonSource(): ServiceAccountJsonSource {
  return readServiceAccountJsonRaw().source;
}

/** `.env.local` / Vercel Environment Variables から GSC プロパティ URL を読み込む */
export function readGscSiteUrlFromEnv(): string | null {
  return readEnvInternal("GSC_SITE_URL");
}

export function getServiceAccountCredentialsFromEnv(): ServiceAccountCredentials | null {
  const { raw } = readServiceAccountJsonRaw();
  if (!raw) return null;
  return parseServiceAccountJson(raw);
}

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

export function isVercelRuntime(): boolean {
  return Boolean(process.env.VERCEL);
}
