import "server-only";

import { createSign } from "crypto";
import {
  assertGoogleSearchConsoleConfigured,
} from "@/lib/admin/seo-config";
import { getServiceAccountCredentialsFromEnv } from "@/lib/admin/seo-env";
import {
  classifyGoogleAuthError,
  GoogleSearchConsoleError,
} from "@/lib/admin/google-search-console-errors";

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

function base64Url(value: string | Buffer): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export { getSeoConfigStatus, isGoogleSearchConsoleConfigured } from "@/lib/admin/seo-config";

function createSignedJwt(clientEmail: string, privateKey: string): string {
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64Url(
    JSON.stringify({
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/webmasters.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(privateKey, "base64url");
  return `${unsigned}.${signature}`;
}

export async function getGoogleAccessToken(): Promise<string> {
  assertGoogleSearchConsoleConfigured();

  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.token;
  }

  const credentials = getServiceAccountCredentialsFromEnv();
  if (!credentials) {
    throw new GoogleSearchConsoleError(
      "invalid_json",
      "GOOGLE_SERVICE_ACCOUNT_JSON の形式が不正です。client_email と private_key を含む有効な JSON か確認してください。",
      400,
    );
  }

  let assertion: string;
  try {
    assertion = createSignedJwt(
      credentials.client_email,
      credentials.private_key,
    );
  } catch {
    throw new GoogleSearchConsoleError(
      "invalid_json",
      "GOOGLE_SERVICE_ACCOUNT_JSON の private_key が不正です。改行を \\n にエスケープして設定してください。",
      400,
    );
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw classifyGoogleAuthError(text);
  }

  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!data.access_token) {
    throw new GoogleSearchConsoleError(
      "auth_failed",
      "Google 認証トークンを取得できませんでした。",
      401,
    );
  }

  cachedAccessToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };

  return data.access_token;
}
