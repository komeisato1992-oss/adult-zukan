import "server-only";

import { getGitHubConfig } from "@/lib/admin/github-config";
import { readCatalogSnapshot } from "@/lib/dmm/catalog-snapshot";
import {
  buildCatalogOutput,
  CATALOG_SNAPSHOT_RELATIVE_PATH,
  logCatalogSnapshotDebug,
  logCatalogSnapshotThrownError,
  parseCatalogSnapshot,
  parseJsonMaybe,
  serializeCatalogSnapshot,
  type CatalogSnapshotEnvelope,
} from "@/lib/dmm/catalog-snapshot-json";
import type { DmmItem } from "@/lib/dmm/types";

const CATALOG_FILE_PATH = CATALOG_SNAPSHOT_RELATIVE_PATH;
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

export class GitHubCatalogError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "GitHubCatalogError";
    this.status = status;
  }
}

export type CatalogSnapshotHandle = {
  items: DmmItem[];
  sha: string | null;
  envelope: CatalogSnapshotEnvelope;
  raw: unknown;
  rebuilt: boolean;
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

async function githubRequest<T>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const config = getGitHubConfig();
  if (!config) {
    throw new GitHubCatalogError("GitHub連携の設定が未完了です。", 503);
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
    if (response.status === 404) {
      throw new GitHubCatalogError(
        "catalog-snapshot.json が GitHub 上に見つかりません。",
        404,
      );
    }

    if (response.status === 409 || response.status === 422) {
      throw new GitHubCatalogError(
        "カタログ更新が競合しました。しばらく待ってから再度お試しください。",
        409,
      );
    }

    throw new GitHubCatalogError(
      "GitHub API からカタログを取得・更新できませんでした。",
      response.status >= 500 ? 502 : 500,
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
  // 1MB超のファイルは Contents API の content が欠落/不完全になりやすいため、
  // download_url → blob API の順で生テキストを取得する。
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
      const blob = await githubRequest<GitHubBlobResponse>(getBlobUrl(meta.sha));
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

  let meta: GitHubFileResponse;
  try {
    meta = await githubRequest<GitHubFileResponse>(
      `${getContentsUrl(CATALOG_FILE_PATH)}?ref=${encodeURIComponent(config.branch)}`,
    );
  } catch (error) {
    if (error instanceof GitHubCatalogError && error.status === 404) {
      console.warn(
        "catalog-snapshot.json not found on GitHub. Starting with empty works.",
      );
      return {
        items: [],
        sha: null,
        envelope: { format: "rebuilt" },
        raw: { works: [] },
        rebuilt: true,
      };
    }
    logCatalogSnapshotThrownError(error);
    throw error;
  }

  const text = await readCatalogFileText(meta);
  let raw = parseJsonMaybe(text);

  console.error("catalog-snapshot debug:", {
    type: typeof raw,
    isArray: Array.isArray(raw),
    keys: raw && typeof raw === "object" ? Object.keys(raw as object) : null,
    sample: Array.isArray(raw) ? (raw as unknown[])[0] : raw,
    size: meta.size ?? null,
    hasInlineContent: Boolean(meta.content),
    hasDownloadUrl: Boolean(meta.download_url),
  });

  let { items, envelope, rebuilt } = parseCatalogSnapshot(raw);

  // GitHub側の読み取りが空なのにファイルサイズが大きい場合は、
  // ローカル snapshot をフォールバックして既存カタログを消さない。
  if (items.length === 0 && (meta.size ?? 0) > 1024 * 100) {
    const localItems = readCatalogSnapshot();
    if (localItems.length > 0) {
      console.warn(
        "catalog-snapshot GitHub parse returned empty; falling back to local snapshot.",
        { githubSize: meta.size, localCount: localItems.length },
      );
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

type GitBlobResponse = {
  sha: string;
};

type GitTreeResponse = {
  sha: string;
};

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
  return commitLabel.startsWith("Add ")
    ? commitLabel
    : `Add work ${commitLabel} via admin import`;
}

async function getBranchHead(): Promise<{ commitSha: string; treeSha: string }> {
  const config = getGitHubConfig();
  if (!config) {
    throw new GitHubCatalogError("GitHub連携の設定が未完了です。", 503);
  }

  const ref = await githubRequest<GitRefResponse>(
    `https://api.github.com/repos/${config.owner}/${config.repo}/git/ref/heads/${encodeURIComponent(config.branch)}`,
  );

  const commit = await githubRequest<GitCommitResponse>(
    `https://api.github.com/repos/${config.owner}/${config.repo}/git/commits/${ref.object.sha}`,
  );

  return {
    commitSha: ref.object.sha,
    treeSha: commit.tree.sha,
  };
}

async function createGitBlob(content: string): Promise<string> {
  const config = getGitHubConfig();
  if (!config) {
    throw new GitHubCatalogError("GitHub連携の設定が未完了です。", 503);
  }

  const blob = await githubRequest<GitBlobResponse>(
    `https://api.github.com/repos/${config.owner}/${config.repo}/git/blobs`,
    {
      method: "POST",
      body: JSON.stringify({
        content,
        encoding: "utf-8",
      }),
    },
  );

  return blob.sha;
}

export async function getBranchHeadSha(): Promise<string | null> {
  try {
    const { commitSha } = await getBranchHead();
    return commitSha;
  } catch {
    return null;
  }
}

/** catalog + 関連 index を Git Trees API で1コミットにまとめて更新する */
export async function commitCatalogBundleToGitHub(
  envelope: CatalogSnapshotEnvelope,
  mergedItems: DmmItem[],
  commitLabel: string,
  indexFiles: GitHubFileCommit[],
  originalRaw?: unknown,
): Promise<void> {
  const config = getGitHubConfig();
  if (!config) {
    throw new GitHubCatalogError("GitHub連携の設定が未完了です。", 503);
  }

  const files: GitHubFileCommit[] = [
    {
      path: CATALOG_FILE_PATH,
      content: buildCatalogSaveContent(envelope, mergedItems, originalRaw),
    },
    ...indexFiles,
  ];

  const { commitSha, treeSha } = await getBranchHead();

  const treeEntries = await Promise.all(
    files.map(async (file) => ({
      path: file.path,
      mode: "100644" as const,
      type: "blob" as const,
      sha: await createGitBlob(file.content),
    })),
  );

  const newTree = await githubRequest<GitTreeResponse>(
    `https://api.github.com/repos/${config.owner}/${config.repo}/git/trees`,
    {
      method: "POST",
      body: JSON.stringify({
        base_tree: treeSha,
        tree: treeEntries,
      }),
    },
  );

  const newCommit = await githubRequest<GitCommitResponse>(
    `https://api.github.com/repos/${config.owner}/${config.repo}/git/commits`,
    {
      method: "POST",
      body: JSON.stringify({
        message: normalizeCommitMessage(commitLabel),
        tree: newTree.sha,
        parents: [commitSha],
      }),
    },
  );

  try {
    await githubRequest(
      `https://api.github.com/repos/${config.owner}/${config.repo}/git/refs/heads/${encodeURIComponent(config.branch)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          sha: newCommit.sha,
          force: false,
        }),
      },
    );
  } catch (error) {
    if (error instanceof GitHubCatalogError && error.status === 409) {
      throw error;
    }

    logCatalogSnapshotThrownError(error);
    throw new GitHubCatalogError(
      "カタログ更新が競合しました。しばらく待ってから再度お試しください。",
      409,
    );
  }
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
