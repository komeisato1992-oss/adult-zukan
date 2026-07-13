import "server-only";

import { getGitHubConfig } from "@/lib/admin/github-config";
import { readCatalogSnapshot } from "@/lib/dmm/catalog-snapshot";
import {
  buildCatalogOutput,
  CATALOG_MANIFEST_RELATIVE,
  CATALOG_SHARD_DIR_RELATIVE,
  CATALOG_SNAPSHOT_RELATIVE_PATH,
  logCatalogSnapshotDebug,
  logCatalogSnapshotThrownError,
  parseCatalogSnapshot,
  parseJsonMaybe,
  serializeCatalogSnapshot,
  type CatalogSnapshotEnvelope,
} from "@/lib/dmm/catalog-snapshot-json";
import type { DmmItem } from "@/lib/dmm/types";

/** @deprecated 単一巨大 catalog は使用しない */
const CATALOG_FILE_PATH = CATALOG_SNAPSHOT_RELATIVE_PATH;
const GITHUB_API_VERSION = "2022-11-28";
const GIT_DATA_COMMIT_MAX_RETRIES = 2;
const BLOB_BASE64_THRESHOLD_BYTES = Number(
  process.env.GITHUB_BLOB_BASE64_THRESHOLD_BYTES ?? 1024 * 1024,
);

export type GitDataCommitPhase =
  | "fetch-ref"
  | "fetch-commit"
  | "create-catalog-blob"
  | "create-index-blob"
  | "create-blob"
  | "create-tree"
  | "create-commit"
  | "update-ref";

type GitHubFileResponse = {
  content?: string;
  sha: string;
  size?: number;
  download_url?: string | null;
  encoding?: string;
};

type GitHubBlobResponse = {
  content: string;
  encoding: string;
  sha: string;
  size: number;
};

export class GitHubCatalogError extends Error {
  status: number;
  phase?: GitDataCommitPhase | string;
  responseBody?: string;
  githubMessage?: string;
  documentationUrl?: string;

  constructor(
    message: string,
    status = 500,
    options?: {
      phase?: GitDataCommitPhase | string;
      responseBody?: string;
      githubMessage?: string;
      documentationUrl?: string;
    },
  ) {
    super(message);
    this.name = "GitHubCatalogError";
    this.status = status;
    this.phase = options?.phase;
    this.responseBody = options?.responseBody;
    this.githubMessage = options?.githubMessage;
    this.documentationUrl = options?.documentationUrl;
  }
}

export type CatalogSnapshotHandle = {
  items: DmmItem[];
  sha: string | null;
  envelope: CatalogSnapshotEnvelope;
  raw: unknown;
  rebuilt: boolean;
};

export type GitHubFileCommit = {
  path: string;
  content: string;
};

type GitRefResponse = {
  object: { sha: string };
};

type GitCommitResponse = {
  sha: string;
  tree: { sha: string };
};

type GitBlobCreateResponse = {
  sha: string;
};

type GitTreeResponse = {
  sha: string;
};

function getContentsUrl(path: string): string {
  const config = getGitHubConfig();
  if (!config) {
    throw new GitHubCatalogError("GitHub連携の設定が未完了です。", 503);
  }

  return `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}`;
}

function getBlobUrl(sha: string): string {
  const config = getGitHubConfig();
  if (!config) {
    throw new GitHubCatalogError("GitHub連携の設定が未完了です。", 503);
  }

  return `https://api.github.com/repos/${config.owner}/${config.repo}/git/blobs/${sha}`;
}

function getRepoApiBase(): string {
  const config = getGitHubConfig();
  if (!config) {
    throw new GitHubCatalogError("GitHub連携の設定が未完了です。", 503);
  }

  return `https://api.github.com/repos/${config.owner}/${config.repo}`;
}

function phaseLabel(phase: GitDataCommitPhase | string): string {
  switch (phase) {
    case "fetch-ref":
      return "ブランチ参照の取得";
    case "fetch-commit":
      return "最新コミットの取得";
    case "create-catalog-blob":
      return "カタログ blob の作成";
    case "create-index-blob":
      return "インデックス blob の作成";
    case "create-blob":
      return "blob の作成";
    case "create-tree":
      return "tree の作成";
    case "create-commit":
      return "commit の作成";
    case "update-ref":
      return "ブランチ ref の更新";
    default:
      return String(phase);
  }
}

function buildGitHubErrorMessage(
  phase: GitDataCommitPhase | string,
  githubMessage?: string,
): string {
  const label = phaseLabel(phase);
  if (githubMessage?.includes("too large")) {
    return `${label}に失敗しました。カタログファイルが大きすぎるため GitHub API で処理できません。`;
  }
  if (githubMessage) {
    return `${label}に失敗しました: ${githubMessage}`;
  }
  return `${label}に失敗しました。`;
}

