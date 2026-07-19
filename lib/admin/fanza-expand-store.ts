import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { FANZA_EXPAND_JOB_PATH } from "@/lib/admin/fanza-expand-config";
import type { FanzaExpandJob } from "@/lib/admin/fanza-expand-types";
import { assertAdultLocalWriteAllowed } from "@/lib/dmm/write-guard";
import { assertLocalProjectDataWriteAllowed } from "@/lib/admin/runtime-fs";

function jobAbsolutePath(): string {
  return path.join(process.cwd(), FANZA_EXPAND_JOB_PATH);
}

export function readFanzaExpandJob(): FanzaExpandJob | null {
  const filePath = jobAbsolutePath();
  if (!existsSync(filePath)) return null;
  try {
    const raw = JSON.parse(readFileSync(filePath, "utf8")) as FanzaExpandJob;
    if (!raw || typeof raw !== "object" || !raw.id) return null;
    return raw;
  } catch (error) {
    console.warn("[fanza-expand] failed to read job file", error);
    return null;
  }
}

export function writeFanzaExpandJob(job: FanzaExpandJob): FanzaExpandJob {
  assertLocalProjectDataWriteAllowed("fanza-expand-job");
  assertAdultLocalWriteAllowed("fanza-expand-job");
  const filePath = jobAbsolutePath();
  mkdirSync(path.dirname(filePath), { recursive: true });
  const next: FanzaExpandJob = {
    ...job,
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(filePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

/** CLI 専用: write-guard を通さず保存（Mac 実行向け） */
export function writeFanzaExpandJobForCli(job: FanzaExpandJob): FanzaExpandJob {
  assertLocalProjectDataWriteAllowed("fanza-expand-job-cli");
  const filePath = jobAbsolutePath();
  mkdirSync(path.dirname(filePath), { recursive: true });
  const next: FanzaExpandJob = {
    ...job,
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(filePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}
