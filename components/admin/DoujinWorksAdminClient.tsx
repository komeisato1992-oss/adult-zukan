"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { DoujinWorkAdminRow } from "@/lib/admin/doujin-works-admin";

type FilterOption = { id: string; name: string };

type DoujinWorksAdminClientProps = {
  items: DoujinWorkAdminRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  q: string;
  sort: string;
  published: string;
  sale: string;
  filters: {
    circles: FilterOption[];
    authors: FilterOption[];
    series: FilterOption[];
    genres: FilterOption[];
  };
};

function formatYen(value: number | null): string {
  if (value == null) return "-";
  return `¥${value.toLocaleString("ja-JP")}`;
}

export function DoujinWorksAdminClient({
  items,
  total,
  page,
  pageSize,
  totalPages,
  q,
  sort,
  published,
  sale,
  filters,
}: DoujinWorksAdminClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function updateParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (!value) next.delete(key);
      else next.set(key, value);
    }
    if (!("page" in patch)) next.delete("page");
    startTransition(() => {
      router.push(`/admin/doujin/works?${next.toString()}`);
    });
  }

  return (
    <div className="space-y-4">
      <form
        className="grid gap-3 rounded-xl border border-border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          updateParams({
            q: String(form.get("q") ?? "").trim() || null,
            sort: String(form.get("sort") ?? "new"),
            published: String(form.get("published") ?? "all"),
            sale: String(form.get("sale") ?? "all"),
            pageSize: String(form.get("pageSize") ?? "20"),
            circleId: String(form.get("circleId") ?? "") || null,
            authorId: String(form.get("authorId") ?? "") || null,
            seriesId: String(form.get("seriesId") ?? "") || null,
            genreId: String(form.get("genreId") ?? "") || null,
          });
        }}
      >
        <label className="block text-xs text-muted sm:col-span-2">
          検索（作品名・ID・サークル・作者）
          <input
            name="q"
            defaultValue={q}
            className="mt-1 h-10 w-full rounded-lg border border-border px-3 text-sm"
            placeholder="キーワード"
          />
        </label>
        <label className="block text-xs text-muted">
          並び替え
          <select
            name="sort"
            defaultValue={sort}
            className="mt-1 h-10 w-full rounded-lg border border-border px-2 text-sm"
          >
            <option value="new">新着順</option>
            <option value="popular">人気順</option>
            <option value="price-desc">価格が高い順</option>
            <option value="price-asc">価格が安い順</option>
            <option value="rating">評価順</option>
            <option value="discount">割引率順</option>
            <option value="updated">更新日時順</option>
          </select>
        </label>
        <label className="block text-xs text-muted">
          公開状態
          <select
            name="published"
            defaultValue={published}
            className="mt-1 h-10 w-full rounded-lg border border-border px-2 text-sm"
          >
            <option value="all">すべて</option>
            <option value="published">公開中</option>
            <option value="unpublished">非公開</option>
          </select>
        </label>
        <label className="block text-xs text-muted">
          セール
          <select
            name="sale"
            defaultValue={sale}
            className="mt-1 h-10 w-full rounded-lg border border-border px-2 text-sm"
          >
            <option value="all">すべて</option>
            <option value="sale">セール中</option>
            <option value="not-sale">セール以外</option>
          </select>
        </label>
        <label className="block text-xs text-muted">
          表示件数
          <select
            name="pageSize"
            defaultValue={String(pageSize)}
            className="mt-1 h-10 w-full rounded-lg border border-border px-2 text-sm"
          >
            <option value="20">20件</option>
            <option value="50">50件</option>
            <option value="100">100件</option>
          </select>
        </label>
        <label className="block text-xs text-muted">
          サークル
          <select name="circleId" defaultValue="" className="mt-1 h-10 w-full rounded-lg border border-border px-2 text-sm">
            <option value="">すべて</option>
            {filters.circles.slice(0, 200).map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-muted">
          作者
          <select name="authorId" defaultValue="" className="mt-1 h-10 w-full rounded-lg border border-border px-2 text-sm">
            <option value="">すべて</option>
            {filters.authors.slice(0, 200).map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-muted">
          シリーズ
          <select name="seriesId" defaultValue="" className="mt-1 h-10 w-full rounded-lg border border-border px-2 text-sm">
            <option value="">すべて</option>
            {filters.series.slice(0, 200).map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-muted">
          ジャンル
          <select name="genreId" defaultValue="" className="mt-1 h-10 w-full rounded-lg border border-border px-2 text-sm">
            <option value="">すべて</option>
            {filters.genres.slice(0, 200).map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
          >
            {pending ? "検索中…" : "絞り込み"}
          </button>
          <Link
            href="/admin/doujin/fetch"
            className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium hover:border-accent hover:text-accent"
          >
            データ追加へ
          </Link>
        </div>
      </form>

      <p className="text-sm text-muted">
        {total.toLocaleString("ja-JP")}件中 {(page - 1) * pageSize + 1}–
        {Math.min(page * pageSize, total)}件
      </p>

      <div className="space-y-3 lg:hidden">
        {items.map((work) => (
          <article
            key={work.id}
            className="rounded-xl border border-border bg-white p-3 shadow-sm"
          >
            <div className="flex gap-3">
              <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded bg-surface">
                {work.imageUrl ? (
                  <Image
                    src={work.imageUrl}
                    alt=""
                    fill
                    className="object-contain"
                    sizes="80px"
                    unoptimized
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-semibold">{work.title}</p>
                <p className="mt-1 text-xs text-muted">{work.contentId}</p>
                <p className="mt-1 text-xs">{work.circleNames.join("、") || "-"}</p>
                <p className="mt-1 text-sm font-bold text-price">
                  {formatYen(work.price)}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-border bg-white lg:block">
        <table className="min-w-[1400px] w-full border-collapse text-left text-sm">
          <thead className="bg-surface text-xs text-muted">
            <tr>
              <th className="px-3 py-2">画像</th>
              <th className="px-3 py-2">作品</th>
              <th className="px-3 py-2">サークル</th>
              <th className="px-3 py-2">作者</th>
              <th className="px-3 py-2">シリーズ</th>
              <th className="px-3 py-2">ジャンル</th>
              <th className="px-3 py-2">形式</th>
              <th className="px-3 py-2">価格</th>
              <th className="px-3 py-2">評価</th>
              <th className="px-3 py-2">状態</th>
              <th className="px-3 py-2">更新</th>
            </tr>
          </thead>
          <tbody>
            {items.map((work) => (
              <tr key={work.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <div className="relative h-14 w-10 overflow-hidden rounded bg-surface">
                    {work.imageUrl ? (
                      <Image
                        src={work.imageUrl}
                        alt=""
                        fill
                        className="object-contain"
                        sizes="40px"
                        unoptimized
                      />
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <p className="max-w-[280px] font-medium">{work.title}</p>
                  <p className="text-xs text-muted">{work.contentId}</p>
                </td>
                <td className="px-3 py-2 text-xs">
                  {work.circleNames.join("、") || "-"}
                </td>
                <td className="px-3 py-2 text-xs">
                  {work.authorNames.join("、") || "-"}
                </td>
                <td className="px-3 py-2 text-xs">
                  {work.seriesName || "-"}
                </td>
                <td className="px-3 py-2 text-xs">
                  {work.genreNames.slice(0, 3).join("、") || "-"}
                </td>
                <td className="px-3 py-2 text-xs">
                  {work.productFormat || "-"}
                </td>
                <td className="px-3 py-2">
                  <p className="font-semibold text-price">{formatYen(work.price)}</p>
                  {work.originalPrice != null ? (
                    <p className="text-xs text-muted line-through">
                      {formatYen(work.originalPrice)}
                    </p>
                  ) : null}
                  {work.discountRate != null ? (
                    <p className="text-xs text-muted">{work.discountRate}% OFF</p>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-xs">
                  {work.rating != null ? `★${work.rating.toFixed(2)}` : "-"}
                  {work.reviewCount != null ? ` (${work.reviewCount})` : ""}
                </td>
                <td className="px-3 py-2 text-xs">
                  <p>{work.isPublished ? "公開" : "非公開"}</p>
                  <p>{work.isSale ? "セール中" : "通常"}</p>
                </td>
                <td className="px-3 py-2 text-xs text-muted">
                  {work.updatedAt.slice(0, 10)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          disabled={page <= 1 || pending}
          onClick={() => updateParams({ page: String(page - 1) })}
          className="h-10 rounded-lg border border-border px-3 text-sm disabled:opacity-40"
        >
          前へ
        </button>
        <span className="text-sm text-muted">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages || pending}
          onClick={() => updateParams({ page: String(page + 1) })}
          className="h-10 rounded-lg border border-border px-3 text-sm disabled:opacity-40"
        >
          次へ
        </button>
      </div>
    </div>
  );
}
