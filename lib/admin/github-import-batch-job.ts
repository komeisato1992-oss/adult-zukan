import "server-only";

import { getGitHubConfig } from "@/lib/admin/github-config";
import {
  createEmptyBatchJob,
  parseBatchJob,
  serializeBatchJob,
  type ImportBatchJob,
} from "@/lib/admin/import-batch-job";
import { IMPORT_BATCH_JOB_RELATIVE_PATH } from "@/lib/admin/import-batch-job-path";

const FILE_PATH = IMPORT_BATCH_JOB_RELATIVE_PATH;
const GITHUB_API_VERSION = "2022-11-28";

type GitHubFileResponse = {
  content?: string;
  sha: string;
};

export class GitHubBatchJobError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "GitHubBatchJobError";
    this.status = status;
  }
}

function getContentsUrl(path: string): string {
  const config = getGitHubConfig();
  if (!config) {
    throw new GitHubBatchJobError("GitHub連携の設定が未完了です。", 503);
  }

  return `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}`;
}

async function githubRequest<T>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const config = getGitHubConfig();
  if (!config) {
    throw new GitHubBatchJobError("GitHub連携の設定が未完了です。", 503);
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
      throw new GitHubBatchJobError(
        "import-batch-job.json が GitHub 上に見つかりません。",
        404,
      );
    }

    if (response.status === 409) {
      throw new GitHubBatchJobError(
        "バッチジョブの更新が競合しました。しばらく待ってから再度お試しください。",
        409,
      );
    }

    throw new GitHubBatchJobError(
      "GitHub API からバッチジョブを取得・更新できませんでした。",
      response.status >= 500 ? 502 : 500,
    );
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

export async function fetchBatchJobFromGitHub(): Promise<{
  job: ImportBatchJob;
  sha: string | null;
}> {
  const config = getGitHubConfig();
  if (!config) {
    throw new GitHubBatchJobError("GitHub連携の設定が未完了です。", 503);
  }

  try {
    const data = await githubRequest<GitHubFileResponse>(
      `${getContentsUrl(FILE_PATH)}?ref=${encodeURIComponent(config.branch)}`,
    );

    const content = data.content
      ? Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8")
      : "{}";

    return {
      job: parseBatchJob(JSON.parse(content)),
      sha: data.sha,
    };
  } catch (error) {
    if (error instanceof GitHubBatchJobError && error.status === 404) {
      return { job: createEmptyBatchJob(), sha: null };
    }
    throw error;
  }
}

export async function commitBatchJobToGitHub(
  job: ImportBatchJob,
  sha: string | null,
  message: string,
): Promise<void> {
  const config = getGitHubConfig();
  if (!config) {
    throw new GitHubBatchJobError("GitHub連携の設定が未完了です。", 503);
  }

  const body: Record<string, unknown> = {
    message,
    content: Buffer.from(serializeBatchJob(job), "utf-8").toString("base64"),
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
