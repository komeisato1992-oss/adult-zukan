export type FanzaSyncTrigger = "manual" | "auto";

export type FanzaSyncJobStatus =
  | "pending"
  | "running"
  | "completed"
  | "partial_failed"
  | "failed";

export type FanzaSyncJob = {
  jobId: string;
  trigger: FanzaSyncTrigger;
  status: FanzaSyncJobStatus;
  targetCount: number;
  processedCount: number;
  successCount: number;
  updatedCount: number;
  unchangedCount: number;
  unconfirmedCount: number;
  hiddenCount: number;
  republishedCount: number;
  errorCount: number;
  cursor: number;
  batchSize: number;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  lastProcessedContentId: string | null;
  message: string | null;
  lockOwner: string | null;
};

export type FanzaSyncHistoryEntry = {
  jobId: string;
  trigger: FanzaSyncTrigger;
  startedAt: string;
  completedAt: string | null;
  targetCount: number;
  successCount: number;
  updatedCount: number;
  unconfirmedCount: number;
  hiddenCount: number;
  republishedCount: number;
  errorCount: number;
  status: FanzaSyncJobStatus;
};

export type FanzaSyncJobSnapshot = {
  currentJob: FanzaSyncJob | null;
  history: FanzaSyncHistoryEntry[];
};
