"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { DoujinWorkAdminRow } from "@/lib/admin/doujin-works-admin";

const FILTERS_OPEN_KEY = "doujin-admin-works-filters-open";

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
  circleId: string;
  authorId: string;
  seriesId: string;
  genreId: string;
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

function nameOf(options: FilterOption[], id: string): string {
  return options.find((row) => row.id === id)?.name ?? id;
}

type Chip = { key: string; label: string };

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
  circleId,
  authorId,
  seriesId,
  genreId,
  filters,
}: DoujinWorksAdminClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    try {
      setFiltersOpen(window.localStorage.getItem(FILTERS_OPEN_KEY) === "1");
    } catch {
      // ignore
    }
  }, []);

  function setFiltersOpenPersist(next: boolean) {
    setFiltersOpen(next);
    try {
      window.localStorage.setItem(FILTERS_OPEN_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
  }

  function updateParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value == null || value === "") {
        next.delete(key);
        continue;
      }
      if (
        (key === "published" || key === "sale") &&
        value === "all"
      ) {
        next.delete(key);
        continue;
      }
      next.set(key, value);
    }
    if (!("page" in patch)) next.delete("page");
    startTransition(() => {
      router.push(`/admin/doujin/works?${next.toString()}`);
    });
  }

  const chips: Chip[] = useMemo(() => {
    const list: Chip[] = [];
    if (published === "published") list.push({ key: "published", label: "公開中" });
    if (published === "unpublished") list.push({ key: "published", label: "非公開" });
    if (sale === "sale") list.push({ key: "sale", label: "セール中" });
    if (sale === "not-sale") list.push({ key: "sale", label: "セール以外" });
    if (pageSize !== 20) list.push({ key: "pageSize", label: `${pageSize}件表示` });
    if (circleId) {
      list.push({
        key: "circleId",
        label: `サークル：${nameOf(filters.circles, circleId)}`,
      });
    }
    if (authorId) {
      list.push({
        key: "authorId",
        label: `作者：${nameOf(filters.authors, authorId)}`,
      });
    }
    if (seriesId) {
      list.push({
        key: "seriesId",
        label: `シリーズ：${nameOf(filters.series, seriesId)}`,
      });
    }
    if (genreId) {
      list.push({
        key: "genreId",
        label: `ジャンル：${nameOf(filters.genres, genreId)}`,
      });
    }
    return list;
  }, [
    published,
    sale,
    pageSize,
    circleId,
    authorId,
    seriesId,
    genreId,
    filters.circles,
    filters.authors,
    filters.series,
    filters.genres,
  ]);

  const activeFilterCount = chips.length;

  function clearChip(key: string) {
    if (key === "published" || key === "sale") {
      updateParams({ [key]: null });
      return;
    }
    if (key === "pageSize") {
      updateParams({ pageSize: "20" });
      return;
    }
    updateParams({ [key]: null });
  }

  function clearAllDetailFilters() {
    updateParams({
      published: null,
      sale: null,
      pageSize: "20",
      circleId: null,
      authorId: null,
      seriesId: null,
      genreId: null,
    });
  }

  function applyForm(form: HTMLFormElement, closeAfter = false) {
    const data = new FormData(form);
    updateParams({
      q: String(data.get("q") ?? "").trim() || null,
      sort: String(data.get("sort") ?? "new"),
      published: String(data.get("published") ?? "all"),
      sale: String(data.get("sale") ?? "all"),
      pageSize: String(data.get("pageSize") ?? "20"),
      circleId: String(data.get("circleId") ?? "") || null,
      authorId: String(data.get("authorId") ?? "") || null,
      seriesId: String(data.get("seriesId") ?? "") || null,
      genreId: String(data.get("genreId") ?? "") || null,
    });
    if (closeAfter) setFiltersOpenPersist(false);
  }

  const selectClass =
    "mt-0.5 h-11 min-h-[44px] w-full rounded-lg border border-border px-2 text-sm md:mt-1 md:h-10";
  const labelClass = "block text-[12px] text-muted md:text-xs";

  const detailFields = (
    <>
      <label className={labelClass}>
        公開状態
        <select name="published" defaultValue={published} className={selectClass}>
          <option value="all">すべて</option>
          <option value="published">公開中</option>
          <option value="unpublished">非公開</option>
        </select>
      </label>
      <label className={labelClass}>
        セール
        <select name="sale" defaultValue={sale} className={selectClass}>
          <option value="all">すべて</option>
          <option value="sale">セール中</option>
          <option value="not-sale">セール以外</option>
        </select>
      </label>
      <label className={labelClass}>
        表示件数
        <select
          name="pageSize"
          defaultValue={String(pageSize)}
          className={selectClass}
        >
          <option value="20">20件</option>
          <option value="50">50件</option>
          <option value="100">100件</option>
        </select>
      </label>
      <div className="grid grid-cols-1 gap-3 min-[390px]:grid-cols-2 md:contents">
        <label className={labelClass}>
          サークル
          <select
            name="circleId"
            defaultValue={circleId}
            className={selectClass}
          >
            <option value="">すべて</option>
            {filters.circles.slice(0, 200).map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          作者
          <select
            name="authorId"
            defaultValue={authorId}
            className={selectClass}
          >
            <option value="">すべて</option>
            {filters.authors.slice(0, 200).map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          シリーズ
          <select
            name="seriesId"
            defaultValue={seriesId}
            className={selectClass}
          >
            <option value="">すべて</option>
            {filters.series.slice(0, 200).map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          ジャンル
          <select name="genreId" defaultValue={genreId} className={selectClass}>
            <option value="">すべて</option>
            {filters.genres.slice(0, 200).map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </>
  );

  return (
    <div className="space-y-3 md:space-y-4">
      {/* 見出し＋データ追加 */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground md:hidden">作品一覧</p>
          <p className="text-sm text-muted">
            {total.toLocaleString("ja-JP")}件
            {total > 0
              ? `中 ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)}件`
              : null}
          </p>
        </div>
        <Link
          href="/admin/doujin/fetch"
          className="inline-flex h-11 min-h-[44px] items-center rounded-lg border border-[#F78FA7] px-3 text-sm font-semibold text-[#e56b8a] md:h-10"
        >
          ＋ データ追加
        </Link>
      </div>

      {/* ===== スマホ用フォーム ===== */}
      <form
        className="space-y-2.5 md:hidden"
        onSubmit={(event) => {
          event.preventDefault();
          applyForm(event.currentTarget, true);
        }}
      >
        <label className={labelClass}>
          検索
          <input
            name="q"
            defaultValue={q}
            className="mt-0.5 h-11 min-h-[44px] w-full rounded-lg border border-border px-3 text-sm"
            placeholder="作品名・ID・サークル・作者"
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className={labelClass}>
            並び替え
            <select name="sort" defaultValue={sort} className={selectClass}>
              <option value="new">新着順</option>
              <option value="popular">人気順</option>
              <option value="price-desc">価格が高い順</option>
              <option value="price-asc">価格が安い順</option>
              <option value="rating">評価順</option>
              <option value="discount">割引率順</option>
              <option value="updated">更新日時順</option>
            </select>
          </label>
          <div className="flex flex-col justify-end">
            <button
              type="button"
              onClick={() => setFiltersOpenPersist(!filtersOpen)}
              className="inline-flex h-11 min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-white text-sm font-semibold"
            >
              絞り込み
              {activeFilterCount > 0 ? (
                <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-[#F78FA7] px-1.5 text-[11px] font-bold text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
          </div>
        </div>

        {/* 詳細パネルが閉じているときも条件を維持 */}
        {!filtersOpen ? (
          <>
            <input type="hidden" name="published" value={published} />
            <input type="hidden" name="sale" value={sale} />
            <input type="hidden" name="pageSize" value={String(pageSize)} />
            <input type="hidden" name="circleId" value={circleId} />
            <input type="hidden" name="authorId" value={authorId} />
            <input type="hidden" name="seriesId" value={seriesId} />
            <input type="hidden" name="genreId" value={genreId} />
          </>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 min-h-[44px] w-full items-center justify-center rounded-lg bg-accent text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "検索中…" : "検索・並び替えを適用"}
        </button>

        {chips.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <button
                key={`${chip.key}-${chip.label}`}
                type="button"
                onClick={() => clearChip(chip.key)}
                className="inline-flex h-8 max-w-full items-center gap-1 truncate rounded-full border border-[#F78FA7] bg-[#fff0f4] px-2.5 text-[12px] text-[#e56b8a]"
              >
                <span className="truncate">{chip.label}</span>
                <span aria-hidden>×</span>
              </button>
            ))}
          </div>
        ) : null}

        {filtersOpen ? (
          <div className="rounded-xl border border-border bg-white">
            <div className="space-y-3 p-3 pb-24">
              <p className="text-sm font-semibold">詳細条件</p>
              {detailFields}
            </div>
            <div className="sticky bottom-0 z-10 flex gap-2 border-t border-border bg-white px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => {
                  clearAllDetailFilters();
                  setFiltersOpenPersist(false);
                }}
                className="inline-flex h-11 min-h-[44px] flex-1 items-center justify-center rounded-lg border border-border text-sm font-medium"
              >
                条件をクリア
              </button>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex h-11 min-h-[44px] flex-1 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-white disabled:opacity-60"
              >
                絞り込む
              </button>
            </div>
            <div className="px-3 pb-3">
              <button
                type="button"
                onClick={() => setFiltersOpenPersist(false)}
                className="inline-flex h-11 min-h-[44px] w-full items-center justify-center rounded-lg border border-border text-sm"
              >
                閉じる
              </button>
            </div>
          </div>
        ) : null}

        {/* hidden sort already in visible select; duplicate names avoided */}
      </form>

      {/* ===== PC用フォーム（常時展開） ===== */}
      <form
        className="hidden gap-3 rounded-xl border border-border bg-white p-4 md:grid md:grid-cols-2 lg:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          applyForm(event.currentTarget);
        }}
      >
        <label className={`${labelClass} md:col-span-2`}>
          検索（作品名・ID・サークル・作者）
          <input
            name="q"
            defaultValue={q}
            className="mt-1 h-10 w-full rounded-lg border border-border px-3 text-sm"
            placeholder="キーワード"
          />
        </label>
        <label className={labelClass}>
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
        {detailFields}
        <div className="flex items-end gap-2 md:col-span-2 lg:col-span-4">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
          >
            {pending ? "検索中…" : "絞り込み"}
          </button>
        </div>
      </form>

      {/* スマホカード */}
      <div className="space-y-2.5 md:hidden">
        {items.map((work) => {
          const open = expandedId === work.id;
          return (
            <article
              key={work.id}
              className="rounded-xl border border-border bg-white p-3 shadow-sm"
            >
              <div className="flex gap-3">
                <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded bg-surface">
                  {work.imageUrl ? (
                    <Image
                      src={work.imageUrl}
                      alt=""
                      fill
                      className="object-contain"
                      sizes="64px"
                      unoptimized
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug">
                    {work.title}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted">
                    {work.contentId}
                  </p>
                  <p className="mt-0.5 truncate text-xs">
                    {work.circleNames.join("、") || "-"}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-bold text-price">
                      {formatYen(work.price)}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        work.isPublished
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-surface text-muted"
                      }`}
                    >
                      {work.isPublished ? "公開" : "非公開"}
                    </span>
                    {work.isSale ? (
                      <span className="rounded bg-[#fff0f4] px-1.5 py-0.5 text-[10px] font-medium text-[#e56b8a]">
                        セール
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedId((prev) => (prev === work.id ? null : work.id))
                  }
                  className="inline-flex h-10 min-h-[40px] flex-1 items-center justify-center rounded-lg border border-border text-xs font-medium"
                >
                  {open ? "詳細を閉じる" : "詳細を見る"}
                </button>
                <Link
                  href={`/doujin/works/${encodeURIComponent(work.id)}`}
                  className="inline-flex h-10 min-h-[40px] flex-1 items-center justify-center rounded-lg border border-[#F78FA7] text-xs font-semibold text-[#e56b8a]"
                >
                  サイトで見る
                </Link>
              </div>
              {open ? (
                <dl className="mt-2 space-y-1 border-t border-border pt-2 text-xs text-muted">
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0">作者</dt>
                    <dd>{work.authorNames.join("、") || "-"}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0">シリーズ</dt>
                    <dd>{work.seriesName || "-"}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0">ジャンル</dt>
                    <dd>{work.genreNames.join("、") || "-"}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0">形式</dt>
                    <dd>{work.productFormat || "-"}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0">評価</dt>
                    <dd>
                      {work.rating != null ? `★${work.rating.toFixed(2)}` : "-"}
                      {work.reviewCount != null ? ` (${work.reviewCount})` : ""}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0">更新</dt>
                    <dd>{work.updatedAt.slice(0, 16).replace("T", " ")}</dd>
                  </div>
                </dl>
              ) : null}
            </article>
          );
        })}
      </div>

      {/* PCテーブル */}
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-white md:block">
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
                <td className="px-3 py-2 text-xs">{work.seriesName || "-"}</td>
                <td className="px-3 py-2 text-xs">
                  {work.genreNames.slice(0, 3).join("、") || "-"}
                </td>
                <td className="px-3 py-2 text-xs">
                  {work.productFormat || "-"}
                </td>
                <td className="px-3 py-2">
                  <p className="font-semibold text-price">
                    {formatYen(work.price)}
                  </p>
                  {work.discountRate != null ? (
                    <p className="text-xs text-muted">{work.discountRate}% OFF</p>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-xs">
                  {work.rating != null ? `★${work.rating.toFixed(2)}` : "-"}
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

      <div className="flex items-center justify-center gap-2 pb-2">
        <button
          type="button"
          disabled={page <= 1 || pending}
          onClick={() => updateParams({ page: String(page - 1) })}
          className="h-11 min-h-[44px] rounded-lg border border-border px-4 text-sm disabled:opacity-40 md:h-10"
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
          className="h-11 min-h-[44px] rounded-lg border border-border px-4 text-sm disabled:opacity-40 md:h-10"
        >
          次へ
        </button>
      </div>
    </div>
  );
}
