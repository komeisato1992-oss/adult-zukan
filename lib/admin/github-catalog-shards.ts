import "server-only";

import {
  commitGitDataBundle,
  GitHubCatalogError,
  type GitHubFileCommit,
} from "@/lib/admin/github-catalog";
import { getGitHubConfig } from "@/lib/admin/github-config";
import { buildCatalogIdSet, dedupeCatalogWorks } from "@/lib/dmm/catalog-dedupe";
import { logCatalogSnapshotThrownError } from "@/lib/dmm/catalog-snapshot-json";
import {
  appendWorksToCatalogShards,
  CATALOG_MANIFEST_RELATIVE,
  CATALOG_SHARD_DIR_RELATIVE,
  CATALOG_SHARD_VERSION,
  DEFAULT_CATALOG_SHARD_SIZE,
  diffCatalogShardsByItems,
  formatShardFileName,
  serializeCatalogShardJson,
  shardRelativePath,
  type CatalogAppendResult,
  type CatalogManifest,
} from "@/lib/dmm/catalog-shards";
import { normalizeCatalogSnapshot } from "@/lib/dmm/catalog-snapshot-json";
import type { DmmItem } from "@/lib/dmm/types";

const GITHUB_API_VERSION = "2022-11-28";

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

export type CatalogShardsHandle = {
  manifest: CatalogManifest;
  items: DmmItem[];
  catalogKeys: Set<string>;
  lastShardFile: string | null;
  lastShardWorks: DmmItem[];
};

export type CommitCatalogShardsResult = {
  append: CatalogAppendResult;
  totalCount: number;
  filesCommitted: string[];
};

function getRepoApiBase(): string {
  const config = getGitHubConfig();
  if (!config) {
    throw new GitHubCatalogError("GitHub連携の設定が未完了です。", 503);
  }
  return `https://api.github.com/repos/${config.owner}/${config.repo}`;
}

function getContentsUrl(path: string): string {
  const config = getGitHubConfig();
  if (!config) {
    throw new GitHubCatalogError("GitHub連携の設定が未完了です。", 503);
  }
  return `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}`;
}

function getBlobUrl(sha: string): string {
  return `${getRepoApiBase()}/git/blobs/${sha}`;
}

function decodeBase64Content(content: string): string {
  return Buffer.from(content.replace(/\n/g, ""), "base64").toString("utf-8");
}

async function githubRequest<T>(
  url: string,
  init: RequestInit = {},
  phase: string = "fetch-ref",
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
      // keep raw
    }

    console.error("[github catalog shards failed]", {
      phase,
      status: response.status,
      url,
      githubMessage,
      body: responseBody.slice(0, 2000),
    });

    throw new GitHubCatalogError(
      githubMessage
        ? `${phase} failed: ${githubMessage}`
        : `${phase} failed`,
      response.status === 404
        ? 404
        : response.status >= 500
          ? 502
          : response.status,
      { phase, responseBody, githubMessage, documentationUrl },
    );
  }

  if (response.status === 204) return {} as T;
  return (await response.json()) as T;
}

async function readFileText(meta: GitHubFileResponse): Promise<string> {
  if (meta.download_url) {
    try {
      const response = await fetch(meta.download_url, { cache: "no-store" });
      if (response.ok) return await response.text();
    } catch (error) {
      logCatalogSnapshotThrownError(error);
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
      if (typeof blob.content === "string") return blob.content;
    } catch (error) {
      logCatalogSnapshotThrownError(error);
    }
  }

  if (meta.content) return decodeBase64Content(meta.content);
  return "[]";
}

function emptyManifest(): CatalogManifest {
  return {
    version: CATALOG_SHARD_VERSION,
    totalCount: 0,
    shardSize: DEFAULT_CATALOG_SHARD_SIZE,
    updatedAt: new Date().toISOString(),
    shards: [],
  };
}

function parseManifest(raw: unknown): CatalogManifest {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return emptyManifest();
  }

  const record = raw as Record<string, unknown>;
  const shards = Array.isArray(record.shards)
    ? record.shards.map((entry) => {
        const item = entry as { file?: string; count?: number };
        return {
          file: String(item.file ?? ""),
          count: Number(item.count) || 0,
        };
      }).filter((entry) => entry.file)
    : [];

  return {
    version: Number(record.version) || CATALOG_SHARD_VERSION,
    totalCount: Number(record.totalCount) || 0,
    shardSize:
      Number(record.shardSize) > 0
        ? Number(record.shardSize)
        : DEFAULT_CATALOG_SHARD_SIZE,
    updatedAt: String(record.updatedAt ?? new Date().toISOString()),
    shards,
  };
}

