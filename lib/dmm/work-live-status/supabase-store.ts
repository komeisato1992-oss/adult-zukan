import "server-only";

import { normalizeCatalogContentId } from "@/lib/dmm/catalog-snapshot";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type {
  WorkLiveStatusRow,
  WorkLiveStatusUpsertInput,
} from "@/lib/dmm/work-live-status/types";

const TABLE = "work_live_status";
const CHUNK = 200;
let priceAmountColumnAvailable: boolean | null = null;
let fanzaNewRankColumnAvailable: boolean | null = null;

function normalizeRow(raw: Record<string, unknown>): WorkLiveStatusRow | null {
  const cid = normalizeCatalogContentId(String(raw.cid ?? ""));
  if (!cid) return null;
  return {
    cid,
    price: raw.price == null ? null : String(raw.price),
    list_price: raw.list_price == null ? null : String(raw.list_price),
    price_amount:
      raw.price_amount == null || raw.price_amount === ""
        ? null
        : Number(raw.price_amount),
    discount_rate:
      raw.discount_rate == null || raw.discount_rate === ""
        ? null
        : Number(raw.discount_rate),
    is_sale: Boolean(raw.is_sale),
    sale_start_at:
      raw.sale_start_at == null ? null : String(raw.sale_start_at),
    sale_end_at: raw.sale_end_at == null ? null : String(raw.sale_end_at),
    rating:
      raw.rating == null || raw.rating === "" ? null : Number(raw.rating),
    review_count:
      raw.review_count == null || raw.review_count === ""
        ? null
        : Number(raw.review_count),
    popularity_rank:
      raw.popularity_rank == null || raw.popularity_rank === ""
        ? null
        : Number(raw.popularity_rank),
    new_arrival_rank:
      raw.new_arrival_rank == null || raw.new_arrival_rank === ""
        ? null
        : Number(raw.new_arrival_rank),
    fanza_new_rank:
      raw.fanza_new_rank == null || raw.fanza_new_rank === ""
        ? null
        : Number(raw.fanza_new_rank),
    fanza_new_rank_updated_at:
      raw.fanza_new_rank_updated_at == null
        ? null
        : String(raw.fanza_new_rank_updated_at),
    is_available: raw.is_available === false ? false : true,
    manual_hidden: raw.manual_hidden === true,
    fanza_tv_status:
      raw.fanza_tv_status == null ? null : String(raw.fanza_tv_status),
    fanza_tv_checked_at:
      raw.fanza_tv_checked_at == null
        ? null
        : String(raw.fanza_tv_checked_at),
    fanza_tv_changed_at:
      raw.fanza_tv_changed_at == null
        ? null
        : String(raw.fanza_tv_changed_at),
    fanza_tv_source:
      raw.fanza_tv_source == null ? null : String(raw.fanza_tv_source),
    fanza_tv_error:
      raw.fanza_tv_error == null ? null : String(raw.fanza_tv_error),
    checked_at: raw.checked_at == null ? null : String(raw.checked_at),
    updated_at:
      raw.updated_at == null
        ? new Date().toISOString()
        : String(raw.updated_at),
  };
}

export async function supabaseFetchLiveStatusByCids(
  cids: string[],
): Promise<Map<string, WorkLiveStatusRow>> {
  const client = getSupabaseServiceClient();
  const map = new Map<string, WorkLiveStatusRow>();
  if (!client || cids.length === 0) return map;

  const normalized = [
    ...new Set(
      cids
        .map((cid) => normalizeCatalogContentId(cid))
        .filter((cid): cid is string => Boolean(cid)),
    ),
  ];

  for (let i = 0; i < normalized.length; i += CHUNK) {
    const slice = normalized.slice(i, i + CHUNK);
    const { data, error } = await client
      .from(TABLE)
      .select("*")
      .in("cid", slice);

    if (error) {
      console.warn("[work-live-status] supabase fetch failed", error.message);
      throw error;
    }

    for (const raw of data ?? []) {
      const row = normalizeRow(raw as Record<string, unknown>);
      if (row) map.set(row.cid, row);
    }
  }

  return map;
}

