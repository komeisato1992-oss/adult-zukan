import "server-only";

import { normalizeCatalogContentId } from "@/lib/dmm/catalog-snapshot";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import {
  computeWorksPublished,
  normalizeFanzaTvStatus,
  type FanzaTvStatusValue,
} from "@/lib/admin/works-cms-publish";
import {
  detectWorksCmsSchemaV2,
  getWorksCmsOverride,
  listWorksCmsOverrides,
  upsertWorksCmsOverrides,
} from "@/lib/admin/works-cms-overrides";
import { readWorksAddOffsetState } from "@/lib/admin/works-add-offset-store";
import { readWorksMasterMigrationJob } from "@/lib/admin/works-master-migration-store";
import { getFanzaSyncStatus } from "@/lib/admin/fanza-sync-runner";
import type { WorkMasterRow } from "@/lib/dmm/works-master/types";
import type { WorkLiveStatusRow } from "@/lib/dmm/work-live-status/types";

export type WorksCmsOverview = {
  publishedCount: number;
  unpublishedCount: number;
  noPackageImageCount: number;
  unavailableCount: number;
  manualHiddenCount: number;
  lastWorkAddedAt: string | null;
  lastLightSyncAt: string | null;
  runningJobLabel: string | null;
  errorCount: number;
  tone: "ok" | "running" | "warn" | "error";
  fanzaTv: {
    uncheckedCount: number;
    activeCount: number;
    notAvailableCount: number;
    unknownCount: number;
    lastCheckedAt: string | null;
    becameActiveCount: number;
    becameUnavailableCount: number;
    errorCount: number;
    resumeCursor: number;
  };
  offsets: ReturnType<typeof readWorksAddOffsetState>;
  schemaV2: boolean;
  deployRequired: false;
  jsonFallbackKept: true;
};

export type WorksCmsListFilter = {
  q?: string;
  cid?: string;
  actress?: string;
  maker?: string;
  label?: string;
  series?: string;
  genre?: string;
  published?: "all" | "published" | "unpublished";
  noImage?: boolean;
  unavailable?: boolean;
  manualHidden?: boolean;
  fanzaTv?: "all" | "active" | "unchecked" | "unknown" | "not_available";
  page?: number;
  pageSize?: number;
};

export type WorksCmsListItem = {
  cid: string;
  slug: string;
  title: string;
  package_image: string | null;
  maker: string | null;
  actresses: string[];
  release_date: string | null;
  published: boolean;
  manual_hidden: boolean;
  manual_hidden_reason: string | null;
  deleted_at: string | null;
  is_available: boolean;
  fanza_tv_status: string | null;
  price: string | null;
  updated_at: string;
};

function toneFromOverview(input: {
  running: boolean;
  errorCount: number;
  noPackageImageCount: number;
}): WorksCmsOverview["tone"] {
  if (input.errorCount > 0) return "error";
  if (input.running) return "running";
  if (input.noPackageImageCount > 0) return "warn";
  return "ok";
}

