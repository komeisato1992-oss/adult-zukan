import "server-only";

import { getGitHubConfig } from "@/lib/admin/github-config";
import {
  parseSnsPostHistoryJson,
  serializeSnsPostHistory,
  SnsPostHistoryJsonError,
} from "@/lib/admin/sns-post-history-json";
import type { SnsPostHistoryEntry } from "@/lib/admin/sns-post-history-types";

const SNS_POST_HISTORY_FILE_PATH = "data/admin/sns-post-history.json";
const GITHUB_API_VERSION = "2022-11-28";

type GitHubFileResponse = {
  content: string;
  sha: string;
};

export class GitHubSnsPostHistoryError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "GitHubSnsPostHistoryError";
    this.status = status;
  }
}

function getContentsUrl(path: string): string {
  const config = getGitHubConfig();
  if (!config) {
    throw new GitHubSnsPostHistoryError("GitHub連携の設定が未完了です。", 503);
  }

  return `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}`;
}

async function githubRequest<T>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const config = getGitHubConfig();
  if (!config) {
    throw new GitHubSnsPostHistoryError("GitHub連携の設定が未完了です。", 503);
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
      throw new GitHubSnsPostHistoryError(
        "sns-post-history.json が GitHub 上に見つかりません。",
        404,
      );
    }

    if (response.status === 409) {
      throw new GitHubSnsPostHistoryError(
        "投稿履歴の更新が競合しました。しばらく待ってから再度お試しください。",
        409,
      );
    }

    throw new GitHubSnsPostHistoryError(
      "GitHub API から投稿履歴を取得・更新できませんでした。",
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

export async function fetchSnsPostHistoryFromGitHub(): Promise<{
  records: SnsPostHistoryEntry[];
  sha: string | null;
}> {
  const config = getGitHubConfig();
  if (!config) {
    throw new GitHubSnsPostHistoryError("GitHub連携の設定が未完了です。", 503);
  }

  try {
    const data = await githubRequest<GitHubFileResponse>(
      `${getContentsUrl(SNS_POST_HISTORY_FILE_PATH)}?ref=${encodeURIComponent(config.branch)}`,
    );

    return {
      records: parseSnsPostHistoryJson(decodeGitHubContent(data.content)),
      sha: data.sha,
    };
  } catch (error) {
    if (
      error instanceof GitHubSnsPostHistoryError &&
      error.status === 404
    ) {
      return { records: [], sha: null };
    }

    if (error instanceof SnsPostHistoryJsonError) {
      throw new GitHubSnsPostHistoryError(error.message, error.status);
    }

    throw error;
  }
}

export async function commitSnsPostHistoryToGitHub(
  records: SnsPostHistoryEntry[],
  sha: string | null,
  message: string,
): Promise<void> {
  const config = getGitHubConfig();
  if (!config) {
    throw new GitHubSnsPostHistoryError("GitHub連携の設定が未完了です。", 503);
  }

  const content = serializeSnsPostHistory(records);
  const body: Record<string, string> = {
    message,
    content: encodeGitHubContent(content),
    branch: config.branch,
  };

  if (sha) {
    body.sha = sha;
  }

  await githubRequest(`${getContentsUrl(SNS_POST_HISTORY_FILE_PATH)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}
