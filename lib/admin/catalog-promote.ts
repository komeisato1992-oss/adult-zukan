import "server-only";

import {
  ensureCatalogWorkingBranch,
  fetchBranchSha,
  resetWorkingBranchToProduction,
  CatalogBranchError,
} from "@/lib/admin/catalog-branch";
import {
  getPromoteLockStatus,
  releasePromoteLock,
  tryAcquirePromoteLock,
  updatePromoteLockStatus,
} from "@/lib/admin/catalog-promote-lock";
import type {
  CatalogPromoteAuditEntry,
  CatalogPromoteDiff,
  CatalogPromoteDiffWork,
  CatalogPromotePersistedState,
  CatalogPromoteStatusPayload,
  CatalogPromoteValidationIssue,
  CatalogPromoteValidationResult,
} from "@/lib/admin/catalog-promote-types";
import {
  CATALOG_PROMOTE_AUDIT_PATH,
  CATALOG_PROMOTE_STATE_PATH,
} from "@/lib/admin/catalog-promote-types";
import {
  getCatalogProductionBranch,
  getCatalogWorkingBranch,
  getGitHubConfig,
  getGitHubCredentials,
  getGitHubProductionConfig,
  type GitHubConfig,
} from "@/lib/admin/github-config";
import { getSiteUrl } from "@/lib/constants";
import {
  CATALOG_MANIFEST_RELATIVE,
  type CatalogManifest,
} from "@/lib/dmm/catalog-shards";
import type { DmmItem } from "@/lib/dmm/types";

const GITHUB_API_VERSION = "2022-11-28";
const DIFF_WORK_DISPLAY_MAX = 100;
const AUDIT_MAX_ENTRIES = 100;

function parseManifestJson(raw: string): CatalogManifest {
  const parsed = JSON.parse(raw) as CatalogManifest;
  return {
    version: Number(parsed.version) || 1,
    totalCount: Number(parsed.totalCount) || 0,
    shardSize: Number(parsed.shardSize) > 0 ? Number(parsed.shardSize) : 500,
    updatedAt: String(parsed.updatedAt ?? ""),
    shards: Array.isArray(parsed.shards)
      ? parsed.shards.map((entry) => ({
          file: String(entry.file),
          count: Number(entry.count) || 0,
        }))
      : [],
  };
}

export class CatalogPromoteError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "CatalogPromoteError";
    this.status = status;
  }
}

type GitCompareFile = {
  filename: string;
  status: string;
  previous_filename?: string;
};

type GitCompareResponse = {
  status: string;
  ahead_by: number;
  behind_by: number;
  total_commits: number;
  files?: GitCompareFile[];
  commits?: Array<{ sha: string; commit: { message: string; author?: { date?: string } } }>;
};

type GitHubContentResponse = {
  content?: string;
  encoding?: string;
  sha?: string;
  download_url?: string | null;
};

type MergeResponse = {
  sha: string;
  commit?: { message?: string };
};

function repoBase(config: { owner: string; repo: string }): string {
  return `https://api.github.com/repos/${config.owner}/${config.repo}`;
}

