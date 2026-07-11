export type ImportBatchAddLog = {
  processId: string;
  startOffset: number;
  apiFetchedCount: number;
  addTargetCount: number;
  addedCount: number;
  skippedExistingCount: number;
  excludedCount: number;
  failedCount: number;
  startSha: string | null;
  saveSha: string | null;
  retryCount: number;
  durationMs: number;
  errorCode: string | null;
};

export function logImportBatchAdd(entry: ImportBatchAddLog): void {
  console.info("[import-batch]", JSON.stringify(entry));
}
