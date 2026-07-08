import "server-only";

import { getGitHubConfig } from "@/lib/admin/github-config";
import type { DmmItem } from "@/lib/dmm/types";

const CATALOG_FILE_PATH = "data/dmm/catalog-snapshot.json";
const GITHUB_API_VERSION = "2022-11-28";

type GitHubFileResponse = {
  content: string;
  sha: string;
};

export class GitHubCatalogError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "GitHubCatalogError";
    this.status = status;
  }
}

function getContentsUrl(path: string): string {
  const config = getGitHubConfig();
  if (!config) {
    throw new GitHubCatalogError("GitHub連携の設定が未完了です。", 503);
  }

  return `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}`;
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

    if (response.status === 409) {
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

function decodeGitHubContent(content: string): string {
  return Buffer.from(content, "base64").toString("utf-8");
}

function encodeGitHubContent(content: string): string {
  return Buffer.from(content, "utf-8").toString("base64");
}

export async function fetchCatalogFromGitHub(): Promise<{
  items: DmmItem[];
  sha: string;
}> {
  const config = getGitHubConfig();
  if (!config) {
    throw new GitHubCatalogError("GitHub連携の設定が未完了です。", 503);
  }

  const data = await githubRequest<GitHubFileResponse>(
    `${getContentsUrl(CATALOG_FILE_PATH)}?ref=${encodeURIComponent(config.branch)}`,
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeGitHubContent(data.content));
  } catch {
    throw new GitHubCatalogError("catalog-snapshot.json の形式が不正です。", 500);
  }

  if (!Array.isArray(parsed)) {
    throw new GitHubCatalogError("catalog-snapshot.json の形式が不正です。", 500);
  }

  return {
    items: parsed as DmmItem[],
    sha: data.sha,
  };
}

export async function commitCatalogToGitHub(
  items: DmmItem[],
  sha: string,
  commitLabel: string,
): Promise<void> {
  const config = getGitHubConfig();
  if (!config) {
    throw new GitHubCatalogError("GitHub連携の設定が未完了です。", 503);
  }

  const content = `${JSON.stringify(items, null, 2)}\n`;

  await githubRequest(`${getContentsUrl(CATALOG_FILE_PATH)}`, {
    method: "PUT",
    body: JSON.stringify({
      message: commitLabel.startsWith("Add ")
        ? commitLabel
        : `Add work ${commitLabel} via admin import`,
      content: encodeGitHubContent(content),
      sha,
      branch: config.branch,
    }),
  });
}