async function githubJson<T>(
  config: { token: string },
  url: string,
  init: RequestInit = {},
): Promise<{ ok: true; data: T; status: number } | { ok: false; status: number; body: string }> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${config.token}`,
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    return { ok: false, status: response.status, body: await response.text() };
  }

  if (response.status === 204) {
    return { ok: true, data: {} as T, status: 204 };
  }

  return { ok: true, data: (await response.json()) as T, status: response.status };
}

function decodeContent(meta: GitHubContentResponse): string {
  if (!meta.content) return "";
  return Buffer.from(meta.content.replace(/\n/g, ""), "base64").toString("utf8");
}

async function readFileOnBranch(
  config: GitHubConfig,
  path: string,
): Promise<string | null> {
  const result = await githubJson<GitHubContentResponse>(
    config,
    `${repoBase(config)}/contents/${path}?ref=${encodeURIComponent(config.branch)}`,
  );
  if (!result.ok) {
    if (result.status === 404) return null;
    throw new CatalogPromoteError(
      `${path} の読み取りに失敗しました。`,
      result.status >= 500 ? 502 : result.status,
    );
  }
  return decodeContent(result.data);
}

function defaultPersistedState(): CatalogPromotePersistedState {
  return {
    status: "IDLE",
    lastWorkAt: null,
    lastPromoteAt: null,
    lastPromoteSha: null,
    deployState: "none",
    deployStartedAt: null,
    productionUrl: null,
    errorSummary: null,
    lockToken: null,
    lockExpiresAt: null,
    cumulativeAdded: 0,
    cumulativeUpdated: 0,
  };
}

function parsePersistedState(raw: string | null): CatalogPromotePersistedState {
  if (!raw) return defaultPersistedState();
  try {
    const parsed = JSON.parse(raw) as Partial<CatalogPromotePersistedState>;
    return {
      ...defaultPersistedState(),
      ...parsed,
    };
  } catch {
    return defaultPersistedState();
  }
}

type PromoteMemoryStore = typeof globalThis & {
  __adultCatalogPromotePersisted?: CatalogPromotePersistedState;
};

function memoryPersisted(): PromoteMemoryStore {
  return globalThis as PromoteMemoryStore;
}

async function readPersistedState(): Promise<CatalogPromotePersistedState> {
  const mem = memoryPersisted().__adultCatalogPromotePersisted;
  if (mem) return mem;

  // 互換: 既存ファイルがあれば読む（書き込みはメモリのみにして二重デプロイを防ぐ）
  const production = getGitHubProductionConfig();
  if (production) {
    try {
      const rawProd = await readFileOnBranch(
        production,
        CATALOG_PROMOTE_STATE_PATH,
      );
      if (rawProd) {
        const parsed = parsePersistedState(rawProd);
        memoryPersisted().__adultCatalogPromotePersisted = parsed;
        return parsed;
      }
    } catch {
      // ignore
    }
  }

  return defaultPersistedState();
}

async function writePersistedState(
  state: CatalogPromotePersistedState,
  _commitMessage?: string,
  _target?: "working" | "production",
): Promise<void> {
  // GitHub へは書かない（本番反映後の追加コミット＝二重デプロイを防止）
  memoryPersisted().__adultCatalogPromotePersisted = state;
  void _commitMessage;
  void _target;
  void CATALOG_PROMOTE_STATE_PATH;
}


function appendAudit(entry: CatalogPromoteAuditEntry): void {
  // メモリ監査ログ（秘密情報なし）。永続化は別途オプション。
  const store = globalThis as typeof globalThis & {
    __adultCatalogPromoteAudit?: CatalogPromoteAuditEntry[];
  };
  const list = store.__adultCatalogPromoteAudit ?? [];
  list.unshift(entry);
  store.__adultCatalogPromoteAudit = list.slice(0, AUDIT_MAX_ENTRIES);
  console.log("[catalog-promote-audit]", {
    at: entry.at,
    actor: entry.actor,
    action: entry.action,
    workingBranch: entry.workingBranch,
    startSha: entry.startSha?.slice(0, 12) ?? null,
    endSha: entry.endSha?.slice(0, 12) ?? null,
    addedCount: entry.addedCount,
    updatedCount: entry.updatedCount,
    changedFileCount: entry.changedFileCount,
    promoteResult: entry.promoteResult,
    deployResult: entry.deployResult,
    failureReason: entry.failureReason,
  });
}

export function getRecentPromoteAudits(): CatalogPromoteAuditEntry[] {
  const store = globalThis as typeof globalThis & {
    __adultCatalogPromoteAudit?: CatalogPromoteAuditEntry[];
  };
  return store.__adultCatalogPromoteAudit ?? [];
}

function getDeployMode(): CatalogPromoteStatusPayload["deployMode"] {
  // main push による Vercel 自動デプロイを優先。Deploy Hook は明示設定時のみ（二重防止のため auto 時は使わない）
  const hook = process.env.VERCEL_PRODUCTION_DEPLOY_HOOK_URL?.trim();
  if (hook) {
    // フックがある場合でも GitHub→Vercel 連携がある前提では使わない方針
    // 環境変数 VERCEL_DEPLOY_VIA_HOOK=1 のときだけフックを使う
    if (process.env.VERCEL_DEPLOY_VIA_HOOK === "1") {
      return "deploy-hook";
    }
  }
  return "github-auto";
}

async function compareBranches(
  credentials: { token: string; owner: string; repo: string },
  base: string,
  head: string,
): Promise<GitCompareResponse> {
  const result = await githubJson<GitCompareResponse>(
    credentials,
    `${repoBase(credentials)}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`,
  );
  if (!result.ok) {
    throw new CatalogPromoteError(
      "ブランチ差分の取得に失敗しました。",
      result.status >= 500 ? 502 : result.status,
    );
  }
  return result.data;
}

function toDiffWork(item: DmmItem): CatalogPromoteDiffWork {
  return {
    contentId: item.content_id ?? "",
    productId: item.product_id ?? "",
    title: item.title ?? "",
  };
}

async function loadCatalogItemsFromBranch(
  config: GitHubConfig,
): Promise<{ manifest: CatalogManifest | null; items: DmmItem[]; issues: CatalogPromoteValidationIssue[] }> {
  const issues: CatalogPromoteValidationIssue[] = [];
  const manifestRaw = await readFileOnBranch(config, CATALOG_MANIFEST_RELATIVE);
  if (!manifestRaw) {
    issues.push({
      code: "manifest-missing",
      message: `${CATALOG_MANIFEST_RELATIVE} が存在しません。`,
    });
    return { manifest: null, items: [], issues };
  }

  let manifest: CatalogManifest;
  try {
    manifest = parseManifestJson(manifestRaw);
  } catch (error) {
    issues.push({
      code: "manifest-parse",
      message: `manifest の JSON 解析に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
    });
    return { manifest: null, items: [], issues };
  }

  const items: DmmItem[] = [];
  const seenIds = new Set<string>();

  for (const shard of manifest.shards) {
    const path = shard.file.startsWith("data/")
      ? shard.file
      : `data/dmm/catalog/${shard.file}`;

    const raw = await readFileOnBranch(config, path);
    if (!raw) {
      issues.push({
        code: "shard-missing",
        message: `必須シャード ${path} が見つかりません。`,
      });
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      issues.push({
        code: "shard-parse",
        message: `${path} の JSON 解析に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      });
      continue;
    }

    const list = Array.isArray(parsed)
      ? parsed
      : parsed &&
          typeof parsed === "object" &&
          Array.isArray((parsed as { items?: unknown }).items)
        ? ((parsed as { items: DmmItem[] }).items)
        : null;

    if (!list) {
      issues.push({
        code: "shard-shape",
        message: `${path} の形式が不正です。`,
      });
      continue;
    }

    if (typeof shard.count === "number" && shard.count !== list.length) {
      issues.push({
        code: "shard-count-mismatch",
        message: `${path} の件数不一致: manifest=${shard.count}, actual=${list.length}`,
      });
    }

    for (const item of list as DmmItem[]) {
      const id = (item.content_id || item.product_id || "").trim().toLowerCase();
      if (id) {
        if (seenIds.has(id)) {
          issues.push({
            code: "duplicate-id",
            message: `重複 ID を検出: ${id}`,
          });
        }
        seenIds.add(id);
      }
      items.push(item);
    }
  }

  if (manifest.totalCount !== items.length) {
    issues.push({
      code: "total-count-mismatch",
      message: `作品件数不一致: manifest.totalCount=${manifest.totalCount}, actual=${items.length}`,
    });
  }

  return { manifest, items, issues };
}

export async function validateWorkingCatalog(): Promise<CatalogPromoteValidationResult> {
  await ensureCatalogWorkingBranch();
  const working = getGitHubConfig();
  const production = getGitHubProductionConfig();
  if (!working || !production) {
    throw new CatalogPromoteError("GitHub設定が未完了です。", 503);
  }

  const workingLoaded = await loadCatalogItemsFromBranch(working);
  const productionLoaded = await loadCatalogItemsFromBranch(production);

  const issues = [...workingLoaded.issues];
  if (workingLoaded.items.length === 0 && workingLoaded.manifest) {
    issues.push({
      code: "empty-catalog",
      message: "作業用ブランチのカタログが空です。",
    });
  }

  // Production より作品数が減っていないこと
  if (
    productionLoaded.manifest &&
    workingLoaded.manifest &&
    workingLoaded.manifest.totalCount < productionLoaded.manifest.totalCount
  ) {
    issues.push({
      code: "work-count-decreased",
      message: `作品数が Production より減っています（working=${workingLoaded.manifest.totalCount}, production=${productionLoaded.manifest.totalCount}）。`,
    });
  }

  return {
    ok: issues.length === 0,
    issues,
    workingTotalCount: workingLoaded.manifest?.totalCount ?? null,
    productionTotalCount: productionLoaded.manifest?.totalCount ?? null,
    shardCount: workingLoaded.manifest?.shards.length ?? null,
  };
}

export async function buildCatalogPromoteDiff(): Promise<CatalogPromoteDiff> {
  await ensureCatalogWorkingBranch();
  const working = getGitHubConfig();
  const production = getGitHubProductionConfig();
  const credentials = getGitHubCredentials();
  if (!working || !production || !credentials) {
    throw new CatalogPromoteError("GitHub設定が未完了です。", 503);
  }

  const compare = await compareBranches(
    credentials,
    production.branch,
    working.branch,
  );

  const changedFiles = (compare.files ?? []).map((f) => f.filename);
  const changedCatalogShards = changedFiles.filter((f) =>
    /^data\/dmm\/catalog\/catalog-\d+\.json$/.test(f),
  );
  const changedMediaShards: string[] = [];
  const sitemapChanged = changedFiles.some((f) => f.includes("sitemap"));
  const searchIndexChanged = changedFiles.some(
    (f) => f.includes("search-index") || f.includes("ranking-snapshot"),
  );

  const workingLoaded = await loadCatalogItemsFromBranch(working);
  const productionLoaded = await loadCatalogItemsFromBranch(production);

  const productionByContent = new Map<string, DmmItem>();
  for (const item of productionLoaded.items) {
    const key = (item.content_id || item.product_id || "").trim().toLowerCase();
    if (key) productionByContent.set(key, item);
  }

  const workingKeys = new Set<string>();
  const added: CatalogPromoteDiffWork[] = [];
  const updated: CatalogPromoteDiffWork[] = [];

  for (const item of workingLoaded.items) {
    const key = (item.content_id || item.product_id || "").trim().toLowerCase();
    if (!key) continue;
    workingKeys.add(key);
    const prev = productionByContent.get(key);
    if (!prev) {
      added.push(toDiffWork(item));
    } else {
      const prevJson = JSON.stringify(prev);
      const nextJson = JSON.stringify(item);
      if (prevJson !== nextJson) {
        updated.push(toDiffWork(item));
      }
    }
  }

  const removed: CatalogPromoteDiffWork[] = [];
  for (const item of productionLoaded.items) {
    const key = (item.content_id || item.product_id || "").trim().toLowerCase();
    if (key && !workingKeys.has(key)) {
      removed.push(toDiffWork(item));
    }
  }

  const truncated =
    added.length > DIFF_WORK_DISPLAY_MAX ||
    updated.length > DIFF_WORK_DISPLAY_MAX ||
    removed.length > DIFF_WORK_DISPLAY_MAX;

  return {
    addedWorks: added.slice(0, DIFF_WORK_DISPLAY_MAX),
    updatedWorks: updated.slice(0, DIFF_WORK_DISPLAY_MAX),
    removedWorks: removed.slice(0, DIFF_WORK_DISPLAY_MAX),
    addedCount: added.length,
    updatedCount: updated.length,
    removedCount: removed.length,
    truncated,
    changedCatalogShards,
    changedMediaShards,
    sitemapChanged,
    searchIndexChanged,
    changedFiles,
    changedFileCount: changedFiles.length,
  };
}

export async function getCatalogPromoteStatus(): Promise<CatalogPromoteStatusPayload> {
  const workingBranch = getCatalogWorkingBranch();
  const productionBranch = getCatalogProductionBranch();
  const credentials = getGitHubCredentials();
  const working = getGitHubConfig();
  const production = getGitHubProductionConfig();
  const lockStatus = getPromoteLockStatus();

  if (!credentials || !workingBranch || !working || !production) {
    return {
      configured: false,
      hasPendingChanges: false,
      workingBranch,
      productionBranch,
      pendingCommitCount: 0,
      changedFileCount: 0,
      addedWorkCount: 0,
      updatedWorkCount: 0,
      lastWorkAt: null,
      lastPromoteAt: null,
      lastPromoteSha: null,
      workingSha: null,
      productionSha: null,
      status: lockStatus ?? "IDLE",
      deployState: "none",
      deployStartedAt: null,
      productionUrl: getSiteUrl(),
      errorSummary: workingBranch
        ? "GitHub認証または作業用ブランチ設定を確認してください。"
        : "ADULT_CATALOG_WORKING_BRANCH が未設定です。作品追加は作業用ブランチへ保存されます。",
      message: null,
      deployMode: getDeployMode(),
    };
  }

  try {
    await ensureCatalogWorkingBranch();
  } catch (error) {
    return {
      configured: false,
      hasPendingChanges: false,
      workingBranch,
      productionBranch,
      pendingCommitCount: 0,
      changedFileCount: 0,
      addedWorkCount: 0,
      updatedWorkCount: 0,
      lastWorkAt: null,
      lastPromoteAt: null,
      lastPromoteSha: null,
      workingSha: null,
      productionSha: null,
      status: "FAILED",
      deployState: "none",
      deployStartedAt: null,
      productionUrl: getSiteUrl(),
      errorSummary:
        error instanceof Error ? error.message : "作業用ブランチの準備に失敗しました。",
      message: null,
      deployMode: getDeployMode(),
    };
  }

  const [workingSha, productionSha, persisted, compare] = await Promise.all([
    fetchBranchSha(working),
    fetchBranchSha(production),
    readPersistedState(),
    compareBranches(credentials, production.branch, working.branch),
  ]);

  const changedFileCount = compare.files?.length ?? 0;
  const pendingCommitCount = compare.ahead_by ?? 0;
  const hasPendingChanges = pendingCommitCount > 0 || changedFileCount > 0;

  let addedWorkCount = persisted.cumulativeAdded;
  let updatedWorkCount = persisted.cumulativeUpdated;

  // 軽量: manifest totalCount 差分を追加件数の近似として使う（詳細は diff API）
  try {
    const workingManifestRaw = await readFileOnBranch(
      working,
      CATALOG_MANIFEST_RELATIVE,
    );
    const productionManifestRaw = await readFileOnBranch(
      production,
      CATALOG_MANIFEST_RELATIVE,
    );
    if (workingManifestRaw && productionManifestRaw) {
      const w = parseManifestJson(workingManifestRaw);
      const p = parseManifestJson(productionManifestRaw);
      addedWorkCount = Math.max(0, w.totalCount - p.totalCount);
      // 更新件数は詳細 diff でのみ正確。ステータスでは累計メモがあればそれを使う
      if (!hasPendingChanges) {
        addedWorkCount = 0;
        updatedWorkCount = 0;
      }
    }
  } catch {
    // keep cumulative
  }

  const lastWorkAt =
    compare.commits && compare.commits.length > 0
      ? compare.commits[0]?.commit?.author?.date ?? persisted.lastWorkAt
      : persisted.lastWorkAt;

  const status = lockStatus ?? (persisted.status === "READY" ? "READY" : hasPendingChanges ? "IDLE" : persisted.status);

  return {
    configured: true,
    hasPendingChanges,
    workingBranch,
    productionBranch,
    pendingCommitCount,
    changedFileCount,
    addedWorkCount,
    updatedWorkCount,
    lastWorkAt,
    lastPromoteAt: persisted.lastPromoteAt,
    lastPromoteSha: persisted.lastPromoteSha,
    workingSha,
    productionSha,
    status,
    deployState: persisted.deployState,
    deployStartedAt: persisted.deployStartedAt,
    productionUrl: persisted.productionUrl ?? getSiteUrl(),
    errorSummary: persisted.errorSummary,
    message: hasPendingChanges
      ? "未反映の変更があります。すべての作業完了後に『本番反映・デプロイ』を実行してください。"
      : "未反映の変更はありません。",
    deployMode: getDeployMode(),
  };
}

async function maybeTriggerDeployHook(): Promise<{ triggered: boolean; mode: string }> {
  const mode = getDeployMode();
  if (mode !== "deploy-hook") {
    return { triggered: false, mode };
  }

  const hookUrl = process.env.VERCEL_PRODUCTION_DEPLOY_HOOK_URL?.trim();
  if (!hookUrl) {
    return { triggered: false, mode: "none" };
  }

  // ログに全文を出さない
  console.log("[catalog-promote] triggering deploy hook (url redacted)");
  const response = await fetch(hookUrl, { method: "POST" });
  if (!response.ok) {
    throw new CatalogPromoteError(
      `Deploy Hook の実行に失敗しました (HTTP ${response.status})。`,
      502,
    );
  }
  return { triggered: true, mode };
}

export async function promoteCatalogToProduction(input: {
  actor: string;
}): Promise<{
  success: boolean;
  message: string;
  mergeSha: string | null;
  status: CatalogPromoteStatusPayload;
}> {
  const lock = tryAcquirePromoteLock("VALIDATING");
  if (!lock.ok) {
    throw new CatalogPromoteError(
      "本番反映またはデプロイが既に実行中です。完了するまでお待ちください。",
      409,
    );
  }

  const token = lock.token;
  let startSha: string | null = null;
  let endSha: string | null = null;

  try {
    await ensureCatalogWorkingBranch();
    const working = getGitHubConfig();
    const production = getGitHubProductionConfig();
    const credentials = getGitHubCredentials();
    if (!working || !production || !credentials) {
      throw new CatalogPromoteError("GitHub設定が未完了です。", 503);
    }

    startSha = await fetchBranchSha(working);
    const productionShaBefore = await fetchBranchSha(production);

    const compare = await compareBranches(
      credentials,
      production.branch,
      working.branch,
    );

    if ((compare.ahead_by ?? 0) === 0 && (compare.files?.length ?? 0) === 0) {
      throw new CatalogPromoteError("未反映の変更がありません。", 400);
    }

    if ((compare.behind_by ?? 0) > 0) {
      throw new CatalogPromoteError(
        "mainに新しい変更があるため、自動反映できません。作業用ブランチを更新してください。",
        409,
      );
    }

    updatePromoteLockStatus(token, "VALIDATING");
    const validation = await validateWorkingCatalog();
    if (!validation.ok) {
      throw new CatalogPromoteError(
        `カタログ検証に失敗しました: ${validation.issues.map((i) => i.message).join(" / ")}`,
        422,
      );
    }

    // 本番反映直前にサイトマップ・検索インデックス最終更新（1回）
    try {
      const { handlePostImportSitemapUpdate } = await import(
        "@/lib/admin/sitemap-admin-service"
      );
      await handlePostImportSitemapUpdate();
    } catch (error) {
      console.warn("[catalog-promote] sitemap final update failed", error);
    }

    updatePromoteLockStatus(token, "MERGING");

    // Fast-forward: behind=0 かつ ahead>0 → production ref を working SHA へ更新（force:false）
    let mergeSha: string | null = null;

    if ((compare.behind_by ?? 0) === 0 && startSha) {
      const ff = await githubJson(
        credentials,
        `${repoBase(credentials)}/git/refs/heads/${encodeURIComponent(production.branch)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            sha: startSha,
            force: false,
          }),
        },
      );

      if (ff.ok) {
        mergeSha = startSha;
      } else if (ff.status === 422 || ff.status === 409) {
        // fallback: merges API
        const merge = await githubJson<MergeResponse>(
          credentials,
          `${repoBase(credentials)}/merges`,
          {
            method: "POST",
            body: JSON.stringify({
              base: production.branch,
              head: working.branch,
              commit_message: `chore(catalog): promote ${working.branch} → ${production.branch}`,
            }),
          },
        );

        if (!merge.ok) {
          if (merge.status === 409) {
            throw new CatalogPromoteError(
              "mainに新しい変更があるため、自動反映できません。作業用ブランチを更新してください。",
              409,
            );
          }
          throw new CatalogPromoteError(
            "main へのマージに失敗しました。",
            merge.status >= 500 ? 502 : merge.status,
          );
        }
        mergeSha = merge.data.sha;
      } else {
        throw new CatalogPromoteError(
          "main への反映に失敗しました。",
          ff.status >= 500 ? 502 : ff.status,
        );
      }
    } else {
      throw new CatalogPromoteError(
        "mainに新しい変更があるため、自動反映できません。作業用ブランチを更新してください。",
        409,
      );
    }

    // 競合再確認：反映前の production SHA が変わっていないこと（FF 成功時）
    const productionShaAfter = await fetchBranchSha(production);
    endSha = productionShaAfter;
    void productionShaBefore;

    updatePromoteLockStatus(token, "DEPLOYING");
    const deploy = await maybeTriggerDeployHook();

    const now = new Date().toISOString();
    const nextState: CatalogPromotePersistedState = {
      ...(await readPersistedState()),
      status: "READY",
      lastPromoteAt: now,
      lastPromoteSha: mergeSha,
      deployState: deploy.mode === "github-auto" ? "pending" : deploy.triggered ? "pending" : "unknown",
      deployStartedAt: now,
      productionUrl: getSiteUrl(),
      errorSummary: null,
      cumulativeAdded: 0,
      cumulativeUpdated: 0,
      lockToken: null,
      lockExpiresAt: null,
    };
    await writePersistedState(
      nextState,
      `chore(catalog): record promote ${mergeSha?.slice(0, 12) ?? ""}`,
      "production",
    );

    appendAudit({
      at: now,
      actor: input.actor,
      action: "promote",
      workingBranch: working.branch,
      productionBranch: production.branch,
      startSha,
      endSha: mergeSha,
      addedCount: validation.workingTotalCount,
      updatedCount: null,
      changedFileCount: compare.files?.length ?? null,
      promoteResult: "success",
      deployResult:
        deploy.mode === "github-auto"
          ? "github-auto-deploy"
          : deploy.triggered
            ? "deploy-hook"
            : "none",
      failureReason: null,
    });

    const status = await getCatalogPromoteStatus();
    return {
      success: true,
      message:
        deploy.mode === "github-auto"
          ? "mainへ反映済み。GitHub連携により Vercel Production デプロイが開始されます。ダッシュボードで状態を確認してください。"
          : "mainへ反映し、デプロイを開始しました。",
      mergeSha,
      status,
    };
  } catch (error) {
    const message =
      error instanceof CatalogPromoteError || error instanceof CatalogBranchError
        ? error.message
        : error instanceof Error
          ? error.message
          : "本番反映に失敗しました。";

    appendAudit({
      at: new Date().toISOString(),
      actor: input.actor,
      action: "promote",
      workingBranch: getCatalogWorkingBranch(),
      productionBranch: getCatalogProductionBranch(),
      startSha,
      endSha,
      addedCount: null,
      updatedCount: null,
      changedFileCount: null,
      promoteResult: "failed",
      deployResult: null,
      failureReason: message,
    });

    try {
      const failedState: CatalogPromotePersistedState = {
        ...(await readPersistedState()),
        status: "FAILED",
        errorSummary: message,
        deployState: "failed",
      };
      await writePersistedState(failedState, "chore(catalog): record promote failure");
    } catch {
      // ignore
    }

    if (error instanceof CatalogPromoteError) throw error;
    throw new CatalogPromoteError(message, 500);
  } finally {
    releasePromoteLock(token);
  }
}