async function detectPriceAmountColumn(): Promise<boolean> {
  if (priceAmountColumnAvailable != null) return priceAmountColumnAvailable;
  const client = getSupabaseServiceClient();
  if (!client) {
    priceAmountColumnAvailable = false;
    return false;
  }
  const { error } = await client.from(TABLE).select("price_amount").limit(1);
  priceAmountColumnAvailable = !error;
  return priceAmountColumnAvailable;
}

async function detectFanzaNewRankColumn(): Promise<boolean> {
  if (fanzaNewRankColumnAvailable != null) return fanzaNewRankColumnAvailable;
  const client = getSupabaseServiceClient();
  if (!client) {
    fanzaNewRankColumnAvailable = false;
    return false;
  }
  const { error } = await client.from(TABLE).select("fanza_new_rank").limit(1);
  fanzaNewRankColumnAvailable = !error;
  return fanzaNewRankColumnAvailable;
}

export async function supabaseUpsertLiveStatusRows(
  rows: WorkLiveStatusUpsertInput[],
): Promise<{ upserted: number }> {
  const client = getSupabaseServiceClient();
  if (!client || rows.length === 0) return { upserted: 0 };

  const now = new Date().toISOString();
  const { detectWorksCmsSchemaV2 } = await import(
    "@/lib/admin/works-cms-overrides"
  );
  const schemaV2 = await detectWorksCmsSchemaV2();
  const hasPriceAmount = await detectPriceAmountColumn();
  const hasFanzaNewRank = await detectFanzaNewRankColumn();
  const payload: Record<string, unknown>[] = [];

  for (const row of rows) {
    const cid = normalizeCatalogContentId(row.cid);
    if (!cid) continue;
    const base: Record<string, unknown> = {
      ...row,
      cid,
      updated_at: row.updated_at ?? now,
    };
    if (!schemaV2) {
      delete base.manual_hidden;
      delete base.sale_start_at;
      delete base.fanza_tv_checked_at;
      delete base.fanza_tv_changed_at;
      delete base.fanza_tv_source;
      delete base.fanza_tv_error;
    }
    if (!hasPriceAmount) {
      delete base.price_amount;
    }
    if (!hasFanzaNewRank) {
      delete base.fanza_new_rank;
      delete base.fanza_new_rank_updated_at;
    }
    payload.push(base);
  }

  let upserted = 0;
  for (let i = 0; i < payload.length; i += CHUNK) {
    const slice = payload.slice(i, i + CHUNK);
    const { error, count } = await client.from(TABLE).upsert(slice, {
      onConflict: "cid",
      count: "exact",
    });
    if (error) {
      if (
        hasPriceAmount &&
        /price_amount/i.test(error.message || "")
      ) {
        priceAmountColumnAvailable = false;
        for (const row of slice) delete row.price_amount;
        const retry = await client.from(TABLE).upsert(slice, {
          onConflict: "cid",
          count: "exact",
        });
        if (retry.error) {
          console.warn(
            "[work-live-status] supabase upsert failed",
            retry.error.message,
          );
          throw retry.error;
        }
        upserted += retry.count ?? slice.length;
        continue;
      }
      console.warn("[work-live-status] supabase upsert failed", error.message);
      throw error;
    }
    upserted += count ?? slice.length;
  }

  return { upserted };
}

export type TableCountStatus =
  | "ok"
  | "connection_error"
  | "table_missing"
  | "fetch_failed";

export type TableCountResult = {
  count: number | null;
  status: TableCountStatus;
  message: string | null;
};

