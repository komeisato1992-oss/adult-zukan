import "server-only";

import { normalizeCatalogContentId } from "@/lib/dmm/catalog-snapshot";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import {
  computeWorksPublished,
  normalizeFanzaTvStatus,
  type FanzaTvStatusValue,
} from "@/lib/admin/works-cms-publish";
import {
  hasDisplayableAdultImage,
  isAdultImageStatusMissing,
} from "@/lib/works/image-status";
import { NO_PACKAGE_IMAGE_REASON } from "@/lib/admin/unpublish-no-image-works";
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
  totalCount: number;
  publishedCount: number;
  unpublishedCount: number;
  noPackageImageCount: number;
  publishedNoImageCount: number;
  unavailableCount: number;
  manualHiddenCount: number;
  worksMasterCount: number;
  liveStatusCount: number;
  missingLiveCount: number;
  initRatePercent: number;
  liveInitComplete: boolean;
  lastWorkAddedAt: string | null;
  lastLightSyncAt: string | null;
  runningJobLabel: string | null;
  errorCount: number;
  tone: "ok" | "running" | "warn" | "error" | "unset";
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
  image_status: string | null;
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
  supabaseReady: boolean;
}): WorksCmsOverview["tone"] {
  if (!input.supabaseReady) return "unset";
  if (input.errorCount > 0) return "error";
  if (input.running) return "running";
  if (input.noPackageImageCount > 0) return "warn";
  return "ok";
}

type OverviewSqlStats = {
  totalCount: number;
  publishedCount: number;
  unpublishedCount: number;
  manualHiddenCount: number;
  noPackageImageCount: number;
  publishedNoImageCount: number;
  worksMasterCount: number;
  liveStatusCount: number;
  unavailableCount: number;
  missingLiveCount: number;
  fanzaTvAvailableCount: number;
  fanzaTvUnavailableCount: number;
  fanzaTvUncheckedCount: number;
  lastWorkAddedAt: string | null;
  fanzaTvLastCheckedAt: string | null;
};

const OVERVIEW_CACHE_TTL_MS = 5 * 60 * 1000;
let overviewCache: { at: number; value: WorksCmsOverview } | null = null;

/** 作品追加・掲載更新・公開管理などの更新後に呼ぶ */
export function invalidateWorksCmsOverviewCache(): void {
  overviewCache = null;
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function parseOverviewSqlStats(raw: unknown): OverviewSqlStats | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  return {
    totalCount: num(row.total_count),
    publishedCount: num(row.published_count),
    unpublishedCount: num(row.unpublished_count),
    manualHiddenCount: num(row.manual_hidden_count),
    noPackageImageCount: num(row.no_image_count),
    publishedNoImageCount: num(row.published_no_image_count),
    worksMasterCount: num(row.works_master_count ?? row.total_count),
    liveStatusCount: num(row.live_status_count),
    unavailableCount: num(row.unavailable_count),
    missingLiveCount: num(row.missing_live_count),
    fanzaTvAvailableCount: num(row.fanza_tv_available_count),
    fanzaTvUnavailableCount: num(row.fanza_tv_unavailable_count),
    fanzaTvUncheckedCount: num(row.fanza_tv_unchecked_count),
    lastWorkAddedAt:
      row.last_work_added_at == null ? null : String(row.last_work_added_at),
    fanzaTvLastCheckedAt:
      row.fanza_tv_last_checked_at == null
        ? null
        : String(row.fanza_tv_last_checked_at),
  };
}