export async function fetchCatalogManifestFromGitHub(): Promise<CatalogManifest> {
  const config = getGitHubConfig();
  if (!config) {
    throw new GitHubCatalogError("GitHub連携の設定が未完了です。", 503);
  }

  try {
    const meta = await githubRequest<GitHubFileResponse>(
      `${getContentsUrl(CATALOG_MANIFEST_RELATIVE)}?ref=${encodeURIComponent(config.branch)}`,
      {},
      "fetch-ref",
    );
    const text = await readFileText(meta);
    return parseManifest(JSON.parse(text));
  } catch (error) {
    if (error instanceof GitHubCatalogError && error.status === 404) {
      return emptyManifest();
    }
    throw error;
  }
}

export async function fetchCatalogShardFromGitHub(
  file: string,
): Promise<DmmItem[]> {
  const config = getGitHubConfig();
  if (!config) {
    throw new GitHubCatalogError("GitHub連携の設定が未完了です。", 503);
  }

  const relative = shardRelativePath(file);
  try {
    const meta = await githubRequest<GitHubFileResponse>(
      `${getContentsUrl(relative)}?ref=${encodeURIComponent(config.branch)}`,
      {},
      "fetch-ref",
    );
    const text = await readFileText(meta);
    const raw = JSON.parse(text);
    if (!Array.isArray(raw)) {
      throw new GitHubCatalogError(
        `shard ${file} は配列形式である必要があります。`,
        500,
        { phase: "fetch-commit" },
      );
    }
    return normalizeCatalogSnapshot(raw);
  } catch (error) {
    if (error instanceof GitHubCatalogError && error.status === 404) {
      return [];
    }
    throw error;
  }
}

/** 全 shard を読み、ID Set と最終 shard を返す（管理画面の追加処理用） */
export async function fetchCatalogShardsFromGitHub(): Promise<CatalogShardsHandle> {
  const manifest = await fetchCatalogManifestFromGitHub();

  if (manifest.shards.length === 0) {
    return {
      manifest,
      items: [],
      catalogKeys: new Set(),
      lastShardFile: null,
      lastShardWorks: [],
    };
  }

  const items: DmmItem[] = [];
  /** @type {DmmItem[][]} */
  const shardWorksList: DmmItem[][] = [];
  for (const entry of manifest.shards) {
    const works = await fetchCatalogShardFromGitHub(entry.file);
    shardWorksList.push(works);
    items.push(...works);
  }

  const deduped = dedupeCatalogWorks(items).items;
  const lastMeta = manifest.shards[manifest.shards.length - 1];
  const lastShardWorks = shardWorksList[shardWorksList.length - 1] ?? [];

  return {
    manifest,
    items: deduped,
    catalogKeys: buildCatalogIdSet(deduped),
    lastShardFile: lastMeta?.file ?? null,
    lastShardWorks,
  };
}

export function buildShardCommitFiles(
  append: CatalogAppendResult,
  indexFiles: GitHubFileCommit[] = [],
): GitHubFileCommit[] {
  const files: GitHubFileCommit[] = [
    {
      path: CATALOG_MANIFEST_RELATIVE,
      content: serializeCatalogShardJson(append.manifest),
    },
    ...append.changedShards.map((shard) => ({
      path: shardRelativePath(shard.file),
      content: serializeCatalogShardJson(shard.works),
    })),
    ...indexFiles,
  ];

  for (const file of files) {
    const bytes = Buffer.byteLength(file.content, "utf8");
    console.log("[github-commit] shard file", {
      path: file.path,
      bytes,
      mb: (bytes / 1024 / 1024).toFixed(2),
    });
    if (bytes > 50 * 1024 * 1024) {
      throw new GitHubCatalogError(
        `ファイルが大きすぎます: ${file.path} (${(bytes / 1024 / 1024).toFixed(1)}MB)`,
        422,
        { phase: "create-catalog-blob" },
      );
    }
  }

  return files;
}

/** 変更 shard + manifest (+ index) だけを 1 commit で保存 */
export async function commitCatalogShardAppendToGitHub(input: {
  manifest: CatalogManifest;
  lastShardWorks: DmmItem[];
  newWorks: DmmItem[];
  commitLabel: string;
  indexFiles?: GitHubFileCommit[];
}): Promise<CommitCatalogShardsResult> {
  const append = appendWorksToCatalogShards(
    input.manifest,
    input.lastShardWorks,
    input.newWorks,
  );

  const files = buildShardCommitFiles(append, input.indexFiles ?? []);

  console.log("[github-commit] shard append", {
    updatedShards: append.updatedShardFiles,
    newShards: append.newShardFiles,
    totalCount: append.manifest.totalCount,
    fileCount: files.length,
    api: "git-data",
  });

  await commitGitDataBundle(files, input.commitLabel);

  return {
    append,
    totalCount: append.manifest.totalCount,
    filesCommitted: files.map((file) => file.path),
  };
}

