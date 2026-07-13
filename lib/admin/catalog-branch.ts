import "server-only";

import {
  getCatalogProductionBranch,
  getCatalogWorkingBranch,
  getGitHubConfig,
  getGitHubCredentials,
  getGitHubProductionConfig,
  type GitHubConfig,
} from "@/lib/admin/github-config";

const GITHUB_API_VERSION = "2022-11-28";

export class CatalogBranchError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "CatalogBranchError";
    this.status = status;
  }
}

type GitRefResponse = {
  object: { sha: string; type?: string };
  ref?: string;
};

async function githubRequest<T>(
  config: GitHubConfig | { token: string; owner: string; repo: string },
  url: string,
  init: RequestInit = {},
): Promise<{ ok: true; data: T; status: number } | { ok: false; status: number; body: string }> {
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
    return {
      ok: false,
      status: response.status,
      body: await response.text(),
    };
  }

  if (response.status === 204) {
    return { ok: true, data: {} as T, status: response.status };
  }

  return {
    ok: true,
    data: (await response.json()) as T,
    status: response.status,
  };
}

function repoBase(config: { owner: string; repo: string }): string {
  return `https://api.github.com/repos/${config.owner}/${config.repo}`;
}

export async function fetchBranchSha(
  config: GitHubConfig,
): Promise<string | null> {
  const result = await githubRequest<GitRefResponse>(
    config,
    `${repoBase(config)}/git/refs/heads/${encodeURIComponent(config.branch)}`,
  );

  if (!result.ok) {
    if (result.status === 404) return null;
    throw new CatalogBranchError(
      `ブランチ ${config.branch} の取得に失敗しました。`,
      result.status >= 500 ? 502 : result.status,
    );
  }

  return result.data.object.sha;
}

/**
 * 作業用ブランチが無ければ Production ブランチの HEAD から作成する。
 * 認証済みサーバー側のみで呼ぶこと。
 */
export async function ensureCatalogWorkingBranch(): Promise<{
  workingBranch: string;
  productionBranch: string;
  created: boolean;
  workingSha: string;
  productionSha: string;
}> {
  const workingConfig = getGitHubConfig();
  const productionConfig = getGitHubProductionConfig();
  const workingBranch = getCatalogWorkingBranch();
  const productionBranch = getCatalogProductionBranch();

  if (!workingConfig || !workingBranch) {
    throw new CatalogBranchError(
      "作業用ブランチ (ADULT_CATALOG_WORKING_BRANCH) が未設定です。main への直接保存は禁止されています。",
      503,
    );
  }

  if (!productionConfig) {
    throw new CatalogBranchError("GitHub Production 設定が未完了です。", 503);
  }

  const productionSha = await fetchBranchSha(productionConfig);
  if (!productionSha) {
    throw new CatalogBranchError(
      `Production ブランチ ${productionBranch} が見つかりません。`,
      404,
    );
  }

  const existingWorkingSha = await fetchBranchSha(workingConfig);
  if (existingWorkingSha) {
    return {
      workingBranch,
      productionBranch,
      created: false,
      workingSha: existingWorkingSha,
      productionSha,
    };
  }

  const credentials = getGitHubCredentials();
  if (!credentials) {
    throw new CatalogBranchError("GitHub連携の設定が未完了です。", 503);
  }

  const createResult = await githubRequest<GitRefResponse>(
    credentials,
    `${repoBase(credentials)}/git/refs`,
    {
      method: "POST",
      body: JSON.stringify({
        ref: `refs/heads/${workingBranch}`,
        sha: productionSha,
      }),
    },
  );

  if (!createResult.ok) {
    // 競合で既に作成された場合は再取得
    const raced = await fetchBranchSha(workingConfig);
    if (raced) {
      return {
        workingBranch,
        productionBranch,
        created: false,
        workingSha: raced,
        productionSha,
      };
    }

    throw new CatalogBranchError(
      `作業用ブランチ ${workingBranch} の作成に失敗しました。`,
      createResult.status >= 500 ? 502 : createResult.status,
    );
  }

  console.log("[catalog-branch] created working branch from production", {
    workingBranch,
    productionBranch,
    sha: productionSha.slice(0, 12),
  });

  return {
    workingBranch,
    productionBranch,
    created: true,
    workingSha: productionSha,
    productionSha,
  };
}

/**
 * 作業用ブランチを Production の HEAD に強制リセットする（破棄用）。
 * Production ブランチ自体は変更しない。
 */
export async function resetWorkingBranchToProduction(): Promise<{
  workingBranch: string;
  productionBranch: string;
  previousWorkingSha: string | null;
  newSha: string;
}> {
  const workingConfig = getGitHubConfig();
  const productionConfig = getGitHubProductionConfig();
  const workingBranch = getCatalogWorkingBranch();
  const productionBranch = getCatalogProductionBranch();

  if (!workingConfig || !workingBranch) {
    throw new CatalogBranchError(
      "作業用ブランチが未設定です。",
      503,
    );
  }
  if (!productionConfig) {
    throw new CatalogBranchError("GitHub Production 設定が未完了です。", 503);
  }

  const previousWorkingSha = await fetchBranchSha(workingConfig);
  const productionSha = await fetchBranchSha(productionConfig);
  if (!productionSha) {
    throw new CatalogBranchError(
      `Production ブランチ ${productionBranch} が見つかりません。`,
      404,
    );
  }

  if (!previousWorkingSha) {
    await ensureCatalogWorkingBranch();
    return {
      workingBranch,
      productionBranch,
      previousWorkingSha: null,
      newSha: productionSha,
    };
  }

  const result = await githubRequest(
    workingConfig,
    `${repoBase(workingConfig)}/git/refs/heads/${encodeURIComponent(workingBranch)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        sha: productionSha,
        force: true,
      }),
    },
  );

  if (!result.ok) {
    throw new CatalogBranchError(
      "作業用ブランチの破棄（Production へのリセット）に失敗しました。",
      result.status >= 500 ? 502 : result.status,
    );
  }

  return {
    workingBranch,
    productionBranch,
    previousWorkingSha,
    newSha: productionSha,
  };
}