/** 1回の RPC で集計。未適用時は並列 COUNT（全件スキャンしない）へフォールバック */
async function fetchOverviewSqlStats(
  client: NonNullable<ReturnType<typeof getSupabaseServiceClient>>,
): Promise<OverviewSqlStats> {
  const { data, error } = await client.rpc("works_cms_overview_stats");
  if (!error) {
    const parsed = parseOverviewSqlStats(data);
    if (parsed) return parsed;
  } else {
    console.warn(
      "[works-cms] overview RPC unavailable, using count fallback:",
      error.message,
    );
  }

  const noImageOr =
    "image_status.eq.now_printing,image_status.eq.fetch_failed,and(image_status.is.null,or(package_image.is.null,package_image.eq.))";

  const [
    totalRes,
    publishedRes,
    unpublishedRes,
    manualHiddenRes,
    noImageRes,
    publishedNoImageRes,
    liveRes,
    unavailableRes,
    tvAvailableRes,
    tvUnavailableRes,
    latestRes,
    tvCheckedRes,
  ] = await Promise.all([
    client.from("works").select("cid", { count: "exact", head: true }),
    client
      .from("works")
      .select("cid", { count: "exact", head: true })
      .eq("published", true),
    client
      .from("works")
      .select("cid", { count: "exact", head: true })
      .eq("published", false),
    client
      .from("works")
      .select("cid", { count: "exact", head: true })
      .eq("manual_hidden", true),
    client
      .from("works")
      .select("cid", { count: "exact", head: true })
      .or(noImageOr),
    client
      .from("works")
      .select("cid", { count: "exact", head: true })
      .eq("published", true)
      .or(noImageOr),
    client
      .from("work_live_status")
      .select("cid", { count: "exact", head: true }),
    client
      .from("work_live_status")
      .select("cid", { count: "exact", head: true })
      .eq("is_available", false),
    client
      .from("works")
      .select("cid", { count: "exact", head: true })
      .eq("fanza_tv_status", "available"),
    client
      .from("works")
      .select("cid", { count: "exact", head: true })
      .eq("fanza_tv_status", "unavailable"),
    client
      .from("works")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1),
    client
      .from("works")
      .select("fanza_tv_checked_at")
      .not("fanza_tv_checked_at", "is", null)
      .order("fanza_tv_checked_at", { ascending: false })
      .limit(1),
  ]);

  const totalCount = totalRes.count ?? 0;
  const liveStatusCount = liveRes.count ?? 0;
  const tvAvailable = tvAvailableRes.count ?? 0;
  const tvUnavailable = tvUnavailableRes.count ?? 0;

  return {
    totalCount,
    publishedCount: publishedRes.count ?? 0,
    unpublishedCount: unpublishedRes.count ?? 0,
    manualHiddenCount: manualHiddenRes.count ?? 0,
    noPackageImageCount: noImageRes.count ?? 0,
    publishedNoImageCount: publishedNoImageRes.count ?? 0,
    worksMasterCount: totalCount,
    liveStatusCount,
    unavailableCount: unavailableRes.count ?? 0,
    missingLiveCount: Math.max(0, totalCount - liveStatusCount),
    fanzaTvAvailableCount: tvAvailable,
    fanzaTvUnavailableCount: tvUnavailable,
    fanzaTvUncheckedCount: Math.max(
      0,
      totalCount - tvAvailable - tvUnavailable,
    ),
    lastWorkAddedAt: latestRes.data?.[0]?.created_at ?? null,
    fanzaTvLastCheckedAt: tvCheckedRes.data?.[0]?.fanza_tv_checked_at ?? null,
  };
}

