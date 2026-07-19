import "server-only";

import {
  commitCatalogShardAppendToGitHub,
  fetchCatalogShardsFromGitHub,
  type CommitCatalogShardsResult,
} from "@/lib/admin/github-catalog-shards";
import { GitHubCatalogError } from "@/lib/admin/github-catalog";
import { getGitHubConfig } from "@/lib/admin/github-config";
import { normalizeImportContentId } from "@/lib/admin/import-candidate-mapper";
import {
  ADD_API_MAX_WORKS,
  ADD_BATCH_MIN_SIZE,
  IMPORT_SIMPLE_ADD_MAX_RETRIES,
} from "@/lib/admin/import-constants";
import {
  AddSelectedWorksFailure,
  type AddSelectedWorksErrorDetails,
  type AddSelectedWorksPhase,
} from "@/lib/admin/add-selected-works-types";
import {
  buildCatalogIdSet,
  workMatchesCatalogIds,
} from "@/lib/dmm/catalog-dedupe";
import type {
  AddSelectedWorkInput,
  AddSelectedWorksSummary,
} from "@/lib/admin/import-simple-types";
import { normalizeCatalogContentId } from "@/lib/dmm/catalog-snapshot";
import { logCatalogSnapshotThrownError } from "@/lib/dmm/catalog-snapshot-json";
import type { IndexUpdateStats } from "@/lib/dmm/index-builders";
import { isImportCandidateMetadataValid } from "@/lib/dmm/filter";
import { enrichCatalogItemMetadata } from "@/lib/dmm/catalog-metadata";
import type { AdultImageStatus } from "@/lib/works/image-status-shared";
import {
  appendWorksToCatalogShards,
  clearCatalogShardCache,
  getAllCatalogWorks,
  getCatalogManifest,
  getCatalogShard,
  serializeCatalogShardJson,
  shardRelativePath,
  writeCatalogShardsLocally,
  type CatalogManifest,
} from "@/lib/dmm/catalog-shards";
import type { DmmItem } from "@/lib/dmm/types";
import { pickPackageImageCandidate } from "@/lib/works/package-image";

export class AddSelectedWorksError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AddSelectedWorksError";
    this.status = status;
  }
}

export type AddSelectedWorksOptions = {
  /** バッチ処理時は false。サイトマップはクライアントが最後に1回呼ぶ */
  updateSitemap?: boolean;
};

export type AddSelectedWorksResult = {
  summary: AddSelectedWorksSummary;
  addedContentIds: string[];
  indexUpdateStats: IndexUpdateStats | null;
  committedToGitHub: boolean;
  message: string;
  sitemap?: import("@/lib/admin/seo-types").SitemapPostImportResult;
};

type CatalogState = {
  manifest: CatalogManifest;
  items: DmmItem[];
  catalogKeys: Set<string>;
  lastShardWorks: DmmItem[];
};

type ShardCommitOutcome = {
  addedContentIds: string[];
  catalogCountAfter: number;
  updatedShardFiles: string[];
  newShardFiles: string[];
  committedToGitHub: boolean;
  commitCount: number;
};

function logPhase(
  phase: AddSelectedWorksPhase,
  data: Record<string, unknown>,
): void {
  console.log(`[add-selected-api] ${phase}`, data);
}

function fail(
  phase: AddSelectedWorksPhase,
  message: string,
  status = 500,
  details?: AddSelectedWorksErrorDetails,
): never {
  console.error("[add-selected-api] failed", {
    phase,
    message,
    status,
    details,
  });
  throw new AddSelectedWorksFailure(phase, message, status, details);
}

function isGithubPayloadTooLarge(error: unknown): boolean {
  if (!(error instanceof GitHubCatalogError)) return false;
  if (error.status !== 422) return false;
  const message = `${error.githubMessage ?? ""} ${error.message}`.toLowerCase();
  return message.includes("too large");
}

function prepareCatalogItem(
  item: DmmItem,
  contentId: string,
  metadata?: {
    sourcePopularityRank?: number | null;
    fanzaNewRank?: number | null;
  },
): DmmItem {
  const normalizedId = normalizeCatalogContentId(contentId);

  if (!normalizedId) {
    throw new AddSelectedWorksError("content_id が不正です。");
  }

  if (normalizeCatalogContentId(item.content_id) !== normalizedId) {
    throw new AddSelectedWorksError("content_id と作品データが一致しません。");
  }

  // 画像なし / NOW PRINTING も手動追加可（公開は upsert 側で制御）
  if (!isImportCandidateMetadataValid(item)) {
    throw new AddSelectedWorksError(
      "作品データがカタログ追加条件を満たしていません。",
    );
  }

  return enrichCatalogItemMetadata(
    {
      ...item,
      content_id: normalizedId,
      product_id: item.product_id?.trim() || normalizedId,
    },
    {
      sourcePopularityRank: metadata?.sourcePopularityRank,
      fanzaNewRank: metadata?.fanzaNewRank,
    },
  );
}

