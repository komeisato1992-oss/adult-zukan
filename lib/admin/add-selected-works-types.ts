export type AddSelectedWorksPhase =
  | "received"
  | "validate-request"
  | "fetch-catalog"
  | "deduplicate"
  | "prepare-items"
  | "merge-catalog"
  | "rebuild-indexes"
  | "serialize-catalog"
  | "github-commit"
  | "complete";

export type AddSelectedWorksErrorDetails = {
  status?: number;
  githubMessage?: string;
  githubDocumentationUrl?: string;
  receivedCount?: number;
  validAddCount?: number;
  catalogCountBefore?: number;
  catalogCountAfter?: number;
  catalogByteLength?: number;
  payloadByteLength?: number;
  elapsedMs?: number;
  retryCount?: number;
};

export class AddSelectedWorksFailure extends Error {
  phase: AddSelectedWorksPhase;
  status: number;
  details?: AddSelectedWorksErrorDetails;

  constructor(
    phase: AddSelectedWorksPhase,
    message: string,
    status = 500,
    details?: AddSelectedWorksErrorDetails,
  ) {
    super(message);
    this.name = "AddSelectedWorksFailure";
    this.phase = phase;
    this.status = status;
    this.details = details;
  }
}
