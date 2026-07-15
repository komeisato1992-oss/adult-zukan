import "server-only";

import {
  ensureCatalogWorkingBranch,
  fetchBranchSha,
  resetWorkingBranchToProduction,
  syncWorkingBranchWithProduction,
  CatalogBranchError,
} from "@/lib/admin/catalog-branch";
import {
  getPromoteLockStatus,
  releasePromoteLock,
  tryAcquirePromoteLock,
  updatePromoteLockStatus,
} from "@/lib/admin/catalog-promote-lock";
import type {
  CatalogPromoteApiResult,
  CatalogPromoteAuditEntry,
  CatalogPromoteDiff,
  CatalogPromoteDiffWork,
  CatalogPromotePersistedState,
  CatalogPromoteStatus,
  CatalogPromoteStatusPayload,
  CatalogPromoteValidationIssue,
  CatalogPromoteValidationResult,
} from "@/lib/admin/catalog-promote-types";
import {
  CATALOG_PROMOTE_AUDIT_PATH,
  CATALOG_PROMOTE_STATE_PATH,
  isCatalogPromoteMetaPath,
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
  errorCode: string;
  stage: CatalogPromoteStatus;
  retryable: boolean;

  constructor(
    message: string,
    status = 500,
    options?: {
      errorCode?: string;
      stage?: CatalogPromoteStatus;
      retryable?: boolean;
    },
  ) {
    super(message);
    this.name = "CatalogPromoteError";
    this.status = status;
    this.errorCode = options?.errorCode ?? defaultErrorCode(status);
    this.stage = options?.stage ?? "FAILED";
    this.retryable =
      options?.retryable ?? (status === 409 || status >= 500 || status === 502);
  }
}

function defaultErrorCode(status: number): string {
  if (status === 400) return "BAD_REQUEST";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 409) return "CONFLICT";
  if (status === 422) return "VALIDATION_FAILED";
  if (status === 503) return "NOT_CONFIGURED";
  if (status >= 500) return "INTERNAL_ERROR";
  return "PROMOTE_FAILED";
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
  commits?: Array<{
    sha: string;
    commit: { message: string; author?: { date?: string } };
  }>;
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

function summarizeGitHubFailure(status: number, body: string): string {
  let message = "";
  try {
    const parsed = JSON.parse(body) as { message?: string };
    message = typeof parsed.message === "string" ? parsed.message : "";
  } catch {
    message = body.slice(0, 200);
  }

  const lower = message.toLowerCase();
  if (status === 403 || status === 401) {
    if (lower.includes("protected branch") || lower.includes("not authorized to push")) {
      return "main が branch protection により保護されており、更新が拒否されました。";
    }
    if (
      lower.includes("resource not accessible") ||
      lower.includes("insufficient") ||
      lower.includes("bad credentials")
    ) {
      return "GitHub Token に Contents の read/write 権限がないか、認証に失敗しました。";
    }
    return `GitHub が更新を拒否しました (HTTP ${status})。Token 権限または branch protection を確認してください。`;
  }
  if (status === 409 || status === 422) {
    if (lower.includes("not a fast-forward") || lower.includes("conflict")) {
      return "main に新しい変更があるため fast-forward できません。作業用ブランチを更新してください。";
    }
    return message
      ? `GitHub 更新に失敗しました: ${message}`
      : `GitHub 更新に失敗しました (HTTP ${status})。`;
  }
  return message
    ? `GitHub API エラー (HTTP ${status}): ${message}`
    : `GitHub API エラー (HTTP ${status})。`;
}

async function githubJson<T>(
  config: { token: string },
  url: string,
  init: RequestInit = {},
): Promise<
  | { ok: true; data: T; status: number }
  | { ok: false; status: number; body: string }
> {
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

  return {
    ok: true,
    data: (await response.json()) as T,
    status: response.status,
  };
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
      { errorCode: "GITHUB_READ_FAILED", stage: "VALIDATING", retryable: true },
    );
  }
  return decodeContent(result.data);
}