function parseWorkEntries(entries: unknown): AddSelectedWorkInput[] {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new AddSelectedWorksError("追加する作品が選択されていません。");
  }

  return entries.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new AddSelectedWorksError(`作品データ(${index + 1}件目)が不正です。`);
    }

    const record = entry as {
      contentId?: string;
      item?: DmmItem;
      sourcePopularityRank?: number | null;
      fanzaNewRank?: number | null;
      imageStatus?: string | null;
      imageStatusCheckedAt?: string | null;
      packageImage?: string | null;
    };

    const contentId = record.contentId?.trim();
    const item = record.item;

    if (!contentId || !item || typeof item !== "object") {
      throw new AddSelectedWorksError(`作品データ(${index + 1}件目)が不正です。`);
    }

    const imageStatusRaw = String(record.imageStatus ?? "").trim();
    const imageStatus: AdultImageStatus | null =
      imageStatusRaw === "ok" ||
      imageStatusRaw === "now_printing" ||
      imageStatusRaw === "fetch_failed"
        ? imageStatusRaw
        : null;

    return {
      contentId,
      item,
      sourcePopularityRank: record.sourcePopularityRank ?? null,
      fanzaNewRank: record.fanzaNewRank ?? null,
      imageStatus,
      imageStatusCheckedAt:
        typeof record.imageStatusCheckedAt === "string"
          ? record.imageStatusCheckedAt
          : null,
      packageImage:
        record.packageImage === undefined
          ? undefined
          : record.packageImage == null
            ? null
            : String(record.packageImage),
    };
  });
}

export function parseAddSelectedWorksRequest(body: unknown): {
  works: AddSelectedWorkInput[];
  updateSitemap: boolean;
} {
  if (!body || typeof body !== "object") {
    throw new AddSelectedWorksError("リクエスト形式が不正です。");
  }

  const payload = body as { works?: unknown; updateSitemap?: unknown };
  const works = parseWorkEntries(payload.works);

  if (works.length > ADD_API_MAX_WORKS) {
    throw new AddSelectedWorksError(
      `1回のAPIで追加できるのは${ADD_API_MAX_WORKS}件までです。クライアント側で分割してください。`,
    );
  }

  return {
    works,
    updateSitemap: payload.updateSitemap === true,
  };
}

