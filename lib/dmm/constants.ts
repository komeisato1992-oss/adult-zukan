/** DMM API用アフィリエイトID（サーバー側API呼び出しのみ） */
export const DMM_API_AFFILIATE_ID_FALLBACK = "zukanjp-990";

/** 外部リンク（FANZAで見るボタン）用アフィリエイトID */
export const FANZA_LINK_AFFILIATE_ID =
  process.env.DMM_FANZA_LINK_AFFILIATE_ID ?? "zukanjp-001";
