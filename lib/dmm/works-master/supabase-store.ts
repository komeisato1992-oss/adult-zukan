import "server-only";

import { normalizeCatalogContentId } from "@/lib/dmm/catalog-snapshot";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type {
  WorkMasterNamedEntity,
  WorkMasterRow,
  WorkMasterUpsertInput,
} from "@/lib/dmm/works-master/types";

const TABLE = "works";
const CHUNK = 100;
const PAGE = 1000;

function asNamedList(raw: unknown): WorkMasterNamedEntity[] {
  if (!Array.isArray(raw)) return [];
  const result: WorkMasterNamedEntity[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const obj = entry as { id?: number; name?: string; ruby?: string };
    const name = obj.name?.trim();
    if (!name) continue;
    result.push({
      id: typeof obj.id === "number" ? obj.id : undefined,
      name,
      ruby: obj.ruby?.trim() || undefined,
    });
  }
  return result;
}

function normalizeImageStatus(
  raw: unknown,
): WorkMasterRow["image_status"] {
  const v = String(raw ?? "").trim();
  if (v === "ok" || v === "now_printing" || v === "fetch_failed") return v;
  return null;
}

function normalizeRow(raw: Record<string, unknown>): WorkMasterRow | null {
  const cid = normalizeCatalogContentId(String(raw.cid ?? ""));
  if (!cid) return null;
  const now = new Date().toISOString();
  return {
    cid,
    slug: String(raw.slug ?? cid).trim() || cid,
    title: String(raw.title ?? cid).trim() || cid,
    description: raw.description == null ? null : String(raw.description),
    package_image: raw.package_image == null ? null : String(raw.package_image),
    image_status: normalizeImageStatus(raw.image_status),
    image_status_checked_at:
      raw.image_status_checked_at == null
        ? null
        : String(raw.image_status_checked_at),
    sample_images: Array.isArray(raw.sample_images)
      ? raw.sample_images.filter((url): url is string => typeof url === "string")
      : [],
    actresses: asNamedList(raw.actresses),
    maker: raw.maker == null ? null : String(raw.maker),
    label: raw.label == null ? null : String(raw.label),
    series: raw.series == null ? null : String(raw.series),
    genres: asNamedList(raw.genres),
    release_date: raw.release_date == null ? null : String(raw.release_date),
    duration: raw.duration == null ? null : String(raw.duration),
    product_code: raw.product_code == null ? null : String(raw.product_code),
    affiliate_url: raw.affiliate_url == null ? null : String(raw.affiliate_url),
    published: raw.published !== false,
    manual_hidden: raw.manual_hidden === true,
    manual_hidden_reason:
      raw.manual_hidden_reason == null
        ? null
        : String(raw.manual_hidden_reason),
    deleted_at: raw.deleted_at == null ? null : String(raw.deleted_at),
    created_at: raw.created_at == null ? now : String(raw.created_at),
    updated_at: raw.updated_at == null ? now : String(raw.updated_at),
  };
}

export async function supabaseFetchWorkMasterByCids(
  cids: string[],
): Promise<Map<string, WorkMasterRow>> {
  const client = getSupabaseServiceClient();
  const map = new Map<string, WorkMasterRow>();
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
    const { data, error } = await client.from(TABLE).select("*").in("cid", slice);
    if (error) {
      console.warn("[works-master] supabase fetch failed", error.message);
      throw error;
    }
    for (const raw of data ?? []) {
      const row = normalizeRow(raw as Record<string, unknown>);
      if (row) map.set(row.cid, row);
    }
  }

  return map;
}

export async function supabaseFetchAllPublishedWorkMasters(): Promise<WorkMasterRow[]> {
  const client = getSupabaseServiceClient();
  if (!client) return [];

  const rows: WorkMasterRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const to = from + PAGE - 1;
    const { data, error } = await client
      .from(TABLE)
      .select("*")
      .eq("published", true)
      .order("cid", { ascending: true })
      .range(from, to);

    if (error) {
      console.warn("[works-master] supabase list failed", error.message);
      throw error;
    }

    const batch = data ?? [];
    for (const raw of batch) {
      const row = normalizeRow(raw as Record<string, unknown>);
      if (row) rows.push(row);
    }
    if (batch.length < PAGE) break;
  }

  return rows;
}

export async function supabaseFetchAllWorkMasterCids(): Promise<string[]> {
  const client = getSupabaseServiceClient();
  if (!client) return [];

  const cids: string[] = [];
  for (let from = 0; ; from += PAGE) {
    const to = from + PAGE - 1;
    const { data, error } = await client
      .from(TABLE)
      .select("cid")
      .order("cid", { ascending: true })
      .range(from, to);

    if (error) {
      console.warn("[works-master] supabase cid list failed", error.message);
      throw error;
    }

    const batch = data ?? [];
    for (const raw of batch) {
      const cid = normalizeCatalogContentId(String((raw as { cid?: string }).cid ?? ""));
      if (cid) cids.push(cid);
    }
    if (batch.length < PAGE) break;
  }

  return cids;
}

export async function supabaseFetchAllPublishedWorkMasterCids(): Promise<string[]> {
  const client = getSupabaseServiceClient();
  if (!client) return [];

  const cids: string[] = [];
  for (let from = 0; ; from += PAGE) {
    const to = from + PAGE - 1;
    const { data, error } = await client
      .from(TABLE)
      .select("cid")
      .eq("published", true)
      .order("cid", { ascending: true })
      .range(from, to);

    if (error) {
      console.warn(
        "[works-master] supabase published cid list failed",
        error.message,
      );
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

export async function supabaseUpsertWorkMasterRows(
  rows: WorkMasterUpsertInput[],
): Promise<{ upserted: number }> {
  const client = getSupabaseServiceClient();
  if (!client || rows.length === 0) return { upserted: 0 };

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
      slug: row.slug?.trim() || cid,
      title: row.title?.trim() || cid,
      updated_at: row.updated_at ?? now,
      created_at: row.created_at ?? now,
    };
    if (!schemaV2) {
      delete base.manual_hidden;
      delete base.manual_hidden_reason;
      delete base.deleted_at;
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
      console.warn("[works-master] supabase upsert failed", error.message);
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

export async function supabaseCountWorkMasterRowsDetailed(): Promise<TableCountResult> {
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
    console.warn("[works-master] supabase count failed", error.message);
    return classifySupabaseCountError(error);
  }
  return { count: count ?? 0, status: "ok", message: null };
}

export async function supabaseCountWorkMasterRows(): Promise<number> {
  const result = await supabaseCountWorkMasterRowsDetailed();
  if (result.status !== "ok" || result.count == null) {
    throw new Error(result.message ?? "works count failed");
  }
  return result.count;
}