function classifySelectedWorks(
  works: AddSelectedWorkInput[],
  catalogKeys: Set<string>,
): {
  preparedItems: DmmItem[];
  addedContentIds: string[];
  catalogDuplicateContentIds: string[];
  selectionDuplicateContentIds: string[];
  invalidContentIds: string[];
  imageMissingContentIds: string[];
} {
  const preparedItems: DmmItem[] = [];
  const addedContentIds: string[] = [];
  const catalogDuplicateContentIds: string[] = [];
  const selectionDuplicateContentIds: string[] = [];
  const invalidContentIds: string[] = [];
  const imageMissingContentIds: string[] = [];
  const batchKeys = new Set<string>();

  for (const work of works) {
    const normalizedId = normalizeCatalogContentId(work.contentId);

    if (workMatchesCatalogIds(work.item, catalogKeys)) {
      catalogDuplicateContentIds.push(normalizedId || work.contentId);
      continue;
    }

    if (workMatchesCatalogIds(work.item, batchKeys)) {
      selectionDuplicateContentIds.push(normalizedId || work.contentId);
      continue;
    }

    // 事前判定ありなら URL なしでも追加可。未判定かつ URL なしのみ除外
    const hasPrechecked = Boolean(work.imageStatus);
    if (!pickPackageImageCandidate(work.item) && !hasPrechecked) {
      imageMissingContentIds.push(normalizedId || work.contentId);
      continue;
    }

    try {
      const prepared = prepareCatalogItem(work.item, work.contentId, {
        sourcePopularityRank: work.sourcePopularityRank,
        fanzaNewRank: work.fanzaNewRank,
      });

      if (!pickPackageImageCandidate(prepared) && !hasPrechecked) {
        imageMissingContentIds.push(normalizedId || work.contentId);
        continue;
      }

      for (const key of buildCatalogIdSet([prepared])) {
        batchKeys.add(key);
      }

      preparedItems.push(prepared);
      addedContentIds.push(prepared.content_id);
    } catch (error) {
      invalidContentIds.push(
        normalizeImportContentId(work.contentId) || work.contentId,
      );
      console.warn("[add-selected-api] invalid work", {
        contentId: work.contentId,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    preparedItems,
    addedContentIds,
    catalogDuplicateContentIds,
    selectionDuplicateContentIds,
    invalidContentIds,
    imageMissingContentIds,
  };
}

function buildCommitMessage(addedCount: number): string {
  if (addedCount <= 0) return "chore(catalog-staging): add works from admin import";
  return `chore(catalog-staging): add ${addedCount} works from admin import`;
}

function buildResultMessage(input: {
  summary: AddSelectedWorksSummary;
  committedToGitHub: boolean;
  sitemap?: AddSelectedWorksResult["sitemap"];
}): string {
  const { summary, committedToGitHub, sitemap } = input;

  if (summary.addedCount === 0) {
    if (
      summary.catalogDuplicateCount > 0 &&
      summary.selectionDuplicateCount === 0 &&
      summary.invalidCount === 0
    ) {
      return "選択した作品はすべて掲載済みでした。";
    }

    return [
      "追加できる作品がありませんでした。",
      summary.catalogDuplicateCount > 0
        ? `追加直前に掲載済み：${summary.catalogDuplicateCount}件`
        : null,
      summary.selectionDuplicateCount > 0
        ? `選択内重複：${summary.selectionDuplicateCount}件`
        : null,
      (summary.imageMissingExcludedCount ?? 0) > 0
        ? `画像なし除外：${summary.imageMissingExcludedCount}件`
        : null,
      summary.invalidCount > 0 ? `無効：${summary.invalidCount}件` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (summary.worksMasterUpserted) {
    const storageLabel = summary.storageLabel ?? "Supabase";
    const publishedLabel =
      summary.publishedStatus === "draft" ? "下書き" : "公開済み";
    return [
      "作品追加完了",
      `保存先：${storageLabel}`,
      publishedLabel,
      `${summary.addedCount}件を作品マスターへ保存しました。`,
      summary.usedJsonFallback
        ? "※ Supabase障害のためローカルJSONへフォールバックしました。"
        : "Git更新・カタログJSON更新・commit・push・Vercelデプロイは行っていません。",
      typeof summary.supabaseSavedCount === "number"
        ? `Supabase保存：${summary.supabaseSavedCount}件`
        : null,
      typeof summary.jsonFallbackCount === "number"
        ? `JSONフォールバック：${summary.jsonFallbackCount}件`
        : null,
      `受信：${summary.selectedCount}件`,
      `掲載済み除外：${summary.catalogDuplicateCount}件`,
      summary.selectionDuplicateCount > 0
        ? `選択内重複：${summary.selectionDuplicateCount}件`
        : null,
      (summary.imageMissingExcludedCount ?? 0) > 0
        ? `画像なし除外：${summary.imageMissingExcludedCount}件`
        : null,
      `無効：${summary.invalidCount}件`,
      `追加成功：${summary.addedCount}件`,
      typeof summary.catalogCountAfter === "number"
        ? `マスター件数：${summary.catalogCountAfter.toLocaleString()}件`
        : null,
    ]
      .filter(Boolean)
      .join("\n");
  }

  const lines = [
    `${summary.addedCount}件を作業用データへ追加しました。`,
    "本番サイトにはまだ反映されていません。",
    "続けて作品を追加するか、最後に『本番反映・デプロイ』を実行してください。",
    `受信：${summary.selectedCount}件`,
    `掲載済み除外：${summary.catalogDuplicateCount}件`,
    summary.selectionDuplicateCount > 0
      ? `選択内重複：${summary.selectionDuplicateCount}件`
      : null,
    `無効：${summary.invalidCount}件`,
    `追加成功：${summary.addedCount}件`,
    summary.updatedShardFiles && summary.updatedShardFiles.length > 0
      ? `更新shard：${summary.updatedShardFiles.join(", ")}`
      : null,
    summary.newShardFiles && summary.newShardFiles.length > 0
      ? `新規shard：${summary.newShardFiles.join(", ")}`
      : null,
    typeof summary.catalogCountAfter === "number"
      ? `総作品数：${summary.catalogCountAfter.toLocaleString()}件`
      : null,
  ].filter(Boolean) as string[];

  if (committedToGitHub || summary.githubCommitSucceeded) {
    lines.push("作業用ブランチへ保存：成功");
  }

  void sitemap;

  return lines.join("\n");
}

async function loadCatalogKeysIncludingWorksMaster(
  localMode: boolean,
): Promise<{ catalogKeys: Set<string>; catalogCount: number }> {
  const catalogState = await loadCatalogState(localMode);
  const catalogKeys = new Set(catalogState.catalogKeys);
  try {
    const { getWorksMasterContentIdSet } = await import(
      "@/lib/dmm/works-master"
    );
    for (const cid of await getWorksMasterContentIdSet()) {
      catalogKeys.add(cid);
    }
  } catch (error) {
    console.warn("[add-selected-api] works-master keys skipped", error);
  }
  return {
    catalogKeys,
    catalogCount: catalogKeys.size,
  };
}

async function addSelectedWorksToWorksMaster(
  works: AddSelectedWorkInput[],
): Promise<AddSelectedWorksResult> {
  const startedAt = Date.now();
  const selectedCount = works.length;
  const localMode = shouldWriteLocally();

  const {
    getConfiguredWorksMasterBackend,
    getWorksMasterStorageInfo,
    getWorksMasterStorageLabel,
    upsertWorksMasterFromDmmItems,
    revalidateWorksMasterAfterAdd,
  } = await import("@/lib/dmm/works-master");

  const backend = getConfiguredWorksMasterBackend();
  if (backend === "off") {
    fail(
      "validate-request",
      "作品マスターが無効です。WORKS_MASTER_ENABLED を確認してください。",
      500,
    );
  }

  logPhase("received", {
    receivedCount: selectedCount,
    storage: "works-master",
    backend,
    apiMax: ADD_API_MAX_WORKS,
  });

  const { catalogKeys, catalogCount } =
    await loadCatalogKeysIncludingWorksMaster(localMode);

  logPhase("fetch-catalog", {
    catalogCount,
    storage: "works-master",
    backend,
  });

  const classified = classifySelectedWorks(works, catalogKeys);
  const catalogDuplicateCount = classified.catalogDuplicateContentIds.length;
  const selectionDuplicateCount =
    classified.selectionDuplicateContentIds.length;
  const invalidCount = classified.invalidContentIds.length;
  const imageMissingExcludedCount = classified.imageMissingContentIds.length;

  logPhase("deduplicate", {
    receivedCount: selectedCount,
    catalogDuplicateCount,
    selectionDuplicateCount,
    invalidCount,
    imageMissingExcludedCount,
    validAddCount: classified.preparedItems.length,
  });

  if (classified.preparedItems.length === 0) {
    const summary: AddSelectedWorksSummary = {
      selectedCount,
      addedCount: 0,
      catalogDuplicateCount,
      selectionDuplicateCount,
      invalidCount,
      imageMissingExcludedCount,
      retried: false,
      catalogCountAfter: catalogCount,
      githubCommitSucceeded: false,
      storageTarget: backend === "supabase" ? "supabase" : "local",
      storageLabel: getWorksMasterStorageLabel(backend),
      publishedStatus: "published",
      worksMasterUpserted: true,
      usedJsonFallback: false,
      supabaseSavedCount: 0,
      jsonFallbackCount: 0,
    };
    return {
      summary,
      addedContentIds: [],
      indexUpdateStats: null,
      committedToGitHub: false,
      message: buildResultMessage({
        summary,
        committedToGitHub: false,
      }),
    };
  }

  const precheckedByCid: Record<
    string,
    {
      status: AdultImageStatus;
      checkedAt: string;
      packageImage?: string | null;
    }
  > = {};
  for (const work of works) {
    const cid = normalizeCatalogContentId(work.contentId);
    if (!cid || !work.imageStatus) continue;
    precheckedByCid[cid] = {
      status: work.imageStatus,
      checkedAt: work.imageStatusCheckedAt || new Date().toISOString(),
      packageImage:
        work.packageImage !== undefined
          ? work.packageImage
          : pickPackageImageCandidate(work.item),
    };
  }

  const upsertResult = await upsertWorksMasterFromDmmItems(
    classified.preparedItems,
    { published: true, precheckedByCid },
  );

  // 変動情報も同時に UPSERT（Git/JSONなし）
  try {
    const { upsertLiveStatusFromWorks } = await import(
      "@/lib/dmm/work-live-status"
    );
    await upsertLiveStatusFromWorks(classified.preparedItems);
  } catch (error) {
    console.warn("[add-selected-api] live status upsert skipped", error);
  }

  const {
    upserted,
    published,
    backend: writeBackend,
    usedJsonFallback,
    supabaseSavedCount,
    jsonFallbackCount,
  } = upsertResult;

  // Git / catalog JSON / commit / push / deploy は行わない。タグのみ再検証。
  // （JSON フォールバック時のみローカル works-master.json を更新）
  await revalidateWorksMasterAfterAdd();

  try {
    const { recordWorksAddOffset } = await import(
      "@/lib/admin/works-add-offset-store"
    );
    recordWorksAddOffset({
      sort: "new",
      offset: 0,
      addedCount: upserted,
      duplicateCount: catalogDuplicateCount + selectionDuplicateCount,
      errorCount: invalidCount,
      lastAddedCid: classified.preparedItems[0]?.content_id ?? null,
    });
  } catch {
    // offset は差分準備用。失敗しても追加自体は成功扱い
  }

  const storageInfo = await getWorksMasterStorageInfo();
  const summary: AddSelectedWorksSummary = {
    selectedCount,
    addedCount: upserted,
    catalogDuplicateCount,
    selectionDuplicateCount,
    invalidCount,
    imageMissingExcludedCount,
    retried: false,
    catalogCountAfter: storageInfo.rowCount ?? undefined,
    githubCommitSucceeded: false,
    storageTarget: writeBackend === "supabase" ? "supabase" : "local",
    storageLabel: getWorksMasterStorageLabel(writeBackend),
    publishedStatus: published ? "published" : "draft",
    worksMasterUpserted: true,
    usedJsonFallback,
    supabaseSavedCount,
    jsonFallbackCount,
  };

  logPhase("complete", {
    addedCount: upserted,
    storage: summary.storageLabel,
    backend: writeBackend,
    usedJsonFallback,
    supabaseSavedCount,
    jsonFallbackCount,
    elapsedMs: Date.now() - startedAt,
    gitDiff: false,
    deploy: false,
  });

  if (upserted > 0) {
    const { noteCatalogWorkActivity } = await import(
      "@/lib/admin/catalog-promote"
    );
    noteCatalogWorkActivity({ addedCount: upserted });
  }

  return {
    summary,
    addedContentIds: classified.preparedItems
      .slice(0, upserted)
      .map((item) => item.content_id),
    indexUpdateStats: null,
    committedToGitHub: false,
    message: buildResultMessage({
      summary,
      committedToGitHub: false,
    }),
  };
}

function shouldWriteLocally(): boolean {
  if (process.env.CATALOG_ADD_LOCAL === "1") return true;
  return !getGitHubConfig();
}

function loadLocalCatalogState(): CatalogState {
  const manifest = getCatalogManifest();
  if (!manifest) {
    throw new AddSelectedWorksError(
      "ローカル catalog shard（manifest.json）が見つかりません。先に移行してください。",
      500,
    );
  }

  const items = getAllCatalogWorks();
  const lastMeta = manifest.shards[manifest.shards.length - 1];
  const lastShardWorks = lastMeta ? getCatalogShard(lastMeta.file) : [];

  return {
    manifest,
    items,
    catalogKeys: buildCatalogIdSet(items),
    lastShardWorks,
  };
}

async function loadCatalogState(localMode: boolean): Promise<CatalogState> {
  return localMode
    ? loadLocalCatalogState()
    : await fetchCatalogShardsFromGitHub();
}

function logCatalogBlobPlan(input: {
  selectedCount: number;
  validAddCount: number;
  catalogCountBefore: number;
  catalogCountAfter: number;
  files: Array<{ path: string; bytes: number }>;
}): void {
  console.log("[catalog-blob]", {
    selectedCount: input.selectedCount,
    validAddCount: input.validAddCount,
    catalogCountBefore: input.catalogCountBefore,
    catalogCountAfter: input.catalogCountAfter,
    files: input.files,
    maxBlobBytes: Math.max(0, ...input.files.map((file) => file.bytes)),
    note: "request payload bytes are logged separately by the route; these are GitHub blob sizes",
  });
}

async function commitPreparedItemsOnce(input: {
  itemsToAdd: DmmItem[];
  localMode: boolean;
  selectedCount: number;
}): Promise<ShardCommitOutcome> {
  const preCommitState = await loadCatalogState(input.localMode);
  const itemsToAdd = input.itemsToAdd.filter(
    (item) => !workMatchesCatalogIds(item, preCommitState.catalogKeys),
  );

  if (itemsToAdd.length === 0) {
    return {
      addedContentIds: [],
      catalogCountAfter: preCommitState.manifest.totalCount,
      updatedShardFiles: [],
      newShardFiles: [],
      committedToGitHub: false,
      commitCount: 0,
    };
  }

  const append = appendWorksToCatalogShards(
    preCommitState.manifest,
    preCommitState.lastShardWorks,
    itemsToAdd,
  );

  const filePlans = [
    {
      path: "data/dmm/catalog/manifest.json",
      bytes: Buffer.byteLength(
        serializeCatalogShardJson(append.manifest),
        "utf8",
      ),
    },
    ...append.changedShards.map((shard) => ({
      path: shardRelativePath(shard.file),
      bytes: Buffer.byteLength(serializeCatalogShardJson(shard.works), "utf8"),
    })),
  ];

  logCatalogBlobPlan({
    selectedCount: input.selectedCount,
    validAddCount: itemsToAdd.length,
    catalogCountBefore: preCommitState.manifest.totalCount,
    catalogCountAfter: append.manifest.totalCount,
    files: filePlans,
  });

  if (input.localMode) {
    writeCatalogShardsLocally(
      append.manifest,
      append.changedShards.map((shard) => ({
        file: shard.file,
        works: shard.works,
      })),
    );
    clearCatalogShardCache();
    try {
      const { clearEntityRankingCache } = await import(
        "@/lib/ranking/entity-ranking-service"
      );
      clearEntityRankingCache();
    } catch {
      // ignore
    }
    return {
      addedContentIds: itemsToAdd.map((item) => item.content_id),
      catalogCountAfter: append.manifest.totalCount,
      updatedShardFiles: append.updatedShardFiles,
      newShardFiles: append.newShardFiles,
      committedToGitHub: false,
      commitCount: 1,
    };
  }

  const commitResult: CommitCatalogShardsResult =
    await commitCatalogShardAppendToGitHub({
      manifest: preCommitState.manifest,
      lastShardWorks: preCommitState.lastShardWorks,
      newWorks: itemsToAdd,
      commitLabel: buildCommitMessage(itemsToAdd.length),
      // 変更 shard + manifest のみ。巨大 index は書かない
      indexFiles: [],
    });

  clearCatalogShardCache();

  return {
    addedContentIds: itemsToAdd.map((item) => item.content_id),
    catalogCountAfter: commitResult.totalCount,
    updatedShardFiles: commitResult.append.updatedShardFiles,
    newShardFiles: commitResult.append.newShardFiles,
    committedToGitHub: true,
    commitCount: 1,
  };
}

async function commitPreparedItemsAdaptive(input: {
  itemsToAdd: DmmItem[];
  localMode: boolean;
  selectedCount: number;
}): Promise<ShardCommitOutcome> {
  try {
    return await commitPreparedItemsOnce(input);
  } catch (error) {
    if (
      !input.localMode &&
      isGithubPayloadTooLarge(error) &&
      input.itemsToAdd.length > ADD_BATCH_MIN_SIZE
    ) {
      const middle = Math.ceil(input.itemsToAdd.length / 2);
      console.warn("[add-selected-api] adaptive split after 422", {
        from: input.itemsToAdd.length,
        first: middle,
        second: input.itemsToAdd.length - middle,
      });

      const first = await commitPreparedItemsAdaptive({
        itemsToAdd: input.itemsToAdd.slice(0, middle),
        localMode: input.localMode,
        selectedCount: input.selectedCount,
      });
      const second = await commitPreparedItemsAdaptive({
        itemsToAdd: input.itemsToAdd.slice(middle),
        localMode: input.localMode,
        selectedCount: input.selectedCount,
      });

      return {
        addedContentIds: [...first.addedContentIds, ...second.addedContentIds],
        catalogCountAfter: second.catalogCountAfter || first.catalogCountAfter,
        updatedShardFiles: [
          ...new Set([...first.updatedShardFiles, ...second.updatedShardFiles]),
        ],
        newShardFiles: [
          ...new Set([...first.newShardFiles, ...second.newShardFiles]),
        ],
        committedToGitHub:
          first.committedToGitHub || second.committedToGitHub,
        commitCount: first.commitCount + second.commitCount,
      };
    }

    throw error;
  }
}

export async function addSelectedWorksToCatalog(
  works: AddSelectedWorkInput[],
  options: AddSelectedWorksOptions = {},
): Promise<AddSelectedWorksResult> {
  // 第4段階: 作品マスター（Supabase / ローカル）へ直接保存。Git・JSON・デプロイなし。
  try {
    const { getConfiguredWorksMasterBackend } = await import(
      "@/lib/dmm/works-master"
    );
    if (getConfiguredWorksMasterBackend() !== "off") {
      return await addSelectedWorksToWorksMaster(works);
    }
  } catch (error) {
    if (error instanceof AddSelectedWorksFailure) throw error;
    if (error instanceof AddSelectedWorksError) throw error;
    console.warn(
      "[add-selected-api] works-master path unavailable; falling back to Git catalog",
      error,
    );
  }

  const startedAt = Date.now();
  const selectedCount = works.length;
  const updateSitemap = options.updateSitemap === true;
  let retryCount = 0;
  let retried = false;
  const localMode = shouldWriteLocally();

  logPhase("received", {
    receivedCount: selectedCount,
    localMode,
    updateSitemap,
    apiMax: ADD_API_MAX_WORKS,
  });

  let catalogDuplicateCount = 0;
  let selectionDuplicateCount = 0;
  let invalidCount = 0;
  let imageMissingExcludedCount = 0;
  let addedContentIds: string[] = [];
  let committedToGitHub = false;
  let validAddCount = 0;
  let finalCatalogCount = 0;
  let updatedShardFiles: string[] = [];
  let newShardFiles: string[] = [];
  let commitCount = 0;

  while (retryCount <= IMPORT_SIMPLE_ADD_MAX_RETRIES) {
    let catalogCountBefore = 0;

    try {
      console.time("[add-selected-api] fetch-catalog");
      const catalogState = await loadCatalogState(localMode);
      console.timeEnd("[add-selected-api] fetch-catalog");

      catalogCountBefore = catalogState.items.length;
      logPhase("fetch-catalog", {
        catalogCount: catalogState.items.length,
        shardCount: catalogState.manifest.shards.length,
        retryCount,
        localMode,
      });

      const classified = classifySelectedWorks(works, catalogState.catalogKeys);

      catalogDuplicateCount = classified.catalogDuplicateContentIds.length;
      selectionDuplicateCount = classified.selectionDuplicateContentIds.length;
      invalidCount = classified.invalidContentIds.length;
      imageMissingExcludedCount = classified.imageMissingContentIds.length;
      validAddCount = classified.preparedItems.length;

      logPhase("deduplicate", {
        receivedCount: selectedCount,
        catalogDuplicateCount,
        selectionDuplicateCount,
        invalidCount,
        imageMissingExcludedCount,
        validAddCount: classified.preparedItems.length,
      });

      if (classified.preparedItems.length === 0) {
        const summary: AddSelectedWorksSummary = {
          selectedCount,
          addedCount: 0,
          catalogDuplicateCount,
          selectionDuplicateCount,
          invalidCount,
          imageMissingExcludedCount,
          retried,
          catalogCountAfter: catalogState.items.length,
          githubCommitSucceeded: false,
        };

        return {
          summary,
          addedContentIds: [],
          indexUpdateStats: null,
          committedToGitHub: false,
          message: buildResultMessage({
            summary,
            committedToGitHub: false,
          }),
        };
      }

      console.time("[add-selected-api] github-commit");
      const outcome = await commitPreparedItemsAdaptive({
        itemsToAdd: classified.preparedItems,
        localMode,
        selectedCount,
      });
      console.timeEnd("[add-selected-api] github-commit");

      addedContentIds = outcome.addedContentIds;
      validAddCount = outcome.addedContentIds.length;
      finalCatalogCount = outcome.catalogCountAfter;
      updatedShardFiles = outcome.updatedShardFiles;
      newShardFiles = outcome.newShardFiles;
      committedToGitHub = outcome.committedToGitHub;
      commitCount = outcome.commitCount;

      // 追加直前の再判定で全件スキップされた場合
      if (outcome.addedContentIds.length === 0) {
        catalogDuplicateCount += classified.preparedItems.length;
      }

      logPhase("complete", {
        addedCount: outcome.addedContentIds.length,
        catalogCountAfter: finalCatalogCount,
        updatedShardFiles,
        newShardFiles,
        commitCount,
        elapsedMs: Date.now() - startedAt,
        retryCount,
        localMode,
      });
      break;
    } catch (error) {
      if (
        !localMode &&
        error instanceof GitHubCatalogError &&
        (error.status === 409 ||
          (error.status === 422 && error.phase === "update-ref")) &&
        retryCount < IMPORT_SIMPLE_ADD_MAX_RETRIES
      ) {
        retryCount += 1;
        retried = true;
        console.warn("[add-selected-api] retry after github conflict", {
          retryCount,
          status: error.status,
          githubMessage: error.githubMessage,
        });
        continue;
      }

      if (isGithubPayloadTooLarge(error)) {
        fail(
          "github-commit",
          "変更shardの保存に失敗しました。巨大catalogへの書き戻しは行いません。",
          422,
          {
            status:
              error instanceof GitHubCatalogError ? error.status : 422,
            githubMessage:
              error instanceof GitHubCatalogError
                ? error.githubMessage
                : undefined,
            githubDocumentationUrl:
              error instanceof GitHubCatalogError
                ? error.documentationUrl
                : undefined,
            githubPhase: "create-catalog-blob",
            receivedCount: selectedCount,
            validAddCount,
            catalogCountBefore,
            elapsedMs: Date.now() - startedAt,
            retryCount,
          },
        );
      }

      logCatalogSnapshotThrownError(error);

      if (error instanceof AddSelectedWorksFailure) {
        throw error;
      }

      if (error instanceof GitHubCatalogError) {
        const githubPhase = error.phase ?? "github-commit";
        fail(
          githubPhase === "fetch-ref" || githubPhase === "fetch-commit"
            ? "fetch-catalog"
            : "github-commit",
          error.githubMessage
            ? `GitHubへのカタログ保存に失敗しました: ${error.message}`
            : "GitHubへのカタログ保存に失敗しました。作品は追加されていません。",
          error.status,
          {
            status: error.status,
            githubMessage: error.githubMessage,
            githubDocumentationUrl: error.documentationUrl,
            githubPhase: String(githubPhase),
            githubResponse: error.responseBody?.slice(0, 2000),
            receivedCount: selectedCount,
            validAddCount,
            catalogCountBefore,
            elapsedMs: Date.now() - startedAt,
            retryCount,
          },
        );
      }

      fail(
        "github-commit",
        "カタログの更新に失敗しました。追加は確定していません。",
        500,
        {
          receivedCount: selectedCount,
          validAddCount: validAddCount || addedContentIds.length,
          elapsedMs: Date.now() - startedAt,
          retryCount,
        },
      );
    }
  }

  if (!localMode && !committedToGitHub && addedContentIds.length > 0) {
    fail(
      "github-commit",
      "カタログ更新が競合しました。しばらく待ってから再度お試しください。",
      409,
      {
        receivedCount: selectedCount,
        validAddCount: addedContentIds.length,
        elapsedMs: Date.now() - startedAt,
        retryCount,
      },
    );
  }

  const summary: AddSelectedWorksSummary = {
    selectedCount,
    addedCount: addedContentIds.length,
    catalogDuplicateCount,
    selectionDuplicateCount,
    invalidCount,
    retried,
    catalogCountAfter: finalCatalogCount > 0 ? finalCatalogCount : undefined,
    updatedShardFiles,
    newShardFiles,
    githubCommitSucceeded: committedToGitHub || (localMode && commitCount > 0),
  };

  if (addedContentIds.length > 0) {
    const { noteCatalogWorkActivity } = await import(
      "@/lib/admin/catalog-promote"
    );
    noteCatalogWorkActivity({ addedCount: addedContentIds.length });
  }

  // サイトマップは本番反映時のみ。追加フローでは実行しない。
  const sitemap: AddSelectedWorksResult["sitemap"] = undefined;
  void updateSitemap;

  return {
    summary,
    addedContentIds,
    indexUpdateStats: null,
    committedToGitHub,
    sitemap,
    message: buildResultMessage({
      summary,
      committedToGitHub: committedToGitHub || localMode,
      sitemap,
    }),
  };
}

export function toAddSelectedWorksErrorMessage(error: unknown): {
  message: string;
  status: number;
  phase?: AddSelectedWorksPhase;
  details?: AddSelectedWorksErrorDetails;
} {
  if (error instanceof AddSelectedWorksFailure) {
    return {
      message: error.message,
      status: error.status,
      phase: error.phase,
      details: error.details,
    };
  }

  if (error instanceof AddSelectedWorksError) {
    return { message: error.message, status: error.status };
  }

  if (error instanceof GitHubCatalogError) {
    logCatalogSnapshotThrownError(error);
    return {
      message: error.message,
      status: error.status,
      phase: "github-commit",
      details: {
        status: error.status,
        githubMessage: error.githubMessage,
        githubDocumentationUrl: error.documentationUrl,
        githubPhase: error.phase,
        githubResponse: error.responseBody?.slice(0, 2000),
      },
    };
  }

  logCatalogSnapshotThrownError(error);
  console.error("[add-selected-api] unexpected error", error);

  return {
    message: "カタログの更新に失敗しました。追加は確定していません。",
    status: 500,
    phase: "github-commit",
  };
}
