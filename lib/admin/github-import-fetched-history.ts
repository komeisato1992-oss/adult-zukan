import "server-only";

import { getGitHubConfig } from "@/lib/admin/github-config";
import {
  createEmptyFetchedHistory,
  parseFetchedHistory,
  serializeFetchedHistory,
  type ImportFetchedHistory,
} from "@/lib/admin/import-fetched-history";
import { IMPORT_FETCHED_HISTORY_RELATIVE_PATH } from "@/lib/admin/import-fetched-history-path";

const FILE_PATH = IMPORT_FETCHED_HISTORY_RELATIVE_PATH;
const GITHUB_API_VERSION = "2022-11-28";

type GitHubFileResponse = {
  content?: string;
  sha: string;
};

export class GitHubFetchedHistoryError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "GitHubFetchedHistoryError";
    this.status = status;
  }
}

function getContentsUrl(path: string): string {
  const config = getGitHubConfig();
  if (!config) {
    throw new GitHubFetchedHistoryError("GitHub連携の設定が未完了です。", 503);
  }

  return `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}`;
}

async function githubRequest<T>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const config = getGitHubConfig();
  if (!config) {
    throw new GitHubFetchedHistoryError("GitHub連携の設定が未完了です。", 503);
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
      throw new GitHubFetchedHistoryError(
        "import-fetched-history.json が GitHub 上に見つかりません。",
        404,
      );
    }

    if (response.status === 409) {
      throw new GitHubFetchedHistoryError(
        "取得履歴の更新が競合しました。しばらく待ってから再度お試しください。",
        409,
      );
    }

    throw new GitHubFetchedHistoryError(
      "GitHub API から取得履歴を取得・更新できませんでした。",
      response.status >= 500 ? 502 : 500,
    );
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

export async function fetchFetchedHistoryFromGitHub(): Promise<{
  history: ImportFetchedHistory;
  sha: string | null;
}> {
  const config = getGitHubConfig();
  if (!config) {
    throw new GitHubFetchedHistoryError("GitHub連携の設定が未完了です。", 503);
  }

  try {
    const data = await githubRequest<GitHubFileResponse>(
      `${getContentsUrl(FILE_PATH)}?ref=${encodeURIComponent(config.branch)}`,
    );

    const content = data.content
      ? Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8")
      : "{}";

    return {
      history: parseFetchedHistory(JSON.parse(content)),
      sha: data.sha,
    };
  } catch (error) {
    if (error instanceof GitHubFetchedHistoryError && error.status === 404) {
      return { history: createEmptyFetchedHistory(), sha: null };
    }
    throw error;
  }
}

export async function commitFetchedHistoryToGitHub(
  history: ImportFetchedHistory,
  sha: string | null,
  message: string,
): Promise<void> {
  const config = getGitHubConfig();
  if (!config) {
    throw new GitHubFetchedHistoryError("GitHub連携の設定が未完了です。", 503);
  }

  const body: Record<string, unknown> = {
    message,
    content: Buffer.from(serializeFetchedHistory(history), "utf-8").toString(
      "base64",
    ),
    branch: config.branch,
  };

  if (sha) {
    body.sha = sha;
  }

  await githubRequest(getContentsUrl(FILE_PATH), {
    method: "PUT",
    body: JSON.stringify(body),
  });
}