export async function getWorksCmsOverview(options?: {
  force?: boolean;
}): Promise<WorksCmsOverview> {
  if (
    !options?.force &&
    overviewCache &&
    Date.now() - overviewCache.at < OVERVIEW_CACHE_TTL_MS
  ) {
    return overviewCache.value;
  }

  const schemaV2 = await detectWorksCmsSchemaV2();
  const client = getSupabaseServiceClient();
  const overrides = listWorksCmsOverrides();

  let stats: OverviewSqlStats = {
    totalCount: 0,
    publishedCount: 0,
    unpublishedCount: 0,
    manualHiddenCount: 0,
    noPackageImageCount: 0,
    publishedNoImageCount: 0,
    worksMasterCount: 0,
    liveStatusCount: 0,
    unavailableCount: 0,
    missingLiveCount: 0,
    fanzaTvAvailableCount: 0,
    fanzaTvUnavailableCount: 0,
    fanzaTvUncheckedCount: 0,
    lastWorkAddedAt: null,
    fanzaTvLastCheckedAt: null,
  };

  if (client) {
    stats = await fetchOverviewSqlStats(client);
  }

  // JSON override 由来の手動非公開・削除（DB 未反映分の補正）
  let manualHiddenCount = stats.manualHiddenCount;
  let unpublishedCount = stats.unpublishedCount;
  let fanzaErrorCount = 0;
  for (const ov of overrides) {
    if (ov.manual_hidden && !schemaV2) manualHiddenCount += 1;
    if (ov.deleted_at) unpublishedCount += 1;
    if (ov.fanza_tv_error) fanzaErrorCount += 1;
  }

  const sync = await getFanzaSyncStatus();
  const mig = readWorksMasterMigrationJob();
  const { loadLiveStatusInitSnapshot } = await import(
    "@/lib/admin/live-status-init-store"
  );
  const liveInitJob = loadLiveStatusInitSnapshot().currentJob;

  const worksMasterCount = stats.worksMasterCount;
  const liveStatusCount = stats.liveStatusCount;
  const missingLiveCount = stats.missingLiveCount;
  const initRatePercent =
    worksMasterCount <= 0
      ? 0
      : Math.min(
          100,
          Math.round((liveStatusCount / worksMasterCount) * 100),
        );
  const liveInitComplete =
    worksMasterCount > 0 && missingLiveCount === 0 && initRatePercent >= 100;

  const initRunning =
    liveInitJob?.status === "running" ||
    liveInitJob?.status === "pending" ||
    liveInitJob?.status === "waiting";
  const running =
    sync.currentJob?.status === "running" ||
    sync.currentJob?.status === "pending" ||
    mig.status === "running" ||
    initRunning;
  const runningJobLabel = running
    ? sync.currentJob?.status === "running" ||
      sync.currentJob?.status === "pending"
      ? `掲載更新 ${sync.currentJob.processedCount}/${sync.currentJob.targetCount}`
      : initRunning
        ? `変動情報初期化 ${liveStatusCount}/${worksMasterCount}`
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

  const supabaseReady = Boolean(client);
  const noPackageImageCount = stats.noPackageImageCount;
  const publishedNoImageCount = stats.publishedNoImageCount;

  const result: WorksCmsOverview = {
    totalCount: stats.totalCount,
    publishedCount: stats.publishedCount,
    unpublishedCount,
    noPackageImageCount,
    publishedNoImageCount,
    unavailableCount: stats.unavailableCount,
    manualHiddenCount,
    worksMasterCount,
    liveStatusCount,
    missingLiveCount,
    initRatePercent,
    liveInitComplete,
    lastWorkAddedAt: stats.lastWorkAddedAt,
    lastLightSyncAt,
    runningJobLabel,
    errorCount,
    tone: toneFromOverview({
      running,
      errorCount,
      noPackageImageCount: noPackageImageCount + publishedNoImageCount,
      supabaseReady,
    }),
    fanzaTv: {
      uncheckedCount: stats.fanzaTvUncheckedCount,
      activeCount: stats.fanzaTvAvailableCount,
      notAvailableCount: stats.fanzaTvUnavailableCount,
      unknownCount: 0,
      lastCheckedAt: stats.fanzaTvLastCheckedAt,
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

  overviewCache = { at: Date.now(), value: result };
  return result;
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

  const { detectWorksFanzaTvSchema } = await import(
    "@/lib/admin/fanza-tv-check-db"
  );
  const fanzaSchemaReady = await detectWorksFanzaTvSchema();

  let query = client
    .from("works")
    .select(
      "cid,slug,title,package_image,image_status,image_status_checked_at,maker,actresses,release_date,published,created_at,updated_at",
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

  const worksFanzaByCid = new Map<string, string | null>();
  if (fanzaSchemaReady && cids.length > 0) {
    const { data: fanzaRows } = await client
      .from("works")
      .select("cid,fanza_tv_status")
      .in("cid", cids);
    for (const raw of fanzaRows ?? []) {
      const cid = normalizeCatalogContentId(
        String((raw as { cid?: string }).cid ?? ""),
      );
      if (!cid) continue;
      const st = (raw as { fanza_tv_status?: string | null }).fanza_tv_status;
      worksFanzaByCid.set(cid, st == null ? null : String(st));
    }
  }

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
      image_status:
        raw.image_status == null ? null : String(raw.image_status),
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
        ov?.fanza_tv_status ??
        worksFanzaByCid.get(cid) ??
        live?.fanza_tv_status ??
        null,
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
  if (filter.noImage) {
    items = items.filter(
      (i) =>
        isAdultImageStatusMissing(i.image_status) ||
        !hasDisplayableAdultImage({
          imageStatus: i.image_status,
          packageImage: i.package_image,
        }),
    );
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
      if (filter.fanzaTv === "unchecked" || filter.fanzaTv === "unknown") {
        return !st || st === "unknown";
      }
      if (filter.fanzaTv === "active") return st === "available";
      if (filter.fanzaTv === "not_available") return st === "unavailable";
      return false;
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
}): Promise<{
  updated: number;
  skipped: Array<{ cid: string; reason: string }>;
}> {
  const client = getSupabaseServiceClient();
  if (!client) throw new Error("Supabase未設定");

  const cids = [
    ...new Set(
      input.cids
        .map((c) => normalizeCatalogContentId(c))
        .filter((c): c is string => Boolean(c)),
    ),
  ];
  if (cids.length === 0) return { updated: 0, skipped: [] };

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
  const skipped: Array<{ cid: string; reason: string }> = [];

  const masterUpserts: WorkMasterRow[] = [];
  const liveUpserts: WorkLiveStatusUpsertLoose[] = [];

  for (const cid of cids) {
    const master = masters.get(cid);
    if (!master) {
      skipped.push({ cid, reason: "作品マスターに存在しません" });
      continue;
    }
    const live = lives.get(cid);
    const ov = getWorksCmsOverride(cid) ?? { cid };

    let manualHidden = ov.manual_hidden === true;
    let deletedAt = ov.deleted_at ?? null;
    let isAvailable = live?.is_available !== false;
    let fanzaStatus = ov.fanza_tv_status ?? live?.fanza_tv_status ?? null;

    switch (input.action) {
      case "publish":
        if (
          !hasDisplayableAdultImage({
            imageStatus: master.image_status,
            packageImage: master.package_image,
          })
        ) {
          skipped.push({
            cid,
            reason: "パッケージ画像がないため公開できません",
          });
          continue;
        }
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
        try {
          await client
            .from("works")
            .update({
              fanza_tv_status: "unknown",
              fanza_tv_checked_at: null,
              fanza_tv_url: null,
              updated_at: now,
            })
            .eq("cid", cid);
        } catch {
          // schema v1 では列なし
        }
        break;
      default:
        break;
    }

    const published =
      input.action === "unpublish"
        ? false
        : computeWorksPublished({
            packageImage: master.package_image,
            imageStatus: master.image_status,
            isAvailable,
            manualHidden,
            deletedAt,
          });

    const hiddenReason =
      input.action === "manual_hide"
        ? input.reason ?? ov.manual_hidden_reason ?? "手動非公開"
        : !published &&
            !hasDisplayableAdultImage({
              imageStatus: master.image_status,
              packageImage: master.package_image,
            })
          ? NO_PACKAGE_IMAGE_REASON
          : manualHidden
            ? ov.manual_hidden_reason ?? null
            : published
              ? null
              : ov.manual_hidden_reason ?? null;

    overridePatches.push({
      cid,
      manual_hidden: manualHidden,
      manual_hidden_reason: hiddenReason,
      deleted_at: deletedAt,
      fanza_tv_status: normalizeFanzaTvStatus(fanzaStatus),
    });

    masterUpserts.push({
      ...master,
      published,
      manual_hidden: manualHidden,
      manual_hidden_reason: hiddenReason,
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

  return { updated: masterUpserts.length, skipped };
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

  let imageStatus = existing.image_status;
  let imageStatusCheckedAt = existing.image_status_checked_at;
  if (input.patch.package_image !== undefined) {
    const { detectAdultImageStatus } = await import(
      "@/lib/works/image-status"
    );
    const detected = await detectAdultImageStatus(packageImage);
    imageStatus = detected.status;
    imageStatusCheckedAt = detected.checkedAt;
  }

  const published = computeWorksPublished({
    packageImage,
    imageStatus,
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
    image_status: imageStatus,
    image_status_checked_at: imageStatusCheckedAt,
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
