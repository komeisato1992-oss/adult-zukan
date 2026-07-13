import "server-only";

export type GitHubConfig = {
  token: string;
  owner: string;
  repo: string;
  branch: string;
};

export type GitHubCredentials = {
  token: string;
  owner: string;
  repo: string;
};

let hasLoggedGitHubEnv = false;

/** サーバーログ用。GITHUB_* / カタログブランチ環境変数の読み込み状態を1回だけ出力する */
export function logGitHubEnvDiagnostics(): void {
  if (hasLoggedGitHubEnv) return;
  hasLoggedGitHubEnv = true;

  console.log({
    token: !!process.env.GITHUB_TOKEN,
    owner: process.env.GITHUB_OWNER,
    repo: process.env.GITHUB_REPO,
    legacyBranch: process.env.GITHUB_BRANCH,
    workingBranch: process.env.ADULT_CATALOG_WORKING_BRANCH,
    productionBranch: process.env.ADULT_CATALOG_PRODUCTION_BRANCH,
  });
}

export function getGitHubCredentials(): GitHubCredentials | null {
  logGitHubEnvDiagnostics();

  const token = process.env.GITHUB_TOKEN?.trim();
  const owner = process.env.GITHUB_OWNER?.trim();
  const repo = process.env.GITHUB_REPO?.trim() || "adult-zukan";

  if (!token || !owner) {
    return null;
  }

  return { token, owner, repo };
}

/**
 * 作業用ブランチ名。未設定時は null（main へ誤書き込みしない）。
 */
export function getCatalogWorkingBranch(): string | null {
  const branch = process.env.ADULT_CATALOG_WORKING_BRANCH?.trim();
  return branch || null;
}

/**
 * Production ブランチ名。
 * ADULT_CATALOG_PRODUCTION_BRANCH → GITHUB_BRANCH → main
 */
export function getCatalogProductionBranch(): string {
  return (
    process.env.ADULT_CATALOG_PRODUCTION_BRANCH?.trim() ||
    process.env.GITHUB_BRANCH?.trim() ||
    "main"
  );
}

/**
 * カタログ追加・更新用。作業用ブランチ必須。
 * Production ブランチと同名の場合は安全のため null（本番へ直接書かない）。
 */
export function getGitHubConfig(): GitHubConfig | null {
  const credentials = getGitHubCredentials();
  const workingBranch = getCatalogWorkingBranch();
  if (!credentials || !workingBranch) {
    return null;
  }

  const productionBranch = getCatalogProductionBranch();
  if (workingBranch === productionBranch) {
    console.error(
      "[github-config] ADULT_CATALOG_WORKING_BRANCH must differ from production branch to avoid direct Production writes",
      { workingBranch, productionBranch },
    );
    return null;
  }

  return {
    ...credentials,
    branch: workingBranch,
  };
}

/** Production（main 等）向け。キャッシュ・本番反映・比較に使用 */
export function getGitHubProductionConfig(): GitHubConfig | null {
  const credentials = getGitHubCredentials();
  if (!credentials) return null;

  return {
    ...credentials,
    branch: getCatalogProductionBranch(),
  };
}

export function isGitHubCatalogConfigured(): boolean {
  return getGitHubConfig() !== null;
}

export function isGitHubProductionConfigured(): boolean {
  return getGitHubProductionConfig() !== null;
}