function classifySupabaseCountError(error: {
  message?: string;
  code?: string;
}): TableCountResult {
  const message = error.message ?? "件数取得に失敗しました";
  const code = error.code ?? "";
  const lowered = message.toLowerCase();
  if (
    code === "42P01" ||
    code === "PGRST205" ||
    lowered.includes("does not exist") ||
    lowered.includes("schema cache")
  ) {
    return { count: null, status: "table_missing", message: "テーブル未作成" };
  }
  if (
    code === "PGRST301" ||
    lowered.includes("fetch failed") ||
    lowered.includes("network") ||
    lowered.includes("enotfound") ||
    lowered.includes("econnrefused")
  ) {
    return { count: null, status: "connection_error", message: "接続エラー" };
  }
  return { count: null, status: "fetch_failed", message: "取得失敗" };
}

export async function supabaseCountLiveStatusRowsDetailed(): Promise<TableCountResult> {
  const client = getSupabaseServiceClient();
  if (!client) {
    return {
      count: null,
      status: "connection_error",
      message: "接続エラー",
    };
  }
  const { count, error } = await client
    .from(TABLE)
    .select("cid", { count: "exact", head: true });
  if (error) {
    console.warn("[work-live-status] supabase count failed", error.message);
    return classifySupabaseCountError(error);
  }
  return { count: count ?? 0, status: "ok", message: null };
}

export async function supabaseCountLiveStatusRows(): Promise<number> {
  const result = await supabaseCountLiveStatusRowsDetailed();
  if (result.status !== "ok" || result.count == null) {
    throw new Error(result.message ?? "work_live_status count failed");
  }
  return result.count;
}

export async function supabaseFetchAllLiveStatusCids(): Promise<string[]> {
  const client = getSupabaseServiceClient();
  if (!client) return [];

  const PAGE = 1000;
  const cids: string[] = [];
  for (let from = 0; ; from += PAGE) {
    const to = from + PAGE - 1;
    const { data, error } = await client
      .from(TABLE)
      .select("cid")
      .order("cid", { ascending: true })
      .range(from, to);
    if (error) {
      console.warn("[work-live-status] supabase cid list failed", error.message);
      throw error;
    }
    const batch = data ?? [];
    for (const raw of batch) {
      const cid = normalizeCatalogContentId(
        String((raw as { cid?: string }).cid ?? ""),
      );
      if (cid) cids.push(cid);
    }
    if (batch.length < PAGE) break;
  }
  return cids;
}

/** 既存レコードは上書きしない insert（ignoreDuplicates） */
export async function supabaseInsertLiveStatusRowsIgnoreExisting(
  rows: WorkLiveStatusUpsertInput[],
): Promise<{ inserted: number }> {
  const client = getSupabaseServiceClient();
  if (!client || rows.length === 0) return { inserted: 0 };

  const now = new Date().toISOString();
  const { detectWorksCmsSchemaV2 } = await import(
    "@/lib/admin/works-cms-overrides"
  );
  const schemaV2 = await detectWorksCmsSchemaV2();
  const payload: Record<string, unknown>[] = [];

  for (const row of rows) {
    const cid = normalizeCatalogContentId(row.cid);
    if (!cid) continue;
    const base: Record<string, unknown> = {
      ...row,
      cid,
      updated_at: row.updated_at ?? now,
    };
    if (!schemaV2) {
      delete base.manual_hidden;
      delete base.sale_start_at;
      delete base.fanza_tv_checked_at;
      delete base.fanza_tv_changed_at;
      delete base.fanza_tv_source;
      delete base.fanza_tv_error;
    }
    payload.push(base);
  }

  let inserted = 0;
  for (let i = 0; i < payload.length; i += CHUNK) {
    const slice = payload.slice(i, i + CHUNK);
    const { error, count } = await client.from(TABLE).upsert(slice, {
      onConflict: "cid",
      ignoreDuplicates: true,
      count: "exact",
    });
    if (error) {
      console.warn(
        "[work-live-status] supabase insert-ignore failed",
        error.message,
      );
      throw error;
    }
    inserted += count ?? slice.length;
  }

  return { inserted };
}
