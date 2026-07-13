export type CatalogPromoteStatus =
  | "IDLE"
  | "VALIDATING"
  | "MERGING"
  | "DEPLOYING"
  | "READY"
  | "FAILED";

export type CatalogPromoteDeployState =
  | "none"
  | "pending"
  | "building"
  | "ready"
  | "failed"
  | "unknown";

export type CatalogPromoteDiffWork = {
  contentId: string;
  productId: string;
  title: string;
};

export type CatalogPromoteDiff = {
  addedWorks: CatalogPromoteDiffWork[];
  updatedWorks: CatalogPromoteDiffWork[];
  removedWorks: CatalogPromoteDiffWork[];
  addedCount: number;
  updatedCount: number;
  removedCount: number;
  truncated: boolean;
  changedCatalogShards: string[];
  changedMediaShards: string[];
  sitemapChanged: boolean;
  searchIndexChanged: boolean;
  changedFiles: string[];
  changedFileCount: number;
};

export type CatalogPromoteValidationIssue = {
  code: string;
  message: string;
};

export type CatalogPromoteValidationResult = {
  ok: boolean;
  issues: CatalogPromoteValidationIssue[];
  workingTotalCount: number | null;
  productionTotalCount: number | null;
  shardCount: number | null;
};

export type CatalogPromoteStatusPayload = {
  configured: boolean;
  hasPendingChanges: boolean;
  workingBranch: string | null;
  productionBranch: string;
  pendingCommitCount: number;
  changedFileCount: number;
  addedWorkCount: number;
  updatedWorkCount: number;
  lastWorkAt: string | null;
  lastPromoteAt: string | null;
  lastPromoteSha: string | null;
  workingSha: string | null;
  productionSha: string | null;
  status: CatalogPromoteStatus;
  deployState: CatalogPromoteDeployState;
  deployStartedAt: string | null;
  productionUrl: string | null;
  errorSummary: string | null;
  message: string | null;
  deployMode: "github-auto" | "deploy-hook" | "none";
};

export type CatalogPromoteAuditEntry = {
  at: string;
  actor: string;
  action:
    | "promote"
    | "discard"
    | "validate"
    | "status"
    | "ensure-branch"
    | "diff";
  workingBranch: string | null;
  productionBranch: string | null;
  startSha: string | null;
  endSha: string | null;
  addedCount: number | null;
  updatedCount: number | null;
  changedFileCount: number | null;
  promoteResult: "success" | "failed" | "skipped" | null;
  deployResult: string | null;
  failureReason: string | null;
};

export const CATALOG_PROMOTE_STATE_PATH =
  "data/dmm/catalog-promote-state.json";

export const CATALOG_PROMOTE_AUDIT_PATH =
  "data/dmm/catalog-promote-audit.json";

export type CatalogPromotePersistedState = {
  status: CatalogPromoteStatus;
  lastWorkAt: string | null;
  lastPromoteAt: string | null;
  lastPromoteSha: string | null;
  deployState: CatalogPromoteDeployState;
  deployStartedAt: string | null;
  productionUrl: string | null;
  errorSummary: string | null;
  lockToken: string | null;
  lockExpiresAt: string | null;
  cumulativeAdded: number;
  cumulativeUpdated: number;
};
