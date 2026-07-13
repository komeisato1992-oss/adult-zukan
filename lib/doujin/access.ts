/**
 * 同人図鑑の公開制御。
 *
 * 同人図鑑は公開済み。未設定時は公開扱いとする。
 * 明示的に無効化したときだけ非公開（404）にする。
 *
 * DOUJIN_SITE_ENABLED=
 *   "false" | "0" | "off" → 非公開
 *   未設定 / "true" / その他 → 公開
 */
export function isDoujinPubliclyEnabled(): boolean {
  const raw = process.env.DOUJIN_SITE_ENABLED?.trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "off" || raw === "no") {
    return false;
  }
  return true;
}

export function isDoujinPreviewEnabled(): boolean {
  return process.env.DOUJIN_PREVIEW_ENABLED === "true";
}

export function isDoujinDevAccessAllowed(): boolean {
  return process.env.NODE_ENV === "development";
}

type DoujinAccessOptions = {
  isAdmin?: boolean;
};

/** /doujin 配下へのアクセス可否（明示的に無効化したときだけ 404） */
export function canAccessDoujinSite(options: DoujinAccessOptions = {}): boolean {
  if (isDoujinPubliclyEnabled()) return true;
  if (isDoujinDevAccessAllowed()) return true;
  if (isDoujinPreviewEnabled()) return true;
  if (options.isAdmin) return true;
  return false;
}
