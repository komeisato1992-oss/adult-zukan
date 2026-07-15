import "server-only";

export type WorkLiveStatusBackend = "supabase" | "local" | "off";

export type WorkLiveStatusRow = {
  cid: string;
  price: string | null;
  list_price: string | null;
  discount_rate: number | null;
  is_sale: boolean;
  sale_end_at: string | null;
  rating: number | null;
  review_count: number | null;
  popularity_rank: number | null;
  new_arrival_rank: number | null;
  is_available: boolean;
  fanza_tv_status: string | null;
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

export function isWorkLiveStatusEnabled(): boolean {
  const raw = process.env.WORK_LIVE_STATUS_ENABLED?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off" || raw === "no") {
    return false;
  }
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