async function githubRequest<T>(
  url: string,
  init: RequestInit = {},
  phase: GitDataCommitPhase | string = "create-blob",
): Promise<T> {
  const config = getGitHubConfig();
  if (!config) {
    throw new GitHubCatalogError("GitHub連携の設定が未完了です。", 503, {
      phase,
    });
  }

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
    const responseBody = await response.text();
    let githubMessage: string | undefined;
    let documentationUrl: string | undefined;

    try {
      const parsed = JSON.parse(responseBody) as {
        message?: string;
        documentation_url?: string;
      };
      githubMessage = parsed.message;
      documentationUrl = parsed.documentation_url;
    } catch {
      // keep raw body
    }

    console.error("[github catalog update failed]", {
      phase,
      status: response.status,
      url,
      githubMessage,
      documentationUrl,
      body: responseBody.slice(0, 4000),
    });

    if (response.status === 404) {
      throw new GitHubCatalogError(
        "catalog-snapshot.json が GitHub 上に見つかりません。",
        404,
        { phase, responseBody, githubMessage, documentationUrl },
      );
    }

    if (response.status === 409 || response.status === 422) {
      throw new GitHubCatalogError(
        buildGitHubErrorMessage(phase, githubMessage),
        response.status,
        { phase, responseBody, githubMessage, documentationUrl },
      );
    }

    throw new GitHubCatalogError(
      buildGitHubErrorMessage(phase, githubMessage),
      response.status >= 500 ? 502 : response.status,
      { phase, responseBody, githubMessage, documentationUrl },
    );
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

function decodeBase64Content(content: string): string {
  return Buffer.from(content.replace(/\n/g, ""), "base64").toString("utf-8");
}

async function readCatalogFileText(
  meta: GitHubFileResponse,
): Promise<string> {
  if (meta.download_url) {
    try {
      const response = await fetch(meta.download_url, { cache: "no-store" });
      if (response.ok) {
        return await response.text();
      }
      console.warn("catalog-snapshot download_url failed:", response.status);
    } catch (error) {
      logCatalogSnapshotThrownError(error);
      console.warn("catalog-snapshot download_url error:", error);
    }
  }

  if (meta.sha) {
    try {
      const blob = await githubRequest<GitHubBlobResponse>(
        getBlobUrl(meta.sha),
        {},
        "fetch-commit",
      );
      if (blob.encoding === "base64" && blob.content) {
        return decodeBase64Content(blob.content);
      }
      if (typeof blob.content === "string") {
        return blob.content;
      }
    } catch (error) {
      logCatalogSnapshotThrownError(error);
      console.warn("catalog-snapshot blob fetch error:", error);
    }
  }

  if (meta.content) {
    return decodeBase64Content(meta.content);
  }

  return "[]";
}

export async function fetchCatalogFromGitHub(): Promise<CatalogSnapshotHandle> {
  const config = getGitHubConfig();
  if (!config) {
    throw new GitHubCatalogError("GitHub連携の設定が未完了です。", 503);
  }

  // shard manifest 優先。未移行の場合のみ legacy 単一ファイルを読む。
  try {
    const { fetchCatalogShardsFromGitHub } = await import(
      "@/lib/admin/github-catalog-shards"
    );
    const shards = await fetchCatalogShardsFromGitHub();
    if (shards.manifest.shards.length > 0 || shards.items.length > 0) {
      return {
        items: shards.items,
        sha: null,
        envelope: { format: "array" },
        raw: shards.items,
        rebuilt: false,
      };
    }
  } catch (error) {
    if (!(error instanceof GitHubCatalogError && error.status === 404)) {
      logCatalogSnapshotThrownError(error);
      // manifest 未作成時は legacy へフォールバック
      if (!(error instanceof GitHubCatalogError)) {
        throw error;
      }
    }
  }

  let meta: GitHubFileResponse;
  try {
    meta = await githubRequest<GitHubFileResponse>(
      `${getContentsUrl(CATALOG_FILE_PATH)}?ref=${encodeURIComponent(config.branch)}`,
      {},
      "fetch-ref",
    );
  } catch (error) {
    if (error instanceof GitHubCatalogError && error.status === 404) {
      const localItems = readCatalogSnapshot();
      console.warn(
        "catalog shards/legacy not found on GitHub. Using local catalog.",
        { localCount: localItems.length },
      );
      return {
        items: localItems,
        sha: null,
        envelope: { format: "array" },
        raw: localItems,
        rebuilt: false,
      };
    }
    logCatalogSnapshotThrownError(error);
    throw error;
  }

  const text = await readCatalogFileText(meta);
  let raw = parseJsonMaybe(text);
  let { items, envelope, rebuilt } = parseCatalogSnapshot(raw);

  if (items.length === 0 && (meta.size ?? 0) > 1024 * 100) {
    const localItems = readCatalogSnapshot();
    if (localItems.length > 0) {
      items = localItems;
      raw = localItems;
      envelope = { format: "array" };
      rebuilt = false;
    } else if (rebuilt) {
      logCatalogSnapshotDebug(raw);
    }
  } else if (rebuilt) {
    logCatalogSnapshotDebug(raw);
  }

  return {
    items,
    sha: meta.sha,
    envelope,
    raw,
    rebuilt,
  };
}

function buildCatalogSaveContent(
  envelope: CatalogSnapshotEnvelope,
  mergedItems: DmmItem[],
  originalRaw?: unknown,
): string {
  const saveData =
    originalRaw !== undefined
      ? buildCatalogOutput(originalRaw, mergedItems)
      : envelope.format === "rebuilt"
        ? buildCatalogOutput({ works: [] }, mergedItems)
        : envelope.format === "array"
          ? mergedItems
          : {
              ...envelope.base,
              [envelope.key]: mergedItems,
              updatedAt: new Date().toISOString(),
            };

  return serializeCatalogSnapshot(saveData);
}

function normalizeCommitMessage(commitLabel: string): string {
  if (
    commitLabel.startsWith("Add ") ||
    commitLabel.startsWith("FANZA ") ||
    commitLabel.startsWith("Refresh ")
  ) {
    return commitLabel;
  }

  return `Add work ${commitLabel} via admin import`;
}

function blobPhaseForPath(path: string): GitDataCommitPhase {
  if (
    path === CATALOG_MANIFEST_RELATIVE ||
    path.startsWith(`${CATALOG_SHARD_DIR_RELATIVE}/`)
  ) {
    return "create-catalog-blob";
  }
  if (path.startsWith("data/dmm/")) return "create-index-blob";
  return "create-blob";
}

async function createGitBlob(
  content: string,
  phase: GitDataCommitPhase,
  path: string,
): Promise<string> {
  const byteLength = Buffer.byteLength(content, "utf8");
  const useBase64 = byteLength >= BLOB_BASE64_THRESHOLD_BYTES;
  const repoBase = getRepoApiBase();

  console.log("[github-commit] create blob", {
    phase,
    path,
    byteLength,
    mb: (byteLength / 1024 / 1024).toFixed(2),
    encoding: useBase64 ? "base64" : "utf-8",
  });

  const blob = await githubRequest<GitBlobCreateResponse>(
    `${repoBase}/git/blobs`,
    {
      method: "POST",
      body: JSON.stringify(
        useBase64
          ? {
              content: Buffer.from(content, "utf8").toString("base64"),
              encoding: "base64",
            }
          : {
              content,
              encoding: "utf-8",
            },
      ),
    },
    phase,
  );

  return blob.sha;
}

async function fetchBranchHead(): Promise<{
  commitSha: string;
  treeSha: string;
}> {
  const config = getGitHubConfig();
  if (!config) {
    throw new GitHubCatalogError("GitHub連携の設定が未完了です。", 503, {
      phase: "fetch-ref",
    });
  }

  const repoBase = getRepoApiBase();
  const ref = await githubRequest<GitRefResponse>(
    `${repoBase}/git/refs/heads/${encodeURIComponent(config.branch)}`,
    {},
    "fetch-ref",
  );

  const commit = await githubRequest<GitCommitResponse>(
    `${repoBase}/git/commits/${ref.object.sha}`,
    {},
    "fetch-commit",
  );

  return {
    commitSha: ref.object.sha,
    treeSha: commit.tree.sha,
  };
}

/** Git Data API で複数ファイルを 1 commit にまとめる（Contents API PUT は使わない） */
export async function commitGitDataBundle(
  files: GitHubFileCommit[],
  commitLabel: string,
): Promise<void> {
  if (files.length === 0) return;

  const config = getGitHubConfig();
  if (!config) {
    throw new GitHubCatalogError(
      "作業用ブランチ (ADULT_CATALOG_WORKING_BRANCH) が未設定です。Production への直接保存は禁止されています。",
      503,
      {
        phase: "fetch-ref",
      },
    );
  }

  // 作業用ブランチが無ければ Production から作成（サーバー側のみ）
  const { ensureCatalogWorkingBranch } = await import(
    "@/lib/admin/catalog-branch"
  );
  await ensureCatalogWorkingBranch();

  const repoBase = getRepoApiBase();
  let retryCount = 0;

  while (retryCount <= GIT_DATA_COMMIT_MAX_RETRIES) {
    try {
      console.time("[github-commit] total");
      console.time("[github-commit] fetch-ref");
      const { commitSha, treeSha } = await fetchBranchHead();
      console.timeEnd("[github-commit] fetch-ref");

      console.time("[github-commit] create-blobs");
      const treeEntries: Array<{
        path: string;
        mode: "100644";
        type: "blob";
        sha: string;
      }> = [];

      for (const file of files) {
        const bytes = Buffer.byteLength(file.content, "utf8");
        if (
          file.path === CATALOG_FILE_PATH ||
          (file.path.endsWith("catalog-snapshot.json") && bytes > 10 * 1024 * 1024)
        ) {
          throw new GitHubCatalogError(
            "単一巨大 catalog-snapshot.json への保存は禁止されています。shard 方式を使用してください。",
            422,
            { phase: "create-catalog-blob" },
          );
        }

        treeEntries.push({
          path: file.path,
          mode: "100644",
          type: "blob",
          sha: await createGitBlob(
            file.content,
            blobPhaseForPath(file.path),
            file.path,
          ),
        });
      }
      console.timeEnd("[github-commit] create-blobs");

      console.time("[github-commit] create-tree");
      const newTree = await githubRequest<GitTreeResponse>(
        `${repoBase}/git/trees`,
        {
          method: "POST",
          body: JSON.stringify({
            base_tree: treeSha,
            tree: treeEntries,
          }),
        },
        "create-tree",
      );
      console.timeEnd("[github-commit] create-tree");

      console.time("[github-commit] create-commit");
      const newCommit = await githubRequest<GitCommitResponse>(
        `${repoBase}/git/commits`,
        {
          method: "POST",
          body: JSON.stringify({
            message: normalizeCommitMessage(commitLabel),
            tree: newTree.sha,
            parents: [commitSha],
          }),
        },
        "create-commit",
      );
      console.timeEnd("[github-commit] create-commit");

      console.time("[github-commit] update-ref");
      await githubRequest(
        `${repoBase}/git/refs/heads/${encodeURIComponent(config.branch)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            sha: newCommit.sha,
            force: false,
          }),
        },
        "update-ref",
      );
      console.timeEnd("[github-commit] update-ref");
      console.timeEnd("[github-commit] total");
      return;
    } catch (error) {
      console.timeEnd("[github-commit] total");

      if (
        error instanceof GitHubCatalogError &&
        (error.status === 409 || error.status === 422) &&
        error.phase === "update-ref" &&
        retryCount < GIT_DATA_COMMIT_MAX_RETRIES
      ) {
        retryCount += 1;
        console.warn("[github-commit] retry after ref conflict", { retryCount });
        continue;
      }

      throw error;
    }
  }
}

/** @deprecated commitGitDataBundle のエイリアス */
export async function commitGitHubFilesBundle(
  files: GitHubFileCommit[],
  commitLabel: string,
): Promise<void> {
  await commitGitDataBundle(files, commitLabel);
}

export async function getBranchHeadSha(): Promise<string | null> {
  try {
    const { commitSha } = await fetchBranchHead();
    return commitSha;
  } catch {
    return null;
  }
}

/**
 * catalog を shard 群として Git Data API で1コミット更新する。
 * 単一巨大 catalog-snapshot.json は絶対に書かない。
 */
export async function commitCatalogBundleToGitHub(
  envelope: CatalogSnapshotEnvelope,
  mergedItems: DmmItem[],
  commitLabel: string,
  indexFiles: GitHubFileCommit[],
  originalRaw?: unknown,
): Promise<void> {
  void envelope;
  void originalRaw;

  const { commitFullCatalogAsShardsToGitHub } = await import(
    "@/lib/admin/github-catalog-shards"
  );

  console.log("[github-commit] rewriting catalog as shards", {
    itemCount: mergedItems.length,
    indexFileCount: indexFiles.length,
    api: "git-data",
  });

  await commitFullCatalogAsShardsToGitHub(
    mergedItems,
    commitLabel,
    indexFiles,
  );
}

export async function commitCatalogToGitHub(
  envelope: CatalogSnapshotEnvelope,
  mergedItems: DmmItem[],
  sha: string | null,
  commitLabel: string,
  originalRaw?: unknown,
): Promise<void> {
  void sha;
  await commitCatalogBundleToGitHub(
    envelope,
    mergedItems,
    commitLabel,
    [],
    originalRaw,
  );
}

export function measureCatalogSaveByteLength(
  envelope: CatalogSnapshotEnvelope,
  mergedItems: DmmItem[],
  originalRaw?: unknown,
): number {
  return Buffer.byteLength(
    buildCatalogSaveContent(envelope, mergedItems, originalRaw),
    "utf8",
  );
}
