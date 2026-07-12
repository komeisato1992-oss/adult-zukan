import "server-only";

export type ClothedReselectTarget = {
  name: string;
  slug: string;
};

export type ClothedReselectJob = {
  id: string;
  status: "idle" | "running" | "completed" | "failed";
  total: number;
  processed: number;
  updated: number;
  unchanged: number;
  skippedManual: number;
  errors: number;
  progressPercent: number;
  startedAt: string | null;
  finishedAt: string | null;
  lastError: string | null;
  remaining: ClothedReselectTarget[];
};

type MemoryStore = typeof globalThis & {
  __clothedReselectJob?: ClothedReselectJob | null;
};

function memory(): MemoryStore {
  return globalThis as MemoryStore;
}

function emptyJob(): ClothedReselectJob {
  return {
    id: "",
    status: "idle",
    total: 0,
    processed: 0,
    updated: 0,
    unchanged: 0,
    skippedManual: 0,
    errors: 0,
    progressPercent: 0,
    startedAt: null,
    finishedAt: null,
    lastError: null,
    remaining: [],
  };
}

function withProgress(job: ClothedReselectJob): ClothedReselectJob {
  const progressPercent =
    job.total === 0 ? 100 : Math.min(100, Math.round((job.processed / job.total) * 100));
  return { ...job, progressPercent };
}

export function getClothedReselectJob(): ClothedReselectJob | null {
  return memory().__clothedReselectJob ?? null;
}

export function startClothedReselectJob(
  targets: ClothedReselectTarget[],
): ClothedReselectJob {
  const job = withProgress({
    id: `clothed_reselect_${Date.now()}`,
    status: "running",
    total: targets.length,
    processed: 0,
    updated: 0,
    unchanged: 0,
    skippedManual: 0,
    errors: 0,
    progressPercent: 0,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    lastError: null,
    remaining: targets,
  });
  memory().__clothedReselectJob = job;
  return job;
}

export type ReselectTickResult =
  | "updated"
  | "unchanged"
  | "skipped_manual"
  | "error";

export async function tickClothedReselectJob(
  limit: number,
  processOne: (target: ClothedReselectTarget) => Promise<ReselectTickResult>,
): Promise<ClothedReselectJob> {
  const current = memory().__clothedReselectJob;
  if (!current || current.status !== "running") {
    return current ?? emptyJob();
  }

  const chunk = current.remaining.slice(0, Math.max(1, limit));
  const remaining = current.remaining.slice(chunk.length);
  let updated = current.updated;
  let unchanged = current.unchanged;
  let skippedManual = current.skippedManual;
  let errors = current.errors;
  let lastError = current.lastError;

  for (const target of chunk) {
    try {
      const result = await processOne(target);
      if (result === "updated") updated += 1;
      else if (result === "unchanged") unchanged += 1;
      else if (result === "skipped_manual") skippedManual += 1;
      else errors += 1;
    } catch (error) {
      errors += 1;
      lastError =
        error instanceof Error ? error.message : "再選定中にエラーが発生しました。";
    }
  }

  const processed = current.processed + chunk.length;
  const done = remaining.length === 0;
  const next = withProgress({
    ...current,
    processed,
    updated,
    unchanged,
    skippedManual,
    errors,
    lastError,
    remaining,
    status: done ? "completed" : "running",
    finishedAt: done ? new Date().toISOString() : null,
  });
  memory().__clothedReselectJob = next;
  return next;
}
