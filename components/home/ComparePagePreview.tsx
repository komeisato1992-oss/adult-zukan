import Image from "next/image";
import Link from "next/link";
import {
  WORK_CARD_VIEW_LABEL,
  workCardCtaBaseClassName,
} from "@/components/works/work-card-cta-styles";
import {
  getDmmItemActressNameList,
  getDmmItemGenreNameList,
  getDmmItemImageUrl,
  getDmmItemMakerName,
  getDmmItemPrice,
  getDmmItemSeriesName,
} from "@/lib/dmm/display";
import { getDmmReleaseDateInfo } from "@/lib/dmm/release-date";
import type { DmmItem } from "@/lib/dmm/types";
import { siteConfig } from "@/lib/site-config";

type ComparePagePreviewProps = {
  items: DmmItem[];
};

function ComparePreviewCard({ item }: { item: DmmItem }) {
  const imageUrl = getDmmItemImageUrl(item);
  const actressNames = getDmmItemActressNameList(item);
  const release = getDmmReleaseDateInfo(item);
  const duration = item.volume?.trim() ? `${item.volume}分` : "-";

  return (
    <article className="rounded-lg border border-border bg-white p-4 shadow-sm">
      <div className="block">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={item.title}
            width={320}
            height={180}
            className="h-auto w-full rounded object-cover"
            unoptimized
          />
        ) : (
          <div className="aspect-[16/9] rounded bg-surface" />
        )}
        <h3 className="mt-3 line-clamp-2 min-h-[2.75rem] text-sm font-bold leading-snug text-foreground sm:text-base">
          {item.title}
        </h3>
      </div>

      <div
        aria-hidden
        className={`${workCardCtaBaseClassName} mt-3 bg-accent text-white`}
      >
        {WORK_CARD_VIEW_LABEL}
      </div>

      <dl className="mt-3 space-y-2 text-sm">
        <div>
          <dt className="inline text-muted">女優：</dt>
          <dd className="inline text-foreground">
            {actressNames.length > 0 ? actressNames.join("、") : "-"}
          </dd>
        </div>
        <div>
          <dt className="inline text-muted">価格：</dt>
          <dd className="inline font-bold text-accent">
            {getDmmItemPrice(item) ?? "-"}
          </dd>
        </div>
        <div>
          <dt className="inline text-muted">メーカー：</dt>
          <dd className="inline text-foreground">
            {getDmmItemMakerName(item) ?? "-"}
          </dd>
        </div>
        <div>
          <dt className="inline text-muted">シリーズ：</dt>
          <dd className="inline text-foreground">
            {getDmmItemSeriesName(item) ?? "-"}
          </dd>
        </div>
        <div>
          <dt className="inline text-muted">ジャンル：</dt>
          <dd className="inline text-foreground">
            {getDmmItemGenreNameList(item).slice(0, 3).join("、") || "-"}
          </dd>
        </div>
        <div>
          <dt className="inline text-muted">再生時間：</dt>
          <dd className="inline text-foreground">{duration}</dd>
        </div>
        <div>
          <dt className="inline text-muted">発売日：</dt>
          <dd className="inline text-foreground">{release?.value ?? "-"}</dd>
        </div>
      </dl>
    </article>
  );
}

export function ComparePagePreview({ items }: ComparePagePreviewProps) {
  const previewItems = items.slice(0, 2);
  if (previewItems.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface p-3 shadow-sm sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-border pb-3">
        <p className="text-sm font-bold text-foreground">{siteConfig.name} 比較画面</p>
        <span className="rounded-full bg-accent-light px-3 py-1 text-xs font-semibold text-accent">
          比較して選べる
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {previewItems.map((item) => (
          <ComparePreviewCard key={item.content_id} item={item} />
        ))}
      </div>
    </div>
  );
}