export async function getWorksCmsOverview(): Promise<WorksCmsOverview> {
  const schemaV2 = await detectWorksCmsSchemaV2();
  const client = getSupabaseServiceClient();
  const overrides = listWorksCmsOverrides();
  const overrideByCid = new Map(overrides.map((o) => [o.cid, o]));

  let publishedCount = 0;
  let unpublishedCount = 0;
  let noPackageImageCount = 0;
  let unavailableCount = 0;
  let manualHiddenCount = 0;
  let lastWorkAddedAt: string | null = null;

  let uncheckedCount = 0;
  let activeCount = 0;
  let notAvailableCount = 0;
  let unknownCount = 0;
  let lastCheckedAt: string | null = null;
  let fanzaErrorCount = 0;

  if (client) {
    const { count: pub } = await client
      .from("works")
      .select("cid", { count: "exact", head: true })
      .eq("published", true);
    publishedCount = pub ?? 0;

    const { count: total } = await client
      .from("works")
      .select("cid", { count: "exact", head: true });
    const totalCount = total ?? 0;
    unpublishedCount = Math.max(0, totalCount - publishedCount);

    const { count: noImg } = await client
      .from("works")
      .select("cid", { count: "exact", head: true })
      .or("package_image.is.null,package_image.eq.");
    noPackageImageCount = noImg ?? 0;

    const { count: unavail } = await client
      .from("work_live_status")
      .select("cid", { count: "exact", head: true })
      .eq("is_available", false);
    unavailableCount = unavail ?? 0;

    const { data: latest } = await client
      .from("works")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1);
    lastWorkAddedAt = latest?.[0]?.created_at ?? null;

    // FANZA TV counts（既存 fanza_tv_status + overrides）
    const { data: tvRows } = await client
      .from("work_live_status")
      .select("cid,fanza_tv_status,checked_at")
      .limit(20000);
    const seen = new Set<string>();
    for (const raw of tvRows ?? []) {
      const cid = normalizeCatalogContentId(String((raw as { cid?: string }).cid ?? ""));
      if (!cid) continue;
      seen.add(cid);
      const ov = overrideByCid.get(cid);
      const status = normalizeFanzaTvStatus(
        ov?.fanza_tv_status ?? (raw as { fanza_tv_status?: string }).fanza_tv_status,
      );
      const checked =
        ov?.fanza_tv_checked_at ??
        (raw as { checked_at?: string }).checked_at ??
        null;
      if (checked && (!lastCheckedAt || checked > lastCheckedAt)) {
        lastCheckedAt = checked;
      }
      if (!status) uncheckedCount += 1;
      else if (status === "active") activeCount += 1;
      else if (status === "not_available") notAvailableCount += 1;
      else unknownCount += 1;
      if (ov?.fanza_tv_error) fanzaErrorCount += 1;
    }
    for (const ov of overrides) {
      if (seen.has(ov.cid)) continue;
      const status = normalizeFanzaTvStatus(ov.fanza_tv_status);
      if (!status) uncheckedCount += 1;
      else if (status === "active") activeCount += 1;
      else if (status === "not_available") notAvailableCount += 1;
      else unknownCount += 1;
      if (ov.fanza_tv_error) fanzaErrorCount += 1;
    }
  }

  for (const ov of overrides) {
    if (ov.manual_hidden) manualHiddenCount += 1;
    if (ov.deleted_at) unpublishedCount += 1;
  }

  if (schemaV2 && client) {
    const { count: mh } = await client
      .from("works")
      .select("cid", { count: "exact", head: true })
      .eq("manual_hidden", true);
    manualHiddenCount = mh ?? manualHiddenCount;
  }

  const sync = await getFanzaSyncStatus();
  const mig = readWorksMasterMigrationJob();
  const running =
    sync.currentJob?.status === "running" ||
    sync.currentJob?.status === "pending" ||
    mig.status === "running";
  const runningJobLabel = running
    ? sync.currentJob?.status === "running" || sync.currentJob?.status === "pending"
      ? `軽量同期 ${sync.currentJob.processedCount}/${sync.currentJob.targetCount}`
      : `作品移行 ${mig.processedCount}/${mig.targetCount}`
    : null;

  const errorCount =
    (sync.currentJob?.errorCount ?? 0) +
    (mig.failedCount ?? 0) +
    fanzaErrorCount;

  const lastLightSyncAt =
    sync.currentJob?.completedAt ??
    sync.currentJob?.updatedAt ??
    sync.history?.[0]?.completedAt ??
    null;

  return {
    publishedCount,
    unpublishedCount,
    noPackageImageCount,
    unavailableCount,
    manualHiddenCount,
    lastWorkAddedAt,
    lastLightSyncAt,
    runningJobLabel,
    errorCount,
    tone: toneFromOverview({
      running,
      errorCount,
      noPackageImageCount,
    }),
    fanzaTv: {
      uncheckedCount,
      activeCount,
      notAvailableCount,
      unknownCount,
      lastCheckedAt,
      becameActiveCount: 0,
      becameUnavailableCount: 0,
      errorCount: fanzaErrorCount,
      resumeCursor: 0,
    },
    offsets: readWorksAddOffsetState(),
    schemaV2,
    deployRequired: false,
    jsonFallbackKept: true,
  };
}

