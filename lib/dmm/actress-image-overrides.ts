import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

export type ActressImageOverride = {
  key: string;
  imageUrl?: string;
  workId?: string | null;
  score?: number;
  faceDetected?: boolean;
  isSoloWork?: boolean;
  useDefault?: boolean;
  note?: string;
  updatedAt?: string;
};

export type ActressImageOverridesFile = {
  version: number;
  updatedAt?: string;
  overrides: ActressImageOverride[];
};

const OVERRIDES_RELATIVE = "data/dmm/actress-image-overrides.json";

let cachedOverrides: ActressImageOverridesFile | null = null;

function getOverridesPath(): string {
  return path.join(process.cwd(), OVERRIDES_RELATIVE);
}

export function clearActressImageOverrideCache(): void {
  cachedOverrides = null;
}

export function readActressImageOverrides(): ActressImageOverridesFile {
  if (cachedOverrides) return cachedOverrides;

  const filePath = getOverridesPath();
  if (!existsSync(filePath)) {
    cachedOverrides = { version: 1, overrides: [] };
    return cachedOverrides;
  }

  try {
    const raw = JSON.parse(
      readFileSync(filePath, "utf-8"),
    ) as ActressImageOverridesFile;
    cachedOverrides = {
      version: Number(raw.version) || 1,
      updatedAt: raw.updatedAt,
      overrides: Array.isArray(raw.overrides) ? raw.overrides : [],
    };
  } catch {
    cachedOverrides = { version: 1, overrides: [] };
  }

  return cachedOverrides;
}

export function getActressImageOverride(
  slugOrKey: string,
  name?: string,
): ActressImageOverride | null {
  const data = readActressImageOverrides();
  const keys = new Set(
    [slugOrKey, name].filter((value): value is string => Boolean(value)),
  );

  for (const entry of data.overrides) {
    if (keys.has(entry.key)) return entry;
  }
  return null;
}

export function upsertActressImageOverride(
  override: ActressImageOverride,
): ActressImageOverridesFile {
  if (process.env.VERCEL === "1") {
    throw new Error(
      "本番環境では代表画像オーバーライドを書き込めません。data/dmm/actress-image-overrides.json を更新してデプロイしてください。",
    );
  }

  const current = readActressImageOverrides();
  const nextOverrides = current.overrides.filter(
    (entry) => entry.key !== override.key,
  );
  nextOverrides.push({
    ...override,
    updatedAt: new Date().toISOString(),
  });

  const next: ActressImageOverridesFile = {
    version: current.version,
    updatedAt: new Date().toISOString(),
    overrides: nextOverrides,
  };

  const filePath = getOverridesPath();
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(next, null, 2)}\n`, "utf-8");
  clearActressImageOverrideCache();
  return next;
}

export function removeActressImageOverride(
  key: string,
): ActressImageOverridesFile {
  if (process.env.VERCEL === "1") {
    throw new Error(
      "本番環境では代表画像オーバーライドを書き込めません。data/dmm/actress-image-overrides.json を更新してデプロイしてください。",
    );
  }

  const current = readActressImageOverrides();
  const next: ActressImageOverridesFile = {
    version: current.version,
    updatedAt: new Date().toISOString(),
    overrides: current.overrides.filter((entry) => entry.key !== key),
  };

  writeFileSync(
    getOverridesPath(),
    `${JSON.stringify(next, null, 2)}\n`,
    "utf-8",
  );
  clearActressImageOverrideCache();
  return next;
}

export { OVERRIDES_RELATIVE as ACTRESS_IMAGE_OVERRIDES_RELATIVE };
