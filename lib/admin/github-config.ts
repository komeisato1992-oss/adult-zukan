import "server-only";

export type GitHubConfig = {
  token: string;
  owner: string;
  repo: string;
  branch: string;
};

export function getGitHubConfig(): GitHubConfig | null {
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
