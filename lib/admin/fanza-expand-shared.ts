/** server-only 非依存の共有定数・型（管理画面クライアントからも import 可） */

export const FANZA_EXPAND_SOURCE_ORDER = [
  "popular",
  "new",
  "genre",
  "maker",
  "label",
  "series",
  "actress",
] as const;

export type FanzaExpandSourceId = (typeof FANZA_EXPAND_SOURCE_ORDER)[number];
