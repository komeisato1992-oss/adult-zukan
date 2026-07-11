import "server-only";

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  FANZA_SYNC_HISTORY_LIMIT,
  FANZA_SYNC_JOB_RELATIVE_PATH,
} from "@/lib/admin/fanza-sync-constants";
import {
  createEmptyFanzaSyncSnapshot,
  parseFanzaSyncSnapshot,
  serializeFanzaSyncSnapshot,
  toHistoryEntry,
} from "@/lib/admin/fanza-sync-job";
import type { FanzaSyncJobSnapshot } from "@/lib/admin/fanza-sync-types";
import { getGitHubConfig } from "@/lib/admin/github-config";

const LOCAL_PATH = path.join(process.cwd(), FANZA_SYNC_JOB_RELATIVE_PATH);
const GITHUB_API_VERSION = "2022-11-28";

type GitHubFileResponse = {
  content?: string;
  sha: string;
};

function readLocalSnapshot(): FanzaSyncJobSnapshot {
  if (!existsSync(LOCAL_PATH)) {
    return createEmptyFanzaSyncSnapshot();
  }

  try {
    return parseFanzaSyncSnapshot(JSON.parse(readFileSync(LOCAL_PATH, "utf8")));
  } catch {
    return createEmptyFanzaSyncSnapshot();
  }
}

function writeLocalSnapshot(snapshot: FanzaSyncJobSnapshot): void {
  writeFileSync(LOCAL_PATH, serializeFanzaSyncSnapshot(snapshot), "utf8");
}

async function githubRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
  const config = getGitHubConfig();
  if (!config) {
    throw new Error("GitHub連携の設定が未完了です。");
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
    throw new Error(`GitHub API error: ${response.status}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

export async function loadFanzaSyncSnapshot(): Promise<FanzaSyncJobSnapshot> {
  const config = getGitHubConfig();
  if (!config) {
    return readLocalSnapshot();
  }

  try {
    const meta = await githubRequest<GitHubFileResponse>(
      `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${FANZA_SYNC_JOB_RELATIVE_PATH}?ref=${encodeURIComponent(config.branch)}`,
    );

    if (!meta.content) {
      return readLocalSnapshot();
    }

    const text = Buffer.from(meta.content.replace(/\n/g, ""), "base64").toString(
      "utf8",
    );
    return parseFanzaSyncSnapshot(JSON.parse(text));
  } catch {
    return readLocalSnapshot();
  }
}

export function finalizeSnapshotWithHistory(
  snapshot: FanzaSyncJobSnapshot,
): FanzaSyncJobSnapshot {
  const job = snapshot.currentJob;
  if (!job || job.status === "running" || job.status === "pending") {
    return snapshot;
  }

  const history = [
    toHistoryEntry(job),
    ...snapshot.history.filter((entry) => entry.jobId !== job.jobId),
  ].slice(0, FANZA_SYNC_HISTORY_LIMIT);

  return {
    currentJob: null,
    history,
  };
}

export function serializeFanzaSyncJobFile(snapshot: FanzaSyncJobSnapshot): {
  path: string;
  content: string;
} {
  return {
    path: FANZA_SYNC_JOB_RELATIVE_PATH,
    content: serializeFanzaSyncSnapshot(snapshot),
  };
}

export function persistFanzaSyncSnapshotLocally(
  snapshot: FanzaSyncJobSnapshot,
): void {
  writeLocalSnapshot(snapshot);
}
