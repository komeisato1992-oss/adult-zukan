import "server-only";

import { getGitHubConfig } from "@/lib/admin/github-config";
import type { StoredImportCandidate } from "@/lib/admin/import-candidate-types";

const IMPORT_CANDIDATES_FILE_PATH = "data/dmm/import-candidates.json";
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

function parseImportCandidatesJson(raw: string): StoredImportCandidate[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new GitHubImportCandidatesError(
      "import-candidates.json の形式が不正です。",
      500,
    );
  }

  if (!Array.isArray(parsed)) {
    throw new GitHubImportCandidatesError(
      "import-candidates.json の形式が不正です。",
      500,
    );
  }

  return parsed as StoredImportCandidate[];
}

export async function fetchImportCandidatesFromGitHub(): Promise<{
  records: StoredImportCandidate[];
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
      records: parseImportCandidatesJson(decodeGitHubContent(data.content)),
      sha: data.sha,
    };
  } catch (error) {
    if (
      error instanceof GitHubImportCandidatesError &&
      error.status === 404
    ) {
      return { records: [], sha: null };
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

  const content = `${JSON.stringify(records, null, 2)}\n`;
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