/** 全作品を shard へ再分割して commit（同期・リフレッシュ用。単一巨大 JSON は作らない） */
export async function commitFullCatalogAsShardsToGitHub(
  works: DmmItem[],
  commitLabel: string,
  indexFiles: GitHubFileCommit[] = [],
  shardSize = DEFAULT_CATALOG_SHARD_SIZE,
): Promise<CatalogManifest> {
  const deduped = dedupeCatalogWorks(works).items;
  const shardEntries: Array<{ file: string; works: DmmItem[]; count: number }> =
    [];

  for (let offset = 0; offset < deduped.length; offset += shardSize) {
    const chunk = deduped.slice(offset, offset + shardSize);
    shardEntries.push({
      file: formatShardFileName(shardEntries.length + 1),
      works: chunk,
      count: chunk.length,
    });
  }

  if (shardEntries.length === 0) {
    shardEntries.push({
      file: formatShardFileName(1),
      works: [],
      count: 0,
    });
  }

  const manifest: CatalogManifest = {
    version: CATALOG_SHARD_VERSION,
    totalCount: deduped.length,
    shardSize,
    updatedAt: new Date().toISOString(),
    shards: shardEntries.map((entry) => ({
      file: entry.file,
      count: entry.count,
    })),
  };

  const files: GitHubFileCommit[] = [
    {
      path: CATALOG_MANIFEST_RELATIVE,
      content: serializeCatalogShardJson(manifest),
    },
    ...shardEntries.map((entry) => ({
      path: `${CATALOG_SHARD_DIR_RELATIVE}/${entry.file}`,
      content: serializeCatalogShardJson(entry.works),
    })),
    ...indexFiles,
  ];

  for (const file of files) {
    const bytes = Buffer.byteLength(file.content, "utf8");
    if (bytes > 50 * 1024 * 1024) {
      throw new GitHubCatalogError(
        `ファイルが大きすぎます: ${file.path}`,
        422,
        { phase: "create-catalog-blob" },
      );
    }
  }

  console.log("[github-commit] full shard rewrite", {
    shardCount: shardEntries.length,
    totalCount: manifest.totalCount,
    fileCount: files.length,
  });

  await commitGitDataBundle(files, commitLabel);
  return manifest;
}

/**
 * 差分のあるシャードだけを commit。件数構成が変わった場合はフル再分割へフォールバック。
 */
export async function commitChangedCatalogShardsToGitHub(input: {
  previousItems: DmmItem[];
  nextItems: DmmItem[];
  previousManifest: CatalogManifest;
  commitLabel: string;
  indexFiles?: GitHubFileCommit[];
}): Promise<{
  filesCommitted: string[];
  changedShardCount: number;
  fullRewrite: boolean;
}> {
  const prev = dedupeCatalogWorks(input.previousItems).items;
  const next = dedupeCatalogWorks(input.nextItems).items;

  if (prev.length !== next.length) {
    const manifest = await commitFullCatalogAsShardsToGitHub(
      next,
      input.commitLabel,
      input.indexFiles ?? [],
      input.previousManifest.shardSize || DEFAULT_CATALOG_SHARD_SIZE,
    );
    return {
      filesCommitted: [
        CATALOG_MANIFEST_RELATIVE,
        ...manifest.shards.map(
          (s) => `${CATALOG_SHARD_DIR_RELATIVE}/${s.file}`,
        ),
        ...(input.indexFiles ?? []).map((f) => f.path),
      ],
      changedShardCount: manifest.shards.length,
      fullRewrite: true,
    };
  }

  const changed = diffCatalogShardsByItems(input.previousManifest, prev, next);
  if (changed.length === 0 && (input.indexFiles?.length ?? 0) === 0) {
    return { filesCommitted: [], changedShardCount: 0, fullRewrite: false };
  }

  const nextManifest: CatalogManifest = {
    ...input.previousManifest,
    updatedAt: new Date().toISOString(),
    totalCount: next.length,
  };

  const files: GitHubFileCommit[] = [
    {
      path: CATALOG_MANIFEST_RELATIVE,
      content: serializeCatalogShardJson(nextManifest),
    },
    ...changed.map((shard) => ({
      path: shardRelativePath(shard.file),
      content: serializeCatalogShardJson(shard.works),
    })),
    ...(input.indexFiles ?? []),
  ];

  console.log("[github-commit] changed shards only", {
    changedShardCount: changed.length,
    files: files.map((f) => f.path),
    api: "git-data",
  });

  await commitGitDataBundle(files, input.commitLabel);

  return {
    filesCommitted: files.map((f) => f.path),
    changedShardCount: changed.length,
    fullRewrite: false,
  };
}
