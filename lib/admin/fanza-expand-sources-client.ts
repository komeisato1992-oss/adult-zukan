/** クライアントでも使えるソース表示ラベル（server-only 非依存） */
import type { FanzaExpandSource } from "@/lib/admin/fanza-expand-types";

export function expandSourceLabel(source: FanzaExpandSource): string {
  switch (source) {
    case "popular":
      return "人気順";
    case "new":
      return "新着順";
    case "genre":
      return "ジャンル";
    case "maker":
      return "メーカー";
    case "label":
      return "レーベル";
    case "series":
      return "シリーズ";
    case "actress":
      return "女優";
    default:
      return source;
  }
}
