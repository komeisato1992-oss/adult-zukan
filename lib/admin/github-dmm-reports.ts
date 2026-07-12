import "server-only";

import { getGitHubConfig } from "@/lib/admin/github-config";
import {
  createEmptyDmmReportsDocument,
  parseDmmReportsDocument,
  serializeDmmReportsDocument,
} from "@/lib/admin/dmm-report-parse";
import type { DmmReportsDocument } from "@/lib/admin/dmm-report-types";

const DMM_REPORTS_FILE_PATH = "data/admin/dmm-reports.json";
const GITHUB_API_VERSION = "2022-11-28";

type GitHubFileResponse = {
  content: string;
  sha: string;
};

export class GitHubDmmReportsError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "GitHubDmmReportsError";
    this.status = status;
  }
}

function getContentsUrl(path: string): string {
  const config = getGitHubConfig();
  if (!config) {
    throw new GitHubDmmReportsError("GitHub連携の設定が未完了です。", 503);
  }
  return `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}`;
}

async function githubRequest<T>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const config = getGitHubConfig();
  if (!config) {
    throw new GitHubDmmReportsError("GitHub連携の設定が未完了です。", 503);
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
      throw new GitHubDmmReportsError(
        "dmm-reports.json が GitHub 上に見つかりません。",
        404,
      );
    }
    if (response.status === 409) {
      throw new GitHubDmmReportsError(
        "DMM成果データの更新が競合しました。再試行してください。",
        409,
      );
    }
    throw new GitHubDmmReportsError(
      "GitHub API から DMM成果データを取得・更新できませんでした。",
      response.status >= 500 ? 502 : 500,
    );
  }

  if (response.status === 204) return {} as T;
  return (await response.json()) as T;
}

function decodeGitHubContent(content: string): string {
  return Buffer.from(content, "base64").toString("utf-8");
}

function encodeGitHubContent(content: string): string {
  return Buffer.from(content, "utf-8").toString("base64");
}

export async function fetchDmmReportsFromGitHub(): Promise<{
  document: DmmReportsDocument;
  sha: string | null;
}> {
  const config = getGitHubConfig();
  if (!config) {
    throw new GitHubDmmReportsError("GitHub連携の設定が未完了です。", 503);
  }

  try {
    const data = await githubRequest<GitHubFileResponse>(
      `${getContentsUrl(DMM_REPORTS_FILE_PATH)}?ref=${encodeURIComponent(config.branch)}`,
    );
    return {
      document: parseDmmReportsDocument(decodeGitHubContent(data.content)),
      sha: data.sha,
    };
  } catch (error) {
    if (error instanceof GitHubDmmReportsError && error.status === 404) {
      return { document: createEmptyDmmReportsDocument(), sha: null };
    }
    throw error;
  }
}

export async function commitDmmReportsToGitHub(
  document: DmmReportsDocument,
  sha: string | null,
  message: string,
): Promise<void> {
  const config = getGitHubConfig();
  if (!config) {
    throw new GitHubDmmReportsError("GitHub連携の設定が未完了です。", 503);
  }

  const body: Record<string, string> = {
    message,
    content: encodeGitHubContent(serializeDmmReportsDocument(document)),
    branch: config.branch,
  };
  if (sha) body.sha = sha;

  await githubRequest(`${getContentsUrl(DMM_REPORTS_FILE_PATH)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}