export async function listWorksCmsItems(
  filter: WorksCmsListFilter,
): Promise<{ items: WorksCmsListItem[]; total: number }> {
  const client = getSupabaseServiceClient();
  if (!client) return { items: [], total: 0 };

  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filter.pageSize ?? 20));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = client
    .from("works")
    .select(
      "cid,slug,title,package_image,maker,actresses,release_date,published,created_at,updated_at",
      { count: "exact" },
    )
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (filter.cid?.trim()) {
    query = query.ilike("cid", `%${filter.cid.trim().toLowerCase()}%`);
  }
  if (filter.q?.trim()) {
    query = query.ilike("title", `%${filter.q.trim()}%`);
  }
  if (filter.maker?.trim()) {
    query = query.ilike("maker", `%${filter.maker.trim()}%`);
  }
  if (filter.published === "published") {
    query = query.eq("published", true);
  } else if (filter.published === "unpublished") {
    query = query.eq("published", false);
  }
  if (filter.noImage) {
    query = query.or("package_image.is.null,package_image.eq.");
  }

  const { data, count, error } = await query;
  if (error) {
    console.warn("[works-cms] list failed", error.message);
    return { items: [], total: 0 };
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const cids = rows
    .map((r) => normalizeCatalogContentId(String(r.cid ?? "")))
    .filter(Boolean);

  const { supabaseFetchLiveStatusByCids } = await import(
    "@/lib/dmm/work-live-status/supabase-store"
  );
  const liveMap = await supabaseFetchLiveStatusByCids(cids);

  let items: WorksCmsListItem[] = rows.map((raw) => {
    const cid = normalizeCatalogContentId(String(raw.cid ?? ""));
    const live = liveMap.get(cid);
    const ov = getWorksCmsOverride(cid);
    const actresses = Array.isArray(raw.actresses)
      ? (raw.actresses as Array<{ name?: string }>)
          .map((a) => a.name?.trim() || "")
          .filter(Boolean)
      : [];
    return {
      cid,
      slug: String(raw.slug ?? cid),
      title: String(raw.title ?? cid),
      package_image:
        raw.package_image == null ? null : String(raw.package_image),
      maker: raw.maker == null ? null : String(raw.maker),
      actresses,
      release_date:
        raw.release_date == null ? null : String(raw.release_date),
      published: raw.published !== false,
      manual_hidden: ov?.manual_hidden === true,
      manual_hidden_reason: ov?.manual_hidden_reason ?? null,
      deleted_at: ov?.deleted_at ?? null,
      is_available: live?.is_available !== false,
      fanza_tv_status:
        ov?.fanza_tv_status ?? live?.fanza_tv_status ?? null,
      price: live?.price ?? null,
      updated_at: String(raw.updated_at ?? ""),
    };
  });

  // クライアント側追加フィルタ（小ページ向け）
  if (filter.actress?.trim()) {
    const needle = filter.actress.trim().toLowerCase();
    items = items.filter((i) =>
      i.actresses.some((a) => a.toLowerCase().includes(needle)),
    );
  }
  if (filter.label?.trim()) {
    /* label not in select for speed — skip deep */
  }
  if (filter.manualHidden) {
    items = items.filter((i) => i.manual_hidden);
  }
  if (filter.unavailable) {
    items = items.filter((i) => !i.is_available);
  }
  if (filter.fanzaTv && filter.fanzaTv !== "all") {
    items = items.filter((i) => {
      const st = normalizeFanzaTvStatus(i.fanza_tv_status);
      if (filter.fanzaTv === "unchecked") return !st;
      return st === filter.fanzaTv;
    });
  }

  return { items, total: count ?? items.length };
}

