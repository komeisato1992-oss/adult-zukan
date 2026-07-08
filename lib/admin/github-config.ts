import "server-only";

export type GitHubConfig = {
  token: string;
  owner: string;
  repo: string;
  branch: string;
};

let hasLoggedGitHubEnv = false;

/** サーバーログ用。GITHUB_* 環境変数の読み込み状態を1回だけ出力する */
export function logGitHubEnvDiagnostics(): void {
  if (hasLoggedGitHubEnv) return;
  hasLoggedGitHubEnv = true;

  console.log({
    token: !!process.env.GITHUB_TOKEN,
    owner: process.env.GITHUB_OWNER,
    repo: process.env.GITHUB_REPO,
    branch: process.env.GITHUB_BRANCH,
  });
}

export function getGitHubConfig(): GitHubConfig | null {
  logGitHubEnvDiagnostics();

  const token = process.env.GITHUB_TOKEN?.trim();
  const owner = process.env.GITHUB_OWNER?.trim();
  const repo = process.env.GITHUB_REPO?.trim() || "adult-zukan";
  const branch = process.env.GITHUB_BRANCH?.trim() || "main";

  if (!token || !owner) {
    return null;
  }

  return { token, owner, repo, branch };
}

export function isGitHubCatalogConfigured(): boolean {
  return getGitHubConfig() !== null;
}
