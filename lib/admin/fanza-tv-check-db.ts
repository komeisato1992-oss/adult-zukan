import "server-only";

import { normalizeCatalogContentId } from "@/lib/dmm/catalog-snapshot";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type {
  FanzaTvCheckStats,
  FanzaTvCheckStatus,
} from "@/lib/admin/fanza-tv-check-types";

const PAGE = 1000;

export type FanzaTvCheckResultRow = {
  cid: string;
  status: Exclude<FanzaTvCheckStatus, "unknown"> | "unknown";
  url: string;
  checkedAt: string;
};

const SCHEMA_HINT =
  "works に fanza_tv_* 列がありません。Supabase SQL Editor で supabase/migrations/20260716_004_works_fanza_tv.sql を適用してください";

export async function detectWorksFanzaTvSchema(): Promise<boolean> {
  const client = getSupabaseServiceClient();
  if (!client) return false;
  const { error } = await client
    .from("works")
    .select("fanza_tv_status,fanza_tv_checked_at,fanza_tv_url")
    .limit(1);
  return !error;
}

export async function assertWorksFanzaTvSchema(): Promise<void> {
  const ready = await detectWorksFanzaTvSchema();
  if (!ready) throw new Error(SCHEMA_HINT);
}

export async function getFanzaTvCheckStats(): Promise<FanzaTvCheckStats> {
  const client = getSupabaseServiceClient();
  const empty: FanzaTvCheckStats = {
    totalCount: 0,
    availableCount: 0,
    unavailableCount: 0,
    uncheckedCount: 0,
    lastCheckedAt: null,
    schemaReady: false,
  };
  if (!client) return empty;

  const schemaReady = await detectWorksFanzaTvSchema();
  if (!schemaReady) return empty;

  const { count: totalCount } = await client
    .from("works")
    .select("cid", { count: "exact", head: true });
  const { count: availableCount } = await client
    .from("works")
    .select("cid", { count: "exact", head: true })
    .eq("fanza_tv_status", "available");
  const { count: unavailableCount } = await client
    .from("works")
    .select("cid", { count: "exact", head: true })
    .eq("fanza_tv_status", "unavailable");
  const { data: latest } = await client
    .from("works")
    .select("fanza_tv_checked_at")
    .not("fanza_tv_checked_at", "is", null)
    .order("fanza_tv_checked_at", { ascending: false })
    .limit(1);

  const total = totalCount ?? 0;
  const available = availableCount ?? 0;
  const unavailable = unavailableCount ?? 0;

  return {
    totalCount: total,
    availableCount: available,
    unavailableCount: unavailable,
    uncheckedCount: Math.max(0, total - available - unavailable),
    lastCheckedAt: latest?.[0]?.fanza_tv_checked_at ?? null,
    schemaReady: true,
  };
}

/** 未確認 = unknown（works.fanza_tv_status） */
export async function listFanzaTvTargetCids(input: {
  mode: "unchecked_only" | "full_recheck" | "limit";
  limit: number | null;
}): Promise<string[]> {
  const client = getSupabaseServiceClient();
  if (!client) throw new Error("Supabase が未設定です");
  await assertWorksFanzaTvSchema();

  const cids: string[] = [];
  let from = 0;

  while (true) {
    let query = client
      .from("works")
      .select("cid,fanza_tv_status")
      .order("cid", { ascending: true })
      .range(from, from + PAGE - 1);
    if (input.mode === "unchecked_only") {
      query = query.eq("fanza_tv_status", "unknown");
    }
    const { data, error } = await query;
    if (error) throw error;
    const rows = data ?? [];
    if (rows.length === 0) break;
    for (const raw of rows) {
      const cid = normalizeCatalogContentId(String(raw.cid ?? ""));
      if (!cid) continue;
      cids.push(cid);
      if (input.limit != null && cids.length >= input.limit) {
        return cids.slice(0, input.limit);
      }
    }
    if (rows.length < PAGE) break;
    from += PAGE;
  }

  return input.limit != null ? cids.slice(0, input.limit) : cids;
}

/** FANZA TV判定結果を works へ保存（work_live_status は使わない） */
export async function saveFanzaTvCheckResults(
  rows: FanzaTvCheckResultRow[],
): Promise<{ target: "works" }> {
  const client = getSupabaseServiceClient();
  if (!client) throw new Error("Supabase が未設定です");
  if (rows.length === 0) return { target: "works" };
  await assertWorksFanzaTvSchema();

  for (const row of rows) {
    const cid = normalizeCatalogContentId(row.cid);
    if (!cid) continue;
    const { error } = await client
      .from("works")
      .update({
        fanza_tv_status: row.status,
        fanza_tv_checked_at: row.checkedAt,
        fanza_tv_url: row.url,
        updated_at: row.checkedAt,
      })
      .eq("cid", cid);
    if (error) {
      throw new Error(`works update failed (${cid}): ${error.message}`);
    }
  }
  return { target: "works" };
}
