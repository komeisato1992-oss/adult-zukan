import "server-only";

export type WorkLiveStatusBackend = "supabase" | "local" | "off";

export type WorkLiveStatusRow = {
  cid: string;
  price: string | null;
  list_price: string | null;
  /** 現在販売価格の整数（ソート用）。未設定環境では undefined */
  price_amount?: number | null;
  discount_rate: number | null;
  is_sale: boolean;
  sale_start_at: string | null;
  sale_end_at: string | null;
  rating: number | null;
  review_count: number | null;
  popularity_rank: number | null;
  new_arrival_rank: number | null;
  /** FANZA ItemList sort=date の順位。未適用環境では undefined */
  fanza_new_rank?: number | null;
  fanza_new_rank_updated_at?: string | null;
  is_available: boolean;
  manual_hidden: boolean;
  fanza_tv_status: string | null;
  fanza_tv_checked_at: string | null;
  fanza_tv_changed_at: string | null;
  fanza_tv_source: string | null;
  fanza_tv_error: string | null;
  checked_at: string | null;
  updated_at: string;
};

export type WorkLiveStatusUpsertInput = Omit<
  WorkLiveStatusRow,
  "updated_at"
> & {
  updated_at?: string;
};

export function getWorkLiveStatusRevalidateSec(): number {
  const n = Number(process.env.WORK_LIVE_STATUS_REVALIDATE_SEC ?? 600);
  if (!Number.isFinite(n) || n < 60) return 600;
  return Math.min(900, Math.floor(n));
}

function isTruthyEnv(raw: string | undefined): boolean | null {
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

/** WORK_LIVE_STATUS_ENABLED。未設定時は有効（明示的無効のみ false） */
export function isWorkLiveStatusEnabled(): boolean {
  const parsed = isTruthyEnv(process.env.WORK_LIVE_STATUS_ENABLED);
  if (parsed === false) return false;
  return true;
}

export function getConfiguredWorkLiveStatusBackend(): WorkLiveStatusBackend {
  if (!isWorkLiveStatusEnabled()) return "off";

  const raw = process.env.WORK_LIVE_STATUS_BACKEND?.trim().toLowerCase();
  if (raw === "off" || raw === "overlay" || raw === "json") return "off";
  if (raw === "local") return "local";
  if (raw === "supabase") return "supabase";

  // auto: Supabase 設定があれば優先、なければローカルJSON
  if (isSupabaseLiveStatusConfigured()) return "supabase";
  return "local";
}

export type WorkLiveStatusRuntimeStatus = {
  enabled: boolean;
  backend: WorkLiveStatusBackend;
  hasSupabaseUrl: boolean;
  hasServiceRoleKey: boolean;
  /** テーブル疎通。未確認時は null */
  tableAvailable: boolean | null;
};

/**
 * 軽量同期・管理画面表示で共有する変動情報ランタイム状態。
 * 秘密情報の値は含めない。
 */
export function getWorkLiveStatusRuntimeStatus(options?: {
  tableAvailable?: boolean | null;
}): WorkLiveStatusRuntimeStatus {
  const hasSupabaseUrl = Boolean(getSupabaseUrl());
  const hasServiceRoleKey = Boolean(getSupabaseServiceRoleKey());
  const backend = getConfiguredWorkLiveStatusBackend();
  const enabled =
    isWorkLiveStatusEnabled() &&
    backend !== "off" &&
    (backend !== "supabase" || (hasSupabaseUrl && hasServiceRoleKey));

  return {
    enabled,
    backend,
    hasSupabaseUrl,
    hasServiceRoleKey,
    tableAvailable:
      options?.tableAvailable === undefined ? null : options.tableAvailable,
  };
}

export function isSupabaseLiveStatusConfigured(): boolean {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim();
  return Boolean(url && key);
}

export function getSupabaseUrl(): string | null {
  return (
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    null
  );
}

export function getSupabaseServiceRoleKey(): string | null {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    null
  );
}

/** anon / publishable（クライアント用。サーバー書き込みには使わない） */
export function getSupabaseAnonKey(): string | null {
  return (
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    null
  );
}