export async function patchWorksCmsPublish(input: {
  cids: string[];
  action:
    | "publish"
    | "unpublish"
    | "manual_hide"
    | "manual_unhide"
    | "mark_unavailable"
    | "restore"
    | "soft_delete"
    | "hard_delete"
    | "reset_fanza_tv";
  reason?: string;
}): Promise<{ updated: number }> {
  const client = getSupabaseServiceClient();
  if (!client) throw new Error("Supabase未設定");

  const cids = [
    ...new Set(
      input.cids
        .map((c) => normalizeCatalogContentId(c))
        .filter((c): c is string => Boolean(c)),
    ),
  ];
  if (cids.length === 0) return { updated: 0 };

  const { supabaseFetchWorkMasterByCids, supabaseUpsertWorkMasterRows } =
    await import("@/lib/dmm/works-master/supabase-store");
  const { supabaseFetchLiveStatusByCids, supabaseUpsertLiveStatusRows } =
    await import("@/lib/dmm/work-live-status/supabase-store");
  const { revalidateWorksMasterAfterAdd } = await import(
    "@/lib/dmm/works-master"
  );
  const { revalidateWorkLiveStatusAfterSync } = await import(
    "@/lib/dmm/work-live-status"
  );

  const masters = await supabaseFetchWorkMasterByCids(cids);
  const lives = await supabaseFetchLiveStatusByCids(cids);
  const now = new Date().toISOString();
  const overridePatches: Parameters<typeof upsertWorksCmsOverrides>[0] = [];

  const masterUpserts: WorkMasterRow[] = [];
  const liveUpserts: WorkLiveStatusUpsertLoose[] = [];

  for (const cid of cids) {
    const master = masters.get(cid);
    if (!master) continue;
    const live = lives.get(cid);
    const ov = getWorksCmsOverride(cid) ?? { cid };

    let manualHidden = ov.manual_hidden === true;
    let deletedAt = ov.deleted_at ?? null;
    let isAvailable = live?.is_available !== false;
    let fanzaStatus = ov.fanza_tv_status ?? live?.fanza_tv_status ?? null;

    switch (input.action) {
      case "publish":
        manualHidden = false;
        deletedAt = null;
        isAvailable = true;
        break;
      case "unpublish":
        // published のみ落とす（手動フラグは付けない）
        break;
      case "manual_hide":
        manualHidden = true;
        break;
      case "manual_unhide":
        manualHidden = false;
        break;
      case "mark_unavailable":
        isAvailable = false;
        break;
      case "restore":
        isAvailable = true;
        manualHidden = false;
        deletedAt = null;
        break;
      case "soft_delete":
        deletedAt = now;
        manualHidden = true;
        break;
      case "hard_delete":
        await client.from("works").delete().eq("cid", cid);
        await client.from("work_live_status").delete().eq("cid", cid);
        upsertWorksCmsOverrides([{ cid, deleted_at: now, manual_hidden: true }]);
        continue;
      case "reset_fanza_tv":
        fanzaStatus = "unknown";
        overridePatches.push({
          cid,
          fanza_tv_status: "unknown",
          fanza_tv_checked_at: null,
          fanza_tv_error: null,
          fanza_tv_source: null,
        });
        break;
      default:
        break;
    }

    const published =
      input.action === "unpublish"
        ? false
        : computeWorksPublished({
            packageImage: master.package_image,
            isAvailable,
            manualHidden,
            deletedAt,
          });

    overridePatches.push({
      cid,
      manual_hidden: manualHidden,
      manual_hidden_reason:
        input.action === "manual_hide"
          ? input.reason ?? ov.manual_hidden_reason ?? "手動非公開"
          : manualHidden
            ? ov.manual_hidden_reason ?? null
            : null,
      deleted_at: deletedAt,
      fanza_tv_status: normalizeFanzaTvStatus(fanzaStatus),
    });

    masterUpserts.push({
      ...master,
      published,
      manual_hidden: manualHidden,
      manual_hidden_reason:
        input.action === "manual_hide"
          ? input.reason ?? "手動非公開"
          : master.manual_hidden_reason,
      deleted_at: deletedAt,
      updated_at: now,
    });

    liveUpserts.push({
      cid,
      price: live?.price ?? null,
      list_price: live?.list_price ?? null,
      discount_rate: live?.discount_rate ?? null,
      is_sale: live?.is_sale ?? false,
      sale_start_at: live?.sale_start_at ?? null,
      sale_end_at: live?.sale_end_at ?? null,
      rating: live?.rating ?? null,
      review_count: live?.review_count ?? null,
      popularity_rank: live?.popularity_rank ?? null,
      new_arrival_rank: live?.new_arrival_rank ?? null,
      is_available: isAvailable,
      manual_hidden: manualHidden,
      fanza_tv_status: fanzaStatus,
      fanza_tv_checked_at: live?.fanza_tv_checked_at ?? null,
      fanza_tv_changed_at: live?.fanza_tv_changed_at ?? null,
      fanza_tv_source: live?.fanza_tv_source ?? null,
      fanza_tv_error: live?.fanza_tv_error ?? null,
      checked_at: live?.checked_at ?? now,
      updated_at: now,
    });
  }

  upsertWorksCmsOverrides(overridePatches);

  if (masterUpserts.length > 0) {
    await supabaseUpsertWorkMasterRows(masterUpserts);
  }

  if (liveUpserts.length > 0) {
    await supabaseUpsertLiveStatusRows(liveUpserts);
  }

  await revalidateWorksMasterAfterAdd();
  revalidateWorkLiveStatusAfterSync();

  return { updated: masterUpserts.length };
}

