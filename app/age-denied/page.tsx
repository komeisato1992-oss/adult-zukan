import Link from "next/link";
import { siteConfig } from "@/lib/site-config";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata = createPageMetadata({
  title: "閲覧できません",
  description: `${siteConfig.name}は18歳以上の方を対象としたサイトです。18歳未満の方は閲覧できません。`,
  path: "/age-denied",
  noIndex: true,
});

export default function AgeDeniedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#0d0000] via-[#1a0000] to-black px-4 py-16 text-center">
      <div className="w-full max-w-md rounded-lg border border-white/10 bg-white p-8 shadow-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-accent">
          Access Denied
        </p>
        <h1 className="mt-3 text-2xl font-bold text-foreground">
          閲覧できません
        </h1>
        <p className="mt-6 text-sm leading-relaxed text-muted">
          {siteConfig.name}は18歳以上の方を対象としたサイトです。
          <br />
          18歳未満の方はご利用いただけません。
        </p>
        <p className="mt-4 text-xs text-muted">
          ブラウザを閉じて、ページから離れてください。
        </p>
        <Link
          href="https://www.google.com"
          className="mt-8 inline-flex h-11 items-center rounded border-2 border-foreground px-6 text-sm font-semibold text-foreground transition-colors hover:bg-surface"
        >
          外部サイトへ移動
        </Link>
      </div>
    </div>
  );
}
