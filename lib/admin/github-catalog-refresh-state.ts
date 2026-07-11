import "server-only";

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getGitHubConfig } from "@/lib/admin/github-config";
import {
  createDefaultCatalogRefreshState,
  parseCatalogRefreshState,
  serializeCatalogRefreshState,
} from "@/lib/admin/catalog-refresh-state";
import { CATALOG_REFRESH_STATE_RELATIVE_PATH } from "@/lib/admin/catalog-refresh-constants";
import type { CatalogRefreshState } from "@/lib/dmm/catalog-refresh-types";

const GITHUB_API_VERSION = "2022-11-28";
const LOCAL_PATH = path.join(process.cwd(), CATALOG_REFRESH_STATE_RELATIVE_PATH);

type GitHubFileResponse = {
  content?: string;
  sha: string;
};

export class CatalogRefreshStateError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "CatalogRefreshStateError";
    this.status = status;
  }
}

function readLocalState(): CatalogRefreshState {
  if (!existsSync(LOCAL_PATH)) {
    return createDefaultCatalogRefreshState();
  }

  try {
    return parseCatalogRefreshState(
      JSON.parse(readFileSync(LOCAL_PATH, "utf8")),
    );
  } catch {
    return createDefaultCatalogRefreshState();
  }
}

function writeLocalState(state: CatalogRefreshState): void {
  writeFileSync(LOCAL_PATH, serializeCatalogRefreshState(state), "utf8");
}

async function githubRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
  const config = getGitHubConfig();
  if (!config) {
    throw new CatalogRefreshStateError("GitHub連携の設定が未完了です。", 503);
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
    throw new CatalogRefreshStateError(
      `catalog-refresh-state の GitHub 操作に失敗しました（HTTP ${response.status}）`,
      response.status,
    );
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

export async function loadCatalogRefreshState(): Promise<CatalogRefreshState> {
  const config = getGitHubConfig();
  if (!config) {
    return readLocalState();
  }

  try {
    const meta = await githubRequest<GitHubFileResponse>(
      `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${CATALOG_REFRESH_STATE_RELATIVE_PATH}?ref=${encodeURIComponent(config.branch)}`,
    );

    if (!meta.content) {
      return readLocalState();
    }

    const text = Buffer.from(meta.content.replace(/\n/g, ""), "base64").toString(
      "utf8",
    );
    return parseCatalogRefreshState(JSON.parse(text));
  } catch (error) {
    if (error instanceof CatalogRefreshStateError && error.status === 404) {
      return readLocalState();
    }

    console.warn("[catalog-refresh-state] GitHub read failed; using local", error);
    return readLocalState();
  }
}

export function serializeCatalogRefreshStateFile(
  state: CatalogRefreshState,
): { path: string; content: string } {
  return {
    path: CATALOG_REFRESH_STATE_RELATIVE_PATH,
    content: serializeCatalogRefreshState(state),
  };
}

export function persistCatalogRefreshStateLocally(
  state: CatalogRefreshState,
): void {
  writeLocalState(state);
}
