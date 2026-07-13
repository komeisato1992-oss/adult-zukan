import Link from "next/link";

export function DoujinSalePromoSection() {
  return (
    <section
      aria-labelledby="doujin-sale-promo"
      className="mb-10 rounded-xl border border-accent/20 bg-accent-light p-5 sm:p-6"
    >
      <h2 id="doujin-sale-promo" className="text-lg font-bold text-accent">
        セール情報
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        期間限定で割引中の同人作品をまとめてチェックできます。
      </p>
      <Link
        href="/doujin/sale"
        className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-accent px-5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
      >
        セール作品を見る
      </Link>
    </section>
  );
}
