/**
 * 同人図鑑の公開制御。
 *
 * 本番で誤公開しないため、DOUJIN_SITE_ENABLED が厳密に "true" のときだけ一般公開する。
 * 未設定・空・false は非公開。開発確認用に development / preview / 管理者を許可する。
 */
export function isDoujinPubliclyEnabled(): boolean {
  return process.env.DOUJIN_SITE_ENABLED === "true";
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

/** /doujin 配下へのアクセス可否（非公開時は 404 にする） */
export function canAccessDoujinSite(options: DoujinAccessOptions = {}): boolean {
  if (isDoujinPubliclyEnabled()) return true;
  if (isDoujinDevAccessAllowed()) return true;
  if (isDoujinPreviewEnabled()) return true;
  if (options.isAdmin) return true;
  return false;
}
