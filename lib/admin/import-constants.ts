/** @deprecated IMPORT_COLLECT_REQUEST_COUNT を使用してください */
export const IMPORT_COLLECT_MAX = 500;
/** DMM Affiliate API v3 ItemList の 1 回あたり hits 上限 */
export const DMM_ITEMLIST_MAX_HITS = 100;
/** 収集の 1 ページあたり取得件数（DMM API 上限に合わせる） */
export const IMPORT_COLLECT_PAGE_SIZE = DMM_ITEMLIST_MAX_HITS;
/** 収集のデフォルト取得要求件数 */
export const IMPORT_COLLECT_REQUEST_COUNT = 300;
export const IMPORT_COLLECT_REQUEST_MIN = 1;
export const IMPORT_COLLECT_REQUEST_MAX = 1000;
export const IMPORT_COLLECT_REQUEST_OPTIONS = [10, 50, 200, 300, 500] as const;

/** 人気順収集のデフォルト設定 */
export const IMPORT_POPULAR_TARGET_COUNT = 10000;
export const IMPORT_POPULAR_REQUEST_COUNT = 500;
export const IMPORT_POPULAR_ADD_LIMIT = 500;
export const IMPORT_POPULAR_MAX_BATCHES = 1;
/** この時間更新されていない実行中ジョブは異常終了として解除する */
export const IMPORT_BATCH_JOB_STALE_MS = 10 * 60 * 1000;
/** GitHub のジョブ状態更新が競合した場合の最大リトライ回数 */
export const IMPORT_BATCH_JOB_UPDATE_MAX_RETRIES = 3;

/** 候補一覧の 1 ページ表示件数 */
export const IMPORT_PAGE_SIZE = 50;

/** 1 回のカタログ追加上限（安全バッチ） */
export const IMPORT_BULK_ADD_BATCH_SIZE = 500;
export const IMPORT_BULK_ADD_DEFAULT = 500;
export const IMPORT_BULK_ADD_ABSOLUTE_MAX = 1000;
export const IMPORT_BULK_ADD_OPTIONS = [50, 100, 200, 500, 1000] as const;
export const IMPORT_BULK_ADD_INTERNAL_CHUNK = 500;

/** GitHub カタログ更新の最大リトライ回数 */
export const IMPORT_CATALOG_COMMIT_MAX_RETRIES = 3;

/** 簡易インポート：候補取得件数の選択肢 */
export const IMPORT_FETCH_REQUEST_OPTIONS = [10, 20, 50, 100, 200, 300, 500] as const;
export const IMPORT_FETCH_REQUEST_DEFAULT = 50;
export const IMPORT_FETCH_REQUEST_MAX = 500;
/** 要求候補数に対する最大 API 走査件数の倍率（例: 500件要求 → 最大5000件走査） */
export const IMPORT_FETCH_MAX_SCAN_MULTIPLIER = 10;
/** 簡易インポート：カタログ追加時の最大再試行回数 */
export const IMPORT_SIMPLE_ADD_MAX_RETRIES = 2;

/** @deprecated IMPORT_BULK_ADD_ABSOLUTE_MAX を使用してください */
export const IMPORT_BULK_ADD_MAX = IMPORT_BULK_ADD_ABSOLUTE_MAX;
