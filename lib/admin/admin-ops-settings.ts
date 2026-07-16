import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { getWorkLiveStatusRuntimeStatus } from "@/lib/dmm/work-live-status/types";

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

function parseBoolEnv(name: string): boolean | null {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return null;
  const value = raw.trim().toLowerCase();
  if (value === "1" || value === "true" || value === "yes" || value === "on") {
    return true;
  }
  if (value === "0" || value === "false" || value === "no" || value === "off") {
    return false;
  }
  return null;
}

function isWorkLiveStatusReadyForLightSync(): boolean {
  return getWorkLiveStatusRuntimeStatus().enabled;
}

/**
 * 軽量同期の実行可否（共通）。
 * 1. 管理画面トグル
 * 2. ADULT_LIGHT_SYNC_ENABLED
 * 3. WORK_LIVE_STATUS + Supabase/local が利用可能
 */
export function resolveLightSyncEnabled(): boolean {
  const settings = readAdminOpsSettings();
  if (settings.lightSyncEnabled != null) return settings.lightSyncEnabled;

  const env = parseBoolEnv("ADULT_LIGHT_SYNC_ENABLED");
  if (env != null) return env;

  return isWorkLiveStatusReadyForLightSync();
}

export function resolveFullSyncEnabled(): boolean {
  const settings = readAdminOpsSettings();
  if (settings.fullSyncEnabled != null) return settings.fullSyncEnabled;
  const env = parseBoolEnv("ADULT_FULL_SYNC_ENABLED");
  return env === true;
}

export type SyncEnvPresence = "true" | "false" | "unset";

function readEnvPresence(name: string): SyncEnvPresence {
  const parsed = parseBoolEnv(name);
  if (parsed === true) return "true";
  if (parsed === false) return "false";
  return "unset";
}

/**
 * 管理画面表示用。
 * - enabled: 実行可能か（トグル優先、なければ env / work_live_status）
 * - statusLabel: 有効 / 無効 / 未設定
 * - envPresence: 環境変数の実値（API と画面で共通参照）
 */
export function getAdminOpsSettingsView(): {
  settings: AdminOpsSettings;
  lightSyncEnabled: boolean;
  fullSyncEnabled: boolean;
  lightSyncSource: "toggle" | "env" | "work_live_status";
  fullSyncSource: "toggle" | "env";
  lightSyncEnv: SyncEnvPresence;
  fullSyncEnv: SyncEnvPresence;
  lightSyncStatus: "enabled" | "disabled" | "unset";
  fullSyncStatus: "enabled" | "disabled" | "unset";
  workLiveStatus: {
    enabled: boolean;
    backend: string;
    hasSupabaseUrl: boolean;
    hasServiceRoleKey: boolean;
    tableAvailable: boolean | null;
  };
} {
  const settings = readAdminOpsSettings();
  const lightSyncEnv = readEnvPresence("ADULT_LIGHT_SYNC_ENABLED");
  const fullSyncEnv = readEnvPresence("ADULT_FULL_SYNC_ENABLED");
  const lightSyncEnabled = resolveLightSyncEnabled();
  const fullSyncEnabled = resolveFullSyncEnabled();
  const workLiveStatus = getWorkLiveStatusRuntimeStatus();
  const workLiveReady = workLiveStatus.enabled;

  const lightSyncSource: "toggle" | "env" | "work_live_status" =
    settings.lightSyncEnabled != null
      ? "toggle"
      : lightSyncEnv !== "unset"
        ? "env"
        : "work_live_status";

  const lightSyncStatus: "enabled" | "disabled" | "unset" =
    settings.lightSyncEnabled != null
      ? settings.lightSyncEnabled
        ? "enabled"
        : "disabled"
      : lightSyncEnabled
        ? "enabled"
        : lightSyncEnv === "unset" && !workLiveReady
          ? "unset"
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
    lightSyncSource,
    fullSyncSource: settings.fullSyncEnabled != null ? "toggle" : "env",
    lightSyncEnv,
    fullSyncEnv,
    lightSyncStatus,
    fullSyncStatus,
    workLiveStatus,
  };
}
