export const IMPORT_COLLECT_MAX = 200;
/** DMM Affiliate API v3 ItemList の hits（本プロジェクト既存実装に合わせて 100） */
export const IMPORT_COLLECT_PAGE_SIZE = 100;
export const IMPORT_COLLECT_TARGET_COUNT = 200;
export const IMPORT_COLLECT_MAX_PAGES_NEW = 3;
export const IMPORT_COLLECT_MAX_PAGES_PAST = 5;
export const IMPORT_PAGE_SIZE = 100;
export const IMPORT_BULK_ADD_DEFAULT = 200;
export const IMPORT_BULK_ADD_ABSOLUTE_MAX = 1000;
export const IMPORT_BULK_ADD_OPTIONS = [100, 200, 500, 1000] as const;

/** @deprecated IMPORT_BULK_ADD_ABSOLUTE_MAX を使用してください */
export const IMPORT_BULK_ADD_MAX = IMPORT_BULK_ADD_ABSOLUTE_MAX;
