/** @deprecated IMPORT_COLLECT_REQUEST_COUNT を使用してください */
export const IMPORT_COLLECT_MAX = 300;
/** DMM Affiliate API v3 ItemList の 1 回あたり hits 上限 */
export const DMM_ITEMLIST_MAX_HITS = 100;
/** 過去作品収集の 1 ページあたり取得件数（DMM API 上限に合わせる） */
export const IMPORT_COLLECT_PAGE_SIZE = DMM_ITEMLIST_MAX_HITS;
/** 過去作品収集のデフォルト取得要求件数 */
export const IMPORT_COLLECT_REQUEST_COUNT = 300;
export const IMPORT_COLLECT_REQUEST_MIN = 1;
export const IMPORT_COLLECT_REQUEST_MAX = 1000;
export const IMPORT_COLLECT_REQUEST_OPTIONS = [10, 200, 300] as const;
/** 候補一覧の 1 ページ表示件数 */
export const IMPORT_PAGE_SIZE = 50;
export const IMPORT_BULK_ADD_DEFAULT = 200;
export const IMPORT_BULK_ADD_ABSOLUTE_MAX = 1000;
export const IMPORT_BULK_ADD_OPTIONS = [100, 200, 500, 1000] as const;

/** @deprecated IMPORT_BULK_ADD_ABSOLUTE_MAX を使用してください */
export const IMPORT_BULK_ADD_MAX = IMPORT_BULK_ADD_ABSOLUTE_MAX;