async function writeFileOnBranch(
  config: GitHubConfig,
  path: string,
  content: string,
  message: string,
): Promise<void> {
  const existing = await githubJson<GitHubContentResponse>(
    config,
    `${repoBase(config)}/contents/${path}?ref=${encodeURIComponent(config.branch)}`,
  );
  const sha = existing.ok ? existing.data.sha : undefined;

  const put = await githubJson(
    config,
    `${repoBase(config)}/contents/${path}`,
    {
      method: "PUT",
      body: JSON.stringify({
        message,
        content: Buffer.from(content, "utf8").toString("base64"),
        branch: config.branch,
        ...(sha ? { sha } : {}),
      }),
    },
  );

  if (!put.ok) {
    // 状態ファイル書き込み失敗は本番反映自体の成否をひっくり返さない
    console.warn(
      "[catalog-promote] failed to persist state on working branch",
      put.status,
    );
  }
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
    errorCode: null,
    failedStage: null,
    httpStatus: null,
    retryable: null,
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

  const working = getGitHubConfig();
  if (working) {
    try {
      const rawWorking = await readFileOnBranch(
        working,
        CATALOG_PROMOTE_STATE_PATH,
      );
      if (rawWorking) {
        const parsed = parsePersistedState(rawWorking);
        memoryPersisted().__adultCatalogPromotePersisted = parsed;
        return parsed;
      }
    } catch {
      // ignore
    }
  }

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
  commitMessage = "chore(catalog): update promote state",
): Promise<void> {
  memoryPersisted().__adultCatalogPromotePersisted = state;

  // 作業用ブランチのみへ永続化（main へ追加コミットしない＝Production 二重デプロイ防止）
  const working = getGitHubConfig();
  if (!working) return;

  try {
    await writeFileOnBranch(
      working,
      CATALOG_PROMOTE_STATE_PATH,
      `${JSON.stringify(state, null, 2)}\n`,
      commitMessage,
    );
  } catch (error) {
    console.warn("[catalog-promote] persist state skipped", error);
  }
}

