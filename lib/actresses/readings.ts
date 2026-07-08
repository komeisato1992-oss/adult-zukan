/** DMM catalog に ruby が無い女優名の読み（五十音順ソート用） */
const ACTRESS_READING_OVERRIDES: Record<string, string> = {
  AIKA: "あいか",
  JULIA: "じゅりあ",
  MINAMO: "みなも",
  miru: "みる",
};

export function getActressReading(name: string, ruby?: string): string {
  const trimmedRuby = ruby?.trim();
  if (trimmedRuby) return trimmedRuby;
  return ACTRESS_READING_OVERRIDES[name] ?? name;
}
