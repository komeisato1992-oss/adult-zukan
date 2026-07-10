import "server-only";

import { getGitHubConfig } from "@/lib/admin/github-config";
import {
  ImportCandidatesJsonCorruptError,
  ImportCandidatesJsonError,
  parseImportCandidatesJson,
  serializeImportCandidates,
} from "@/lib/admin/import-candidates-json";
import type { StoredImportCandidate } from "@/lib/admin/import-candidate-types";
import { IMPORT_CANDIDATES_RELATIVE_PATH } from "@/lib/admin/import-candidates-path";
import { IMPORT_COLLECTION_STATE_RELATIVE_PATH } from "@/lib/admin/import-collection-state-path";
import {
  createDefaultImportCollectionState,
  parseImportCollectionState,
  serializeImportCollectionState,
  type ImportCollectionState,
} from "@/lib/admin/import-collection-state";
import { IMPORT_COLLECT_PAGE_SIZE } from "@/lib/admin/import-constants";

const IMPORT_CANDIDATES_FILE_PATH = IMPORT_CANDIDATES_RELATIVE_PATH;
const IMPORT_COLLECTION_STATE_FILE_PATH = IMPORT_COLLECTION_STATE_RELATIVE_PATH;
const GITHUB_API_VERSION = "2022-11-28";

type GitHubFileResponse = {
  content: string;
  sha: string;
};

export class GitHubImportCandidatesError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "GitHubImportCandidatesError";
    this.status = status;
  }
}

function getContentsUrl(path: string): string {
  const config = getGitHubConfig();
  if (!config) {
    throw new GitHubImportCandidatesError("GitHub連携の設定が未完了です。", 503);
  }

  return `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}`;
}

async function githubRequest<T>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const config = getGitHubConfig();
  if (!config) {
    throw new GitHubImportCandidatesError("GitHub連携の設定が未完了です。", 503);
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
      throw new GitHubImportCandidatesError(
        "import-candidates.json が GitHub 上に見つかりません。",
        404,
      );
    }

    if (response.status === 409) {
      throw new GitHubImportCandidatesError(
        "候補データ更新が競合しました。しばらく待ってから再度お試しください。",
        409,
      );
    }

    throw new GitHubImportCandidatesError(
      "GitHub API から候補データを取得・更新できませんでした。",
      response.status >= 500 ? 502 : 500,
    );
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

function decodeGitHubContent(content: string): string {
  return Buffer.from(content, "base64").toString("utf-8");
}

function encodeGitHubContent(content: string): string {
  return Buffer.from(content, "utf-8").toString("base64");
}

export async function fetchImportCandidatesRawFromGitHub(): Promise<{
  content: string;
  sha: string | null;
}> {
  const config = getGitHubConfig();
  if (!config) {
    throw new GitHubImportCandidatesError("GitHub連携の設定が未完了です。", 503);
  }

  try {
    const data = await githubRequest<GitHubFileResponse>(
      `${getContentsUrl(IMPORT_CANDIDATES_FILE_PATH)}?ref=${encodeURIComponent(config.branch)}`,
    );

    return {
      content: decodeGitHubContent(data.content),
      sha: data.sha,
    };
  } catch (error) {
    if (
      error instanceof GitHubImportCandidatesError &&
      error.status === 404
    ) {
      return { content: "[]", sha: null };
    }

    throw error;
  }
}

export async function fetchImportCandidatesFromGitHub(): Promise<{
  records: StoredImportCandidate[];
  sha: string | null;
}> {
  const { content, sha } = await fetchImportCandidatesRawFromGitHub();

  try {
    return {
      records: parseImportCandidatesJson(content),
      sha,
    };
  } catch (error) {
    if (error instanceof ImportCandidatesJsonCorruptError) {
      throw error;
    }

    if (error instanceof ImportCandidatesJsonError) {
      throw new GitHubImportCandidatesError(error.message, error.status);
    }

    throw error;
  }
}

export async function commitImportCandidatesToGitHub(
  records: StoredImportCandidate[],
  sha: string | null,
  message: string,
): Promise<void> {
  const config = getGitHubConfig();
  if (!config) {
    throw new GitHubImportCandidatesError("GitHub連携の設定が未完了です。", 503);
  }

  const content = serializeImportCandidates(records);
  const body: Record<string, string> = {
    message,
    content: encodeGitHubContent(content),
    branch: config.branch,
  };

  if (sha) {
    body.sha = sha;
  }

  await githubRequest(`${getContentsUrl(IMPORT_CANDIDATES_FILE_PATH)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

type GitRefResponse = {
  object: { sha: string };
};

type GitCommitResponse = {
  sha: string;
  tree: { sha: string };
};

type GitTreeResponse = {
  sha: string;
};

type GitBlobResponse = {
  sha: string;
};

async function getBranchHead(): Promise<{
  commitSha: string;
  treeSha: string;
}> {
  const config = getGitHubConfig();
  if (!config) {
    throw new GitHubImportCandidatesError("GitHub連携の設定が未完了です。", 503);
  }

  const ref = await githubRequest<GitRefResponse>(
    `https://api.github.com/repos/${config.owner}/${config.repo}/git/refs/heads/${encodeURIComponent(config.branch)}`,
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
    throw new GitHubImportCandidatesError("GitHub連携の設定が未完了です。", 503);
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

export async function fetchImportCollectionStateFromGitHub(): Promise<{
  state: ImportCollectionState;
  sha: string | null;
}> {
  const config = getGitHubConfig();
  if (!config) {
    throw new GitHubImportCandidatesError("GitHub連携の設定が未完了です。", 503);
  }

  try {
    const data = await githubRequest<GitHubFileResponse>(
      `${getContentsUrl(IMPORT_COLLECTION_STATE_FILE_PATH)}?ref=${encodeURIComponent(config.branch)}`,
    );

    return {
      state: parseImportCollectionState(
        JSON.parse(decodeGitHubContent(data.content)) as unknown,
        IMPORT_COLLECT_PAGE_SIZE,
      ),
      sha: data.sha,
    };
  } catch (error) {
    if (
      error instanceof GitHubImportCandidatesError &&
      error.status === 404
    ) {
      return {
        state: createDefaultImportCollectionState(IMPORT_COLLECT_PAGE_SIZE),
        sha: null,
      };
    }

    throw error;
  }
}

/** import-candidates.json と import-collection-state.json を1コミットで更新 */
export async function commitImportDataBundleToGitHub(
  records: StoredImportCandidate[],
  candidatesSha: string | null,
  state: ImportCollectionState,
  stateSha: string | null,
  message: string,
): Promise<void> {
  const config = getGitHubConfig();
  if (!config) {
    throw new GitHubImportCandidatesError("GitHub連携の設定が未完了です。", 503);
  }

  void candidatesSha;
  void stateSha;

  const files = [
    {
      path: IMPORT_CANDIDATES_FILE_PATH,
      content: serializeImportCandidates(records),
    },
    {
      path: IMPORT_COLLECTION_STATE_FILE_PATH,
      content: serializeImportCollectionState(state),
    },
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
        message,
        tree: newTree.sha,
        parents: [commitSha],
      }),
    },
  );

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
}