type WorkLiveStatusUpsertLoose = WorkLiveStatusRow;

export async function updateWorkMasterFields(input: {
  cid: string;
  patch: Partial<{
    title: string;
    description: string | null;
    actresses: WorkMasterRow["actresses"];
    maker: string | null;
    label: string | null;
    series: string | null;
    genres: WorkMasterRow["genres"];
    release_date: string | null;
    duration: string | null;
    product_code: string | null;
    package_image: string | null;
    sample_images: string[];
    affiliate_url: string | null;
    manual_hidden: boolean;
    manual_hidden_reason: string | null;
  }>;
}): Promise<{ ok: true; published: boolean }> {
  const cid = normalizeCatalogContentId(input.cid);
  if (!cid) throw new Error("CIDが不正です");

  const { supabaseFetchWorkMasterByCids, supabaseUpsertWorkMasterRows } =
    await import("@/lib/dmm/works-master/supabase-store");
  const { supabaseFetchLiveStatusByCids } = await import(
    "@/lib/dmm/work-live-status/supabase-store"
  );
  const { revalidateWorksMasterAfterAdd } = await import(
    "@/lib/dmm/works-master"
  );

  const map = await supabaseFetchWorkMasterByCids([cid]);
  const existing = map.get(cid);
  if (!existing) throw new Error("作品が見つかりません");

  const live = (await supabaseFetchLiveStatusByCids([cid])).get(cid);
  const ov = getWorksCmsOverride(cid);
  const manualHidden =
    input.patch.manual_hidden ?? ov?.manual_hidden ?? existing.manual_hidden;
  const packageImage =
    input.patch.package_image !== undefined
      ? input.patch.package_image
      : existing.package_image;

  const published = computeWorksPublished({
    packageImage,
    isAvailable: live?.is_available !== false,
    manualHidden: Boolean(manualHidden),
    deletedAt: ov?.deleted_at ?? existing.deleted_at,
  });

  const now = new Date().toISOString();
  const next: WorkMasterRow = {
    ...existing,
    ...input.patch,
    cid,
    slug: existing.slug || cid,
    package_image: packageImage,
    published,
    manual_hidden: Boolean(manualHidden),
    manual_hidden_reason:
      input.patch.manual_hidden_reason !== undefined
        ? input.patch.manual_hidden_reason
        : existing.manual_hidden_reason,
    updated_at: now,
  };

  upsertWorksCmsOverrides([
    {
      cid,
      manual_hidden: next.manual_hidden,
      manual_hidden_reason: next.manual_hidden_reason,
    },
  ]);
  await supabaseUpsertWorkMasterRows([next]);

  await revalidateWorksMasterAfterAdd();
  return { ok: true, published };
}

export type { FanzaTvStatusValue };
