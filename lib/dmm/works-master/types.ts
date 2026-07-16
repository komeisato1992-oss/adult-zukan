import "server-only";

import {
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
  isSupabaseLiveStatusConfigured,
} from "@/lib/dmm/work-live-status/types";

export type WorksMasterBackend = "supabase" | "local" | "off";

export type WorkMasterNamedEntity = {
  id?: number;
  name: string;
  ruby?: string;
};

export type WorkMasterImageStatus = "ok" | "now_printing" | "fetch_failed";

export type WorkMasterRow = {
  cid: string;
  slug: string;
  title: string;
  description: string | null;
  package_image: string | null;
  /** 追加・掲載情報更新時のみ設定。閲覧時はこの値を使う */
  image_status: WorkMasterImageStatus | null;
  image_status_checked_at: string | null;
  sample_images: string[];
  actresses: WorkMasterNamedEntity[];
  maker: string | null;
  label: string | null;
  series: string | null;
  genres: WorkMasterNamedEntity[];
  release_date: string | null;
  duration: string | null;
  product_code: string | null;
  affiliate_url: string | null;
  published: boolean;
  manual_hidden: boolean;
  manual_hidden_reason: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkMasterUpsertInput = Omit<
  WorkMasterRow,
  "created_at" | "updated_at"
> & {
  created_at?: string;
  updated_at?: string;
};

export function isWorksMasterEnabled(): boolean {
  const raw = process.env.WORKS_MASTER_ENABLED?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off" || raw === "no") {
    return false;
  }
  // 未設定時は有効（第4段階デフォルト）
  return true;
}

export function getConfiguredWorksMasterBackend(): WorksMasterBackend {
  if (!isWorksMasterEnabled()) return "off";
  const raw = process.env.WORKS_MASTER_BACKEND?.trim().toLowerCase();
  if (raw === "off" || raw === "json" || raw === "git") return "off";
  if (raw === "local") return "local";
  if (raw === "supabase") return "supabase";

  // auto: Supabase 接続設定があるときは必ず supabase（ローカルは障害時のみ）
  if (isSupabaseLiveStatusConfigured() || (getSupabaseUrl() && getSupabaseServiceRoleKey())) {
    return "supabase";
  }
  return "local";
}

/** Supabase へ接続可能な設定があるか（auto 判定用） */
export function isWorksMasterSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseServiceRoleKey());
}

export function getWorksMasterRevalidateSec(): number {
  const n = Number(process.env.WORKS_MASTER_REVALIDATE_SEC ?? 600);
  if (!Number.isFinite(n) || n < 60) return 600;
  return Math.min(900, Math.floor(n));
}
