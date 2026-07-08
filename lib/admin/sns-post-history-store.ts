import "server-only";

import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import {
  commitSnsPostHistoryToGitHub,
  fetchSnsPostHistoryFromGitHub,
  GitHubSnsPostHistoryError,
} from "@/lib/admin/github-sns-post-history";
import { isGitHubCatalogConfigured } from "@/lib/admin/github-config";
import {
  parseSnsPostHistoryJson,
  serializeSnsPostHistory,
  SnsPostHistoryJsonError,
} from "@/lib/admin/sns-post-history-json";
import type { SnsPostHistoryEntry } from "@/lib/admin/sns-post-history-types";
import type { SnsPostType } from "@/lib/admin/sns-types";
import { comparePairKey } from "@/lib/admin/sns-compare-pairs";

const ADMIN_DATA_DIR = path.join(process.cwd(), "data", "admin");
const SNS_POST_HISTORY_FILE = path.join(ADMIN_DATA_DIR, "sns-post-history.json");

export type AppendSnsPostHistoryInput = {
  postType: SnsPostType;
  contentId?: string;
  compareIds?: [string, string];
  actressName?: string;
  genreName?: string;
  postText: string;
  postUrl?: string;
};

export function readSnsPostHistoryLocal(): SnsPostHistoryEntry[] {
  if (!existsSync(SNS_POST_HISTORY_FILE)) {
    return [];
  }

  try {
    return parseSnsPostHistoryJson(readFileSync(SNS_POST_HISTORY_FILE, "utf-8"));
  } catch (error) {
    if (error instanceof SnsPostHistoryJsonError) {
      throw error;
    }
    return [];
  }
}

export function writeSnsPostHistoryLocal(
  records: SnsPostHistoryEntry[],
): void {
  mkdirSync(ADMIN_DATA_DIR, { recursive: true });
  writeFileSync(
    SNS_POST_HISTORY_FILE,
    serializeSnsPostHistory(records),
    "utf-8",
  );
}

export async function loadSnsPostHistory(): Promise<{
  records: SnsPostHistoryEntry[];
  sha: string | null;
}> {
  if (isGitHubCatalogConfigured()) {
    return fetchSnsPostHistoryFromGitHub();
  }

  return {
    records: readSnsPostHistoryLocal(),
    sha: null,
  };
}

export async function saveSnsPostHistory(
  records: SnsPostHistoryEntry[],
  message: string,
  sha: string | null,
): Promise<void> {
  if (isGitHubCatalogConfigured()) {
    await commitSnsPostHistoryToGitHub(records, sha, message);
    return;
  }

  writeSnsPostHistoryLocal(records);
}

function normalizeCompareIds(
  compareIds?: [string, string],
): [string, string] | undefined {
  if (!compareIds || compareIds.length !== 2) return undefined;
  const [a, b] = compareIds;
  if (!a?.trim() || !b?.trim()) return undefined;
  return comparePairKey(a, b).split(",") as [string, string];
}

export async function appendSnsPostHistory(
  input: AppendSnsPostHistoryInput,
): Promise<SnsPostHistoryEntry> {
  const { records, sha } = await loadSnsPostHistory();

  const entry: SnsPostHistoryEntry = {
    id: randomUUID(),
    postedAt: new Date().toISOString(),
    postType: input.postType,
    contentId: input.contentId?.trim() || undefined,
    compareIds: normalizeCompareIds(input.compareIds),
    actressName: input.actressName?.trim() || undefined,
    genreName: input.genreName?.trim() || undefined,
    postText: input.postText,
    postUrl: input.postUrl?.trim() || undefined,
  };

  const nextRecords = [entry, ...records];
  await saveSnsPostHistory(
    nextRecords,
    `Record SNS post (${input.postType}) via admin`,
    sha,
  );

  return entry;
}

export function toSnsPostHistoryStoreErrorMessage(error: unknown): {
  message: string;
  status: number;
} {
  if (error instanceof GitHubSnsPostHistoryError) {
    return { message: error.message, status: error.status };
  }

  if (error instanceof SnsPostHistoryJsonError) {
    return { message: error.message, status: error.status };
  }

  return { message: "投稿履歴の更新に失敗しました。", status: 500 };
}
