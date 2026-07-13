import Link from "next/link";
import { ZukanSwitchButton } from "@/components/home/ZukanSwitchButton";

export function SiteIntroSection() {
  return (
    <section
      aria-labelledby="site-intro-heading"
      className="border-b border-border bg-white"
    >
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h1
            id="site-intro-heading"
            className="text-2xl font-bold leading-tight text-foreground sm:text-3xl lg:text-4xl"
          >
            作品選びを、もっと便利に。
          </h1>

          <div className="mt-6 space-y-4 text-base leading-relaxed text-muted sm:text-lg">
            <p>
              アダルト図鑑では、
              <strong className="font-semibold text-foreground">
                複数の作品を並べて比較
              </strong>
              できます。
            </p>
            <p>
              価格・女優・メーカー・シリーズ・ジャンルなどを
              <br className="hidden sm:inline" />
              一画面で比較しながら作品選びができます。
            </p>
            <p>
              日本では珍しい
              <strong className="font-semibold text-foreground">
                AV作品比較サイト
              </strong>
              です。
            </p>
          </div>

          <div className="mt-8 flex flex-col items-center">
            <div className="flex w-full flex-wrap items-center justify-center gap-3 sm:gap-4">
              <Link
                href="/works"
                prefetch
                className="inline-flex h-11 min-w-[160px] flex-1 items-center justify-center rounded-lg bg-accent px-6 text-sm font-semibold text-white transition-colors hover:bg-accent-hover sm:flex-none"
              >
                作品を探す
              </Link>
              <Link
                href="/compare"
                prefetch
                className="inline-flex h-11 min-w-[160px] flex-1 items-center justify-center rounded-lg border border-accent bg-white px-6 text-sm font-semibold text-accent transition-colors hover:bg-[#FFF2F2] sm:flex-none"
              >
                比較機能を見る
              </Link>
            </div>
            <ZukanSwitchButton
              label="同人図鑑はこちら"
              href="/doujin"
              variant="doujin"
              fromSite="adult"
              toSite="doujin"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
