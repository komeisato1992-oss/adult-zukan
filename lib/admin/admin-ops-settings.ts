import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

export const ADMIN_OPS_SETTINGS_PATH = "data/dmm/admin-ops-settings.json";

export type AdminOpsSettings = {
  /** 管理画面トグル。未設定時は環境変数にフォールバック */
  lightSyncEnabled: boolean | null;
  fullSyncEnabled: boolean | null;
  updatedAt: string | null;
};

const DEFAULT_SETTINGS: AdminOpsSettings = {
  lightSyncEnabled: null,
  fullSyncEnabled: null,
  updatedAt: null,
};

function absolutePath(): string {
  return path.join(process.cwd(), ADMIN_OPS_SETTINGS_PATH);
}

export function readAdminOpsSettings(): AdminOpsSettings {
  const filePath = absolutePath();
  if (!existsSync(filePath)) return { ...DEFAULT_SETTINGS };
  try {
    const raw = JSON.parse(readFileSync(filePath, "utf8")) as Partial<AdminOpsSettings>;
    return {
      lightSyncEnabled:
        typeof raw.lightSyncEnabled === "boolean" ? raw.lightSyncEnabled : null,
      fullSyncEnabled:
        typeof raw.fullSyncEnabled === "boolean" ? raw.fullSyncEnabled : null,
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function writeAdminOpsSettings(
  patch: Partial<Pick<AdminOpsSettings, "lightSyncEnabled" | "fullSyncEnabled">>,
): AdminOpsSettings {
  const next: AdminOpsSettings = {
    ...readAdminOpsSettings(),
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  const filePath = absolutePath();
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

/** 実行可否: 管理画面トグル優先、なければ環境変数 */
export function resolveLightSyncEnabled(): boolean {
  const settings = readAdminOpsSettings();
  if (settings.lightSyncEnabled != null) return settings.lightSyncEnabled;
  return process.env.ADULT_LIGHT_SYNC_ENABLED === "true";
}

export function resolveFullSyncEnabled(): boolean {
  const settings = readAdminOpsSettings();
  if (settings.fullSyncEnabled != null) return settings.fullSyncEnabled;
  return process.env.ADULT_FULL_SYNC_ENABLED === "true";
}

export type SyncEnvPresence = "true" | "false" | "unset";

function readEnvPresence(name: string): SyncEnvPresence {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return "unset";
  return raw === "true" ? "true" : "false";
}

/**
 * 管理画面表示用。
 * - enabled: 実行可能か（トグル優先、なければ env）
 * - statusLabel: 有効 / 無効 / 未設定
 * - envPresence: 環境変数の実値（API と画面で共通参照）
 */
export function getAdminOpsSettingsView(): {
  settings: AdminOpsSettings;
  lightSyncEnabled: boolean;
  fullSyncEnabled: boolean;
  lightSyncSource: "toggle" | "env";
  fullSyncSource: "toggle" | "env";
  lightSyncEnv: SyncEnvPresence;
  fullSyncEnv: SyncEnvPresence;
  lightSyncStatus: "enabled" | "disabled" | "unset";
  fullSyncStatus: "enabled" | "disabled" | "unset";
} {
  const settings = readAdminOpsSettings();
  const lightSyncEnv = readEnvPresence("ADULT_LIGHT_SYNC_ENABLED");
  const fullSyncEnv = readEnvPresence("ADULT_FULL_SYNC_ENABLED");
  const lightSyncEnabled = resolveLightSyncEnabled();
  const fullSyncEnabled = resolveFullSyncEnabled();

  const lightSyncStatus: "enabled" | "disabled" | "unset" =
    settings.lightSyncEnabled != null
      ? settings.lightSyncEnabled
        ? "enabled"
        : "disabled"
      : lightSyncEnv === "unset"
        ? "unset"
        : lightSyncEnabled
          ? "enabled"
          : "disabled";

  const fullSyncStatus: "enabled" | "disabled" | "unset" =
    settings.fullSyncEnabled != null
      ? settings.fullSyncEnabled
        ? "enabled"
        : "disabled"
      : fullSyncEnv === "unset"
        ? "unset"
        : fullSyncEnabled
          ? "enabled"
          : "disabled";

  return {
    settings,
    lightSyncEnabled,
    fullSyncEnabled,
    lightSyncSource: settings.lightSyncEnabled != null ? "toggle" : "env",
    fullSyncSource: settings.fullSyncEnabled != null ? "toggle" : "env",
    lightSyncEnv,
    fullSyncEnv,
    lightSyncStatus,
    fullSyncStatus,
  };
}
