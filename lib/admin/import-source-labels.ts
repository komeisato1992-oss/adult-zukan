export function formatImportSourceLabel(source: string): string {
  if (source === "fanza-new" || source === "fanza-new-page2") {
    return "FANZA新作";
  }
  if (source === "fanza-rank" || source.startsWith("fanza-rank")) {
    return "人気順";
  }
  if (source === "fanza-price") {
    return "価格順";
  }
  if (source === "fanza-sale") {
    return "セール";
  }
  if (source.startsWith("fanza-genre-")) {
    return `ジャンル: ${source.replace("fanza-genre-", "")}`;
  }
  return source;
}
