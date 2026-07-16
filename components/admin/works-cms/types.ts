import type {
  AdultImportSortMode,
  FetchedImportCandidate,
  FetchImportCandidatesSummary,
} from "@/lib/admin/import-simple-types";
import type { AdultSyncMode } from "@/lib/dmm/sync-mode";

export type WorksCmsTabId =
  | "add"
  | "sync"
  | "publish"
  | "fanza-tv"
  | "history";

export type OverviewTone = "ok" | "running" | "warn" | "error" | "unset";

export type WorksCmsOverview = {
  totalCount?: number;
  publishedCount: number;
  unpublishedCount: number;
  noPackageImageCount: number;
  publishedNoImageCount?: number;
  unavailableCount: number;
  manualHiddenCount: number;
  worksMasterCount: number;
  liveStatusCount: number;
  missingLiveCount: number;
  initRatePercent: number;
  liveInitComplete: boolean;
  lastWorkAddedAt: string | null;
  lastLightSyncAt: string | null;
  runningJobLabel: string | null;
  errorCount: number;
  tone: OverviewTone;
  fanzaTv: {
    uncheckedCount: number;
    activeCount: number;
    notAvailableCount: number;
    unknownCount: number;
    lastCheckedAt: string | null;
    becameActiveCount: number;
    becameUnavailableCount: number;
    errorCount: number;
    resumeCursor: number;
  };
  offsets: {
    bySort: {
      new: { lastOffset: number };
      popular: { lastOffset: number };
    };
  };
};

export type SyncStatusPayload = {
  success: boolean;
  currentJob: SyncJob | null;
  history: SyncHistoryEntry[];
  canStartLightSync: boolean;
  disableReasons: string[];
  syncTargetCount: number;
  lightSync?: {
    enabled: boolean;
    status: "enabled" | "disabled" | "unset";
  };
  storage?: {
    rowCount: number | null;
    countStatus: string;
    countMessage: string | null;
    runtime?: {
      enabled: boolean;
      backend: string;
      hasSupabaseUrl: boolean;
      hasServiceRoleKey: boolean;
      tableAvailable: boolean | null;
    };
  };
  worksMaster?: {
    rowCount: number | null;
    countStatus: string;
  };
  counts?: {
    worksMaster: number | null;
    liveStatus: number | null;
    missing: number | null;
    initRatePercent: number;
  };
  liveStatusInit?: {
    currentJob: LiveInitJob | null;
    worksCount: number;
    liveStatusCount: number;
    missingCount: number;
    initRatePercent: number;
  };
};

export type SyncJob = {
  status: string;
  mode?: AdultSyncMode | string;
  processedCount: number;
  targetCount: number;
  successCount: number;
  updatedCount: number;
  unchangedCount?: number;
  errorCount: number;
  message?: string | null;
  lastProcessedContentId?: string | null;
  startedAt?: string;
  completedAt?: string | null;
  updatedAt?: string;
  cursor?: number;
};

export type SyncHistoryEntry = {
  jobId: string;
  trigger: string;
  startedAt: string;
  completedAt: string | null;
  targetCount: number;
  successCount: number;
  updatedCount: number;
  unconfirmedCount?: number;
  errorCount: number;
  status: string;
  mode?: string;
};

export type LiveInitJob = {
  jobId: string;
  status: string;
  worksCount: number;
  liveStatusCount: number;
  missingAtStart: number;
  insertedCount: number;
  failedCount: number;
  remainingCount: number;
  batchesCompleted: number;
  startedAt: string;
  completedAt?: string | null;
  message: string;
  waitUntil: string | null;
};

export type FanzaTvCheckJobView = {
  jobId: string;
  status: string;
  mode: string;
  limit: 100 | 500 | 1000 | "all" | null;
  targetCount: number;
  processedCount: number;
  successCount: number;
  failedCount: number;
  availableCount: number;
  unavailableCount: number;
  pendingCount: number;
  currentCid: string | null;
  startedAt: string;
  completedAt?: string | null;
  elapsedMs: number;
  estimatedRemainingMs: number | null;
  message: string;
  lastError: string | null;
  progressPercent: number;
};

export type FanzaTvCheckStatsView = {
  totalCount: number;
  availableCount: number;
  unavailableCount: number;
  uncheckedCount: number;
  lastCheckedAt: string | null;
  schemaReady: boolean;
};

export type CmsListItem = {
  cid: string;
  title: string;
  package_image: string | null;
  maker: string | null;
  actresses: string[];
  release_date?: string | null;
  published: boolean;
  manual_hidden: boolean;
  is_available: boolean;
  fanza_tv_status: string | null;
  price: string | null;
};

export type SyncTargetScope =
  | "all"
  | "unchecked"
  | "selected"
  | "maker"
  | "actress"
  | "series"
  | "genre"
  | "release_range"
  | "cid_range";

export type AddStep = 1 | 2 | 3 | 4;

export type { AdultImportSortMode, FetchedImportCandidate, FetchImportCandidatesSummary, AdultSyncMode };

export const WORKS_CMS_TABS: Array<{ id: WorksCmsTabId; label: string }> = [
  { id: "add", label: "作品追加" },
  { id: "sync", label: "掲載情報更新" },
  { id: "publish", label: "公開管理" },
  { id: "fanza-tv", label: "見放題管理" },
  { id: "history", label: "処理履歴" },
];

export const FETCH_COUNTS = [20, 50, 100, 200, 500] as const;

export const SYNC_CARDS: Array<{
  mode: AdultSyncMode;
  title: string;
  description: string;
  etaPerThousandSec: number;
}> = [
  {
    mode: "price",
    title: "A. 価格・セール",
    description: "販売価格・セール・割引率を更新",
    etaPerThousandSec: 90,
  },
  {
    mode: "review",
    title: "B. 評価・レビュー",
    description: "評価点・レビュー件数を更新",
    etaPerThousandSec: 90,
  },
  {
    mode: "rank",
    title: "C. 人気順位",
    description: "人気ランキング順位を更新",
    etaPerThousandSec: 80,
  },
  {
    mode: "date",
    title: "D. 新着順位",
    description: "新着（発売日）関連の順位を更新",
    etaPerThousandSec: 80,
  },
  {
    mode: "availability",
    title: "E. 販売状況",
    description: "販売終了・取扱可否を更新",
    etaPerThousandSec: 90,
  },
  {
    mode: "light",
    title: "F. 軽量項目すべて",
    description: "価格・評価・順位など軽量項目をまとめて更新",
    etaPerThousandSec: 120,
  },
];