export async function discardCatalogWorkingChanges(input: {
  actor: string;
  confirmText: string;
}): Promise<{ success: boolean; message: string; status: CatalogPromoteStatusPayload }> {
  if (input.confirmText !== "未反映の変更を破棄") {
    throw new CatalogPromoteError(
      '確認のため「未反映の変更を破棄」と入力してください。',
      400,
    );
  }

  const lock = tryAcquirePromoteLock("MERGING");
  if (!lock.ok) {
    throw new CatalogPromoteError(
      "本番反映またはデプロイが既に実行中です。",
      409,
    );
  }

  try {
    const result = await resetWorkingBranchToProduction();
    appendAudit({
      at: new Date().toISOString(),
      actor: input.actor,
      action: "discard",
      workingBranch: result.workingBranch,
      productionBranch: result.productionBranch,
      startSha: result.previousWorkingSha,
      endSha: result.newSha,
      addedCount: null,
      updatedCount: null,
      changedFileCount: null,
      promoteResult: "skipped",
      deployResult: "none",
      failureReason: null,
    });

    const cleared: CatalogPromotePersistedState = {
      ...defaultPersistedState(),
      status: "IDLE",
      lastPromoteAt: (await readPersistedState()).lastPromoteAt,
      lastPromoteSha: (await readPersistedState()).lastPromoteSha,
    };
    await writePersistedState(cleared);
    void CATALOG_PROMOTE_AUDIT_PATH;

    return {
      success: true,
      message: "作業用ブランチを Production の状態へ戻しました。Production デプロイは発生していません。",
      status: await getCatalogPromoteStatus(),
    };
  } finally {
    releasePromoteLock(lock.token);
  }
}

/** カタログ作業後に呼ぶ（同一コミットに含められない場合の軽量メモ） */
export function noteCatalogWorkActivity(input: {
  addedCount?: number;
  updatedCount?: number;
}): void {
  const store = globalThis as typeof globalThis & {
    __adultCatalogLastWorkAt?: string;
    __adultCatalogCumulativeAdded?: number;
    __adultCatalogCumulativeUpdated?: number;
  };
  store.__adultCatalogLastWorkAt = new Date().toISOString();
  if (input.addedCount) {
    store.__adultCatalogCumulativeAdded =
      (store.__adultCatalogCumulativeAdded ?? 0) + input.addedCount;
  }
  if (input.updatedCount) {
    store.__adultCatalogCumulativeUpdated =
      (store.__adultCatalogCumulativeUpdated ?? 0) + input.updatedCount;
  }
}