function appendAudit(entry: CatalogPromoteAuditEntry): void {
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
  // main push による Vercel 自動デプロイを優先。
  // Deploy Hook は VERCEL_DEPLOY_VIA_HOOK=1 のときだけ（二重デプロイ防止）
  const hook = process.env.VERCEL_PRODUCTION_DEPLOY_HOOK_URL?.trim();
  if (hook && process.env.VERCEL_DEPLOY_VIA_HOOK === "1") {
    return "deploy-hook";
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
      summarizeGitHubFailure(result.status, result.body) ||
        "ブランチ差分の取得に失敗しました。",
      result.status >= 500 ? 502 : result.status,
      {
        errorCode: "COMPARE_FAILED",
        stage: "VALIDATING",
        retryable: result.status >= 500,
      },
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

function substantiveChangedFiles(files: GitCompareFile[] | undefined): string[] {
  return (files ?? [])
    .map((f) => f.filename)
    .filter((name) => !isCatalogPromoteMetaPath(name));
}

async function loadCatalogItemsFromBranch(
  config: GitHubConfig,
): Promise<{
  manifest: CatalogManifest | null;
  items: DmmItem[];
  issues: CatalogPromoteValidationIssue[];
}> {
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
        ? (parsed as { items: DmmItem[] }).items
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

/** 本番反映向けの軽量検証（全シャード読み込みはしない） */
async function validateWorkingCatalogLight(
  working: GitHubConfig,
  production: GitHubConfig,
  changedFiles: string[],
): Promise<CatalogPromoteValidationResult> {
  const issues: CatalogPromoteValidationIssue[] = [];

  const workingManifestRaw = await readFileOnBranch(
    working,
    CATALOG_MANIFEST_RELATIVE,
  );
  const productionManifestRaw = await readFileOnBranch(
    production,
    CATALOG_MANIFEST_RELATIVE,
  );

  if (!workingManifestRaw) {
    issues.push({
      code: "manifest-missing",
      message: `${CATALOG_MANIFEST_RELATIVE} が作業用ブランチに存在しません。`,
    });
    return {
      ok: false,
      issues,
      workingTotalCount: null,
      productionTotalCount: null,
      shardCount: null,
    };
  }

  let workingManifest: CatalogManifest;
  try {
    workingManifest = parseManifestJson(workingManifestRaw);
  } catch (error) {
    issues.push({
      code: "manifest-parse",
      message: `作業用 manifest の解析に失敗: ${error instanceof Error ? error.message : String(error)}`,
    });
    return {
      ok: false,
      issues,
      workingTotalCount: null,
      productionTotalCount: null,
      shardCount: null,
    };
  }

  let productionTotal: number | null = null;
  if (productionManifestRaw) {
    try {
      productionTotal = parseManifestJson(productionManifestRaw).totalCount;
    } catch {
      // production manifest 破損時は件数比較をスキップ
    }
  }

  if (workingManifest.totalCount <= 0) {
    issues.push({
      code: "empty-catalog",
      message: "作業用ブランチのカタログが空です。",
    });
  }

  if (
    productionTotal != null &&
    workingManifest.totalCount < productionTotal
  ) {
    issues.push({
      code: "work-count-decreased",
      message: `作品数が Production より減っています（working=${workingManifest.totalCount}, production=${productionTotal}）。`,
    });
  }

  const shardsToCheck = changedFiles
    .filter((f) => /^data\/dmm\/catalog\/catalog-\d+\.json$/.test(f))
    .slice(0, 8);

  // manifest 自体が変わっていれば先頭シャードも軽く確認
  if (
    shardsToCheck.length === 0 &&
    changedFiles.includes(CATALOG_MANIFEST_RELATIVE) &&
    workingManifest.shards[0]
  ) {
    const first = workingManifest.shards[0].file;
    shardsToCheck.push(
      first.startsWith("data/") ? first : `data/dmm/catalog/${first}`,
    );
  }

  for (const path of shardsToCheck) {
    const raw = await readFileOnBranch(working, path);
    if (!raw) {
      issues.push({
        code: "shard-missing",
        message: `変更シャード ${path} が見つかりません。`,
      });
      continue;
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      const list = Array.isArray(parsed)
        ? parsed
        : parsed &&
            typeof parsed === "object" &&
            Array.isArray((parsed as { items?: unknown }).items)
          ? (parsed as { items: unknown[] }).items
          : null;
      if (!list) {
        issues.push({
          code: "shard-shape",
          message: `${path} の形式が不正です。`,
        });
      }
    } catch (error) {
      issues.push({
        code: "shard-parse",
        message: `${path} の JSON 解析に失敗: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    workingTotalCount: workingManifest.totalCount,
    productionTotalCount: productionTotal,
    shardCount: workingManifest.shards.length,
  };
}

export async function validateWorkingCatalog(): Promise<CatalogPromoteValidationResult> {
  await ensureCatalogWorkingBranch();
  const working = getGitHubConfig();
  const production = getGitHubProductionConfig();
  if (!working || !production) {
    throw new CatalogPromoteError("GitHub設定が未完了です。", 503, {
      errorCode: "NOT_CONFIGURED",
      stage: "VALIDATING",
      retryable: false,
    });
  }

  const credentials = getGitHubCredentials();
  if (!credentials) {
    throw new CatalogPromoteError("GitHub設定が未完了です。", 503, {
      errorCode: "NOT_CONFIGURED",
      stage: "VALIDATING",
      retryable: false,
    });
  }

  const compare = await compareBranches(
    credentials,
    production.branch,
    working.branch,
  );
  return validateWorkingCatalogLight(
    working,
    production,
    substantiveChangedFiles(compare.files),
  );
}

export async function buildCatalogPromoteDiff(): Promise<CatalogPromoteDiff> {
  await ensureCatalogWorkingBranch();
  const working = getGitHubConfig();
  const production = getGitHubProductionConfig();
  const credentials = getGitHubCredentials();
  if (!working || !production || !credentials) {
    throw new CatalogPromoteError("GitHub設定が未完了です。", 503, {
      errorCode: "NOT_CONFIGURED",
      stage: "IDLE",
      retryable: false,
    });
  }

  const compare = await compareBranches(
    credentials,
    production.branch,
    working.branch,
  );

  const changedFiles = substantiveChangedFiles(compare.files);
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
    } else if (JSON.stringify(prev) !== JSON.stringify(item)) {
      updated.push(toDiffWork(item));
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

function resolveDisplayStatus(
  lockStatus: CatalogPromoteStatus | null,
  persisted: CatalogPromotePersistedState,
  hasPendingChanges: boolean,
): CatalogPromoteStatus {
  if (lockStatus) return lockStatus;
  if (
    persisted.status === "VALIDATING" ||
    persisted.status === "MERGING" ||
    persisted.status === "DEPLOYING"
  ) {
    // ロック消失後の中途半端な状態は FAILED 扱い
    return "FAILED";
  }
  if (persisted.status === "FAILED") return "FAILED";
  if (persisted.status === "READY" && !hasPendingChanges) return "READY";
  if (hasPendingChanges) return "IDLE";
  return persisted.status === "READY" ? "READY" : "IDLE";
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
      productionAheadCount: 0,
      workingBranch,
      productionBranch,
      pendingCommitCount: 0,
      changedFileCount: 0,
      addedWorkCount: 0,
      updatedWorkCount: 0,
      workingWorkCount: null,
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
      errorCode: "NOT_CONFIGURED",
      failedStage: null,
      httpStatus: null,
      retryable: false,
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
      productionAheadCount: 0,
      workingBranch,
      productionBranch,
      pendingCommitCount: 0,
      changedFileCount: 0,
      addedWorkCount: 0,
      updatedWorkCount: 0,
      workingWorkCount: null,
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
        error instanceof Error
          ? error.message
          : "作業用ブランチの準備に失敗しました。",
      errorCode: "WORKING_BRANCH_FAILED",
      failedStage: "VALIDATING",
      httpStatus: error instanceof CatalogBranchError ? error.status : 500,
      retryable: true,
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

  const changedFiles = substantiveChangedFiles(compare.files);
  const changedFileCount = changedFiles.length;
  const hasPendingChanges = changedFileCount > 0;
  // 状態メタファイルのみの差分は「未反映のカタログ変更」に数えない
  const pendingCommitCount = hasPendingChanges ? (compare.ahead_by ?? 0) : 0;
  const productionAheadCount = compare.behind_by ?? 0;

  let addedWorkCount = persisted.cumulativeAdded;
  let updatedWorkCount = persisted.cumulativeUpdated;
  let workingWorkCount: number | null = null;

  try {
    const workingManifestRaw = await readFileOnBranch(
      working,
      CATALOG_MANIFEST_RELATIVE,
    );
    const productionManifestRaw = await readFileOnBranch(
      production,
      CATALOG_MANIFEST_RELATIVE,
    );
    if (workingManifestRaw) {
      workingWorkCount = parseManifestJson(workingManifestRaw).totalCount;
    }
    if (workingManifestRaw && productionManifestRaw) {
      const w = parseManifestJson(workingManifestRaw);
      const p = parseManifestJson(productionManifestRaw);
      addedWorkCount = Math.max(0, w.totalCount - p.totalCount);
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
      ? (compare.commits[0]?.commit?.author?.date ?? persisted.lastWorkAt)
      : persisted.lastWorkAt;

  const status = resolveDisplayStatus(lockStatus, persisted, hasPendingChanges);

  const lastPromoteSha =
    persisted.lastPromoteSha ??
    (!hasPendingChanges ? productionSha : null);

  return {
    configured: true,
    hasPendingChanges,
    productionAheadCount,
    workingBranch,
    productionBranch,
    pendingCommitCount,
    changedFileCount,
    addedWorkCount,
    updatedWorkCount,
    workingWorkCount,
    lastWorkAt,
    lastPromoteAt: persisted.lastPromoteAt,
    lastPromoteSha,
    workingSha,
    productionSha,
    status,
    deployState: persisted.deployState,
    deployStartedAt: persisted.deployStartedAt,
    productionUrl: persisted.productionUrl ?? getSiteUrl(),
    errorSummary: persisted.errorSummary,
    errorCode: persisted.errorCode,
    failedStage: persisted.failedStage,
    httpStatus: persisted.httpStatus,
    retryable: persisted.retryable,
    message: productionAheadCount > 0
      ? "本番側に新しい更新があります。「作業ブランチを最新化」を実行してください。"
      : hasPendingChanges
        ? "未反映の変更があります。作業が終わったら「本番反映」を押してください。"
        : "未反映の変更はありません。",
    deployMode: getDeployMode(),
  };
}

async function maybeTriggerDeployHook(): Promise<{
  triggered: boolean;
  mode: CatalogPromoteStatusPayload["deployMode"];
}> {
  const mode = getDeployMode();
  if (mode !== "deploy-hook") {
    return { triggered: false, mode };
  }

  const hookUrl = process.env.VERCEL_PRODUCTION_DEPLOY_HOOK_URL?.trim();
  if (!hookUrl) {
    return { triggered: false, mode: "none" };
  }

  console.log("[catalog-promote] triggering deploy hook (url redacted)");
  const response = await fetch(hookUrl, { method: "POST" });
  if (!response.ok) {
    throw new CatalogPromoteError(
      `Deploy Hook の実行に失敗しました (HTTP ${response.status})。`,
      502,
      {
        errorCode: "DEPLOY_HOOK_FAILED",
        stage: "DEPLOYING",
        retryable: true,
      },
    );
  }
  return { triggered: true, mode };
}

function emptyApiResult(
  partial: Partial<CatalogPromoteApiResult> & {
    ok: boolean;
    message: string;
    status: CatalogPromoteStatus;
  },
): CatalogPromoteApiResult {
  return {
    ok: partial.ok,
    success: partial.ok,
    status: partial.status,
    workingBranch: partial.workingBranch ?? getCatalogWorkingBranch(),
    productionBranch:
      partial.productionBranch ?? getCatalogProductionBranch(),
    workingSha: partial.workingSha ?? null,
    previousMainSha: partial.previousMainSha ?? null,
    mergedMainSha: partial.mergedMainSha ?? null,
    deploymentTriggered: partial.deploymentTriggered ?? false,
    message: partial.message,
    errorCode: partial.errorCode ?? null,
    httpStatus: partial.httpStatus ?? (partial.ok ? 200 : 500),
    retryable: partial.retryable ?? false,
    failedStage: partial.failedStage ?? null,
    lastPromoteAt: partial.lastPromoteAt ?? null,
    productionUrl: partial.productionUrl ?? getSiteUrl(),
    deployState: partial.deployState ?? null,
    deployMode: partial.deployMode ?? getDeployMode(),
    statusPayload: partial.statusPayload ?? null,
  };
}

export function toPromoteErrorResult(
  error: unknown,
): CatalogPromoteApiResult {
  if (error instanceof CatalogPromoteError) {
    return emptyApiResult({
      ok: false,
      status: "FAILED",
      message: error.message,
      errorCode: error.errorCode,
      httpStatus: error.status,
      retryable: error.retryable,
      failedStage: error.stage,
    });
  }
  if (error instanceof CatalogBranchError) {
    return emptyApiResult({
      ok: false,
      status: "FAILED",
      message: error.message,
      errorCode: "WORKING_BRANCH_FAILED",
      httpStatus: error.status,
      retryable: true,
      failedStage: "VALIDATING",
    });
  }
  return emptyApiResult({
    ok: false,
    status: "FAILED",
    message:
      error instanceof Error ? error.message : "本番反映に失敗しました。",
    errorCode: "INTERNAL_ERROR",
    httpStatus: 500,
    retryable: true,
    failedStage: "FAILED",
  });
}

export async function promoteCatalogToProduction(input: {
  actor: string;
  onProgress?: (status: CatalogPromoteStatus) => void | Promise<void>;
}): Promise<CatalogPromoteApiResult> {
  const lock = tryAcquirePromoteLock("VALIDATING");
  if (!lock.ok) {
    throw new CatalogPromoteError(
      "本番反映またはデプロイが既に実行中です。完了するまでお待ちください。",
      409,
      {
        errorCode: "IN_PROGRESS",
        stage: lock.status,
        retryable: true,
      },
    );
  }

  const token = lock.token;
  let startSha: string | null = null;
  let previousMainSha: string | null = null;
  let endSha: string | null = null;
  let currentStage: CatalogPromoteStatus = "VALIDATING";

  const report = async (status: CatalogPromoteStatus) => {
    currentStage = status;
    updatePromoteLockStatus(token, status);
    await input.onProgress?.(status);
  };

  try {
    await ensureCatalogWorkingBranch();
    const working = getGitHubConfig();
    const production = getGitHubProductionConfig();
    const credentials = getGitHubCredentials();
    if (!working || !production || !credentials) {
      throw new CatalogPromoteError("GitHub設定が未完了です。", 503, {
        errorCode: "NOT_CONFIGURED",
        stage: "VALIDATING",
        retryable: false,
      });
    }

    await report("VALIDATING");

    startSha = await fetchBranchSha(working);
    previousMainSha = await fetchBranchSha(production);

    // 本番が先行している場合は自動で作業ブランチへ取り込む（競合時のみ停止）
    let compare = await compareBranches(
      credentials,
      production.branch,
      working.branch,
    );

    if ((compare.behind_by ?? 0) > 0) {
      const synced = await syncWorkingBranchWithProduction();
      if (synced.conflict) {
        throw new CatalogPromoteError(
          "本番ブランチとの取り込みで競合が発生しました。確認画面で対応してください。",
          409,
          {
            errorCode: "SYNC_CONFLICT",
            stage: "VALIDATING",
            retryable: false,
          },
        );
      }
      startSha = (await fetchBranchSha(working)) ?? startSha;
      compare = await compareBranches(
        credentials,
        production.branch,
        working.branch,
      );
    }

    const changedFiles = substantiveChangedFiles(compare.files);

    if ((compare.ahead_by ?? 0) === 0 && changedFiles.length === 0) {
      throw new CatalogPromoteError("未反映の変更がありません。", 400, {
        errorCode: "NO_PENDING_CHANGES",
        stage: "VALIDATING",
        retryable: false,
      });
    }

    if ((compare.behind_by ?? 0) > 0) {
      throw new CatalogPromoteError(
        "本番ブランチの取り込み後も差分が解消されませんでした。競合の可能性があります。",
        409,
        {
          errorCode: "SYNC_CONFLICT",
          stage: "VALIDATING",
          retryable: false,
        },
      );
    }

    const validation = await validateWorkingCatalogLight(
      working,
      production,
      changedFiles,
    );
    if (!validation.ok) {
      throw new CatalogPromoteError(
        `カタログ検証に失敗しました: ${validation.issues.map((i) => i.message).join(" / ")}`,
        422,
        {
          errorCode: "VALIDATION_FAILED",
          stage: "VALIDATING",
          retryable: false,
        },
      );
    }

    // 本番反映直前にサイトマップ・検索インデックス最終更新（失敗してもマージは続行）
    try {
      const { handlePostImportSitemapUpdate } = await import(
        "@/lib/admin/sitemap-admin-service"
      );
      await handlePostImportSitemapUpdate();
    } catch (error) {
      console.warn("[catalog-promote] sitemap final update failed", error);
    }

    // サイトマップ更新が作業用ブランチへコミットした場合に備え SHA を再取得
    startSha = (await fetchBranchSha(working)) ?? startSha;

    await report("MERGING");

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
              "本番ブランチとのマージで競合が発生しました。確認画面で対応してください。",
              409,
              {
                errorCode: "SYNC_CONFLICT",
                stage: "MERGING",
                retryable: false,
              },
            );
          }
          throw new CatalogPromoteError(
            summarizeGitHubFailure(merge.status, merge.body) ||
              "main へのマージに失敗しました。",
            merge.status >= 500 ? 502 : merge.status,
            {
              errorCode:
                merge.status === 403 ? "GITHUB_FORBIDDEN" : "MERGE_FAILED",
              stage: "MERGING",
              retryable: merge.status >= 500,
            },
          );
        }
        mergeSha = merge.data.sha;
      } else {
        throw new CatalogPromoteError(
          summarizeGitHubFailure(ff.status, ff.body) ||
            "main への反映に失敗しました。",
          ff.status >= 500 ? 502 : ff.status,
          {
            errorCode: ff.status === 403 ? "GITHUB_FORBIDDEN" : "MERGE_FAILED",
            stage: "MERGING",
            retryable: ff.status >= 500,
          },
        );
      }
    } else {
      throw new CatalogPromoteError(
        "本番ブランチの取り込みが必要な状態です。「作業ブランチを最新化」を実行してから再度お試しください。",
        409,
        {
          errorCode: "SYNC_CONFLICT",
          stage: "MERGING",
          retryable: true,
        },
      );
    }

    endSha = (await fetchBranchSha(production)) ?? mergeSha;

    await report("DEPLOYING");
    const deploy = await maybeTriggerDeployHook();
    // github-auto: main 更新で Vercel が Production デプロイを開始する想定（フックは呼ばない）
    const deploymentTriggered =
      deploy.mode === "github-auto" || deploy.triggered;

    const now = new Date().toISOString();
    const nextState: CatalogPromotePersistedState = {
      ...(await readPersistedState()),
      status: "READY",
      lastPromoteAt: now,
      lastPromoteSha: mergeSha,
      deployState:
        deploy.mode === "github-auto"
          ? "pending"
          : deploy.triggered
            ? "pending"
            : "unknown",
      deployStartedAt: now,
      productionUrl: getSiteUrl(),
      errorSummary: null,
      errorCode: null,
      failedStage: null,
      httpStatus: null,
      retryable: null,
      cumulativeAdded: 0,
      cumulativeUpdated: 0,
      lockToken: null,
      lockExpiresAt: null,
    };
    // メモリへ即時反映。GitHub 作業ブランチへの書き込みは main 反映後でも
    // Production デプロイを増やさない（working のみ）
    memoryPersisted().__adultCatalogPromotePersisted = nextState;
    await writePersistedState(
      nextState,
      `chore(catalog): record promote ${mergeSha?.slice(0, 12) ?? ""}`,
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
      changedFileCount: changedFiles.length,
      promoteResult: "success",
      deployResult:
        deploy.mode === "github-auto"
          ? "github-auto-deploy"
          : deploy.triggered
            ? "deploy-hook"
            : "none",
      failureReason: null,
    });

    await report("READY");
    const statusPayload = await getCatalogPromoteStatus();

    return emptyApiResult({
      ok: true,
      status: "READY",
      workingBranch: working.branch,
      productionBranch: production.branch,
      workingSha: startSha,
      previousMainSha,
      mergedMainSha: mergeSha,
      deploymentTriggered,
      message:
        deploy.mode === "github-auto"
          ? "mainへ反映済み。GitHub連携により Vercel Production デプロイが開始されます。"
          : "mainへ反映し、デプロイを開始しました。",
      errorCode: null,
      httpStatus: 200,
      retryable: false,
      failedStage: null,
      lastPromoteAt: now,
      productionUrl: getSiteUrl(),
      deployState: nextState.deployState,
      deployMode: deploy.mode,
      statusPayload: {
        ...statusPayload,
        status: "READY",
        lastPromoteAt: now,
        lastPromoteSha: mergeSha,
        deployState: nextState.deployState,
        deployStartedAt: now,
        productionUrl: getSiteUrl(),
        hasPendingChanges: false,
      },
    });
  } catch (error) {
    const promoteError =
      error instanceof CatalogPromoteError
        ? error
        : error instanceof CatalogBranchError
          ? new CatalogPromoteError(error.message, error.status, {
              errorCode: "WORKING_BRANCH_FAILED",
              stage: currentStage,
              retryable: true,
            })
          : new CatalogPromoteError(
              error instanceof Error
                ? error.message
                : "本番反映に失敗しました。",
              500,
              {
                errorCode: "INTERNAL_ERROR",
                stage: currentStage,
                retryable: true,
              },
            );

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
      failureReason: promoteError.message,
    });

    try {
      const failedState: CatalogPromotePersistedState = {
        ...(await readPersistedState()),
        status: "FAILED",
        errorSummary: promoteError.message,
        errorCode: promoteError.errorCode,
        failedStage: promoteError.stage,
        httpStatus: promoteError.status,
        retryable: promoteError.retryable,
        deployState: "failed",
      };
      memoryPersisted().__adultCatalogPromotePersisted = failedState;
      await writePersistedState(
        failedState,
        "chore(catalog): record promote failure",
      );
    } catch {
      // ignore
    }

    throw promoteError;
  } finally {
    releasePromoteLock(token);
  }
}

export async function discardCatalogWorkingChanges(input: {
  actor: string;
  confirmText: string;
}): Promise<{
  success: boolean;
  message: string;
  status: CatalogPromoteStatusPayload;
}> {
  if (input.confirmText !== "未反映の変更を破棄") {
    throw new CatalogPromoteError(
      '確認のため「未反映の変更を破棄」と入力してください。',
      400,
      {
        errorCode: "CONFIRM_REQUIRED",
        stage: "IDLE",
        retryable: false,
      },
    );
  }

  const lock = tryAcquirePromoteLock("MERGING");
  if (!lock.ok) {
    throw new CatalogPromoteError(
      "本番反映またはデプロイが既に実行中です。",
      409,
      {
        errorCode: "IN_PROGRESS",
        stage: lock.status,
        retryable: true,
      },
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

    const previous = await readPersistedState();
    const cleared: CatalogPromotePersistedState = {
      ...defaultPersistedState(),
      status: "IDLE",
      lastPromoteAt: previous.lastPromoteAt,
      lastPromoteSha: previous.lastPromoteSha,
    };
    await writePersistedState(cleared);
    void CATALOG_PROMOTE_AUDIT_PATH;

    return {
      success: true,
      message:
        "作業用ブランチを Production の状態へ戻しました。Production デプロイは発生していません。",
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
