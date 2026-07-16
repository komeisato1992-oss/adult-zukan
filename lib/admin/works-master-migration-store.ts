import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import {
  createIdleWorksMasterMigrationJob,
  parseWorksMasterMigrationJob,
  serializeWorksMasterMigrationJob,
} from "@/lib/admin/works-master-migration-job";
import {
  WORKS_MASTER_MIGRATION_JOB_RELATIVE_PATH,
  type WorksMasterMigrationJob,
} from "@/lib/admin/works-master-migration-types";

type MemoryStore = typeof globalThis & {
  __worksMasterMigrationJob?: WorksMasterMigrationJob | null;
};

function getMemoryStore(): MemoryStore {
  return globalThis as MemoryStore;
}

function absolutePath(): string {
  return path.join(process.cwd(), WORKS_MASTER_MIGRATION_JOB_RELATIVE_PATH);
}

export function readWorksMasterMigrationJob(): WorksMasterMigrationJob {
  const store = getMemoryStore();
  if (store.__worksMasterMigrationJob) {
    return store.__worksMasterMigrationJob;
  }

  const filePath = absolutePath();
  if (!existsSync(filePath)) {
    const idle = createIdleWorksMasterMigrationJob();
    store.__worksMasterMigrationJob = idle;
    return idle;
  }

  try {
    const parsed = parseWorksMasterMigrationJob(
      JSON.parse(readFileSync(filePath, "utf8")),
    );
    const job = parsed ?? createIdleWorksMasterMigrationJob();
    store.__worksMasterMigrationJob = job;
    return job;
  } catch {
    const idle = createIdleWorksMasterMigrationJob();
    store.__worksMasterMigrationJob = idle;
    return idle;
  }
}

export function writeWorksMasterMigrationJob(
  job: WorksMasterMigrationJob,
): void {
  const store = getMemoryStore();
  store.__worksMasterMigrationJob = job;
  try {
    mkdirSync(path.dirname(absolutePath()), { recursive: true });
    writeFileSync(absolutePath(), serializeWorksMasterMigrationJob(job), "utf8");
  } catch {
    // read-only FS — memory is enough for this process
  }
}

export function clearWorksMasterMigrationJobMemory(): void {
  const store = getMemoryStore();
  store.__worksMasterMigrationJob = null;
}
