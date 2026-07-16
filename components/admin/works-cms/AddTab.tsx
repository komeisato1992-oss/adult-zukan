"use client";

import Image from "next/image";
import { useMemo, useState, type ReactNode } from "react";
import { getAdultImportSortLabel } from "@/lib/admin/import-simple-types";
import {
  getDmmItemActressNameList,
  getDmmItemImageUrl,
  getDmmItemMakerName,
} from "@/lib/dmm/display";
import { formatDmmItemPrice } from "@/lib/dmm/release-date";
import { urlIndicatesNowPrinting } from "@/lib/works/package-image";
import {
  FETCH_COUNTS,
  type AddStep,
  type AdultImportSortMode,
  type FetchedImportCandidate,
  type FetchImportCandidatesSummary,
} from "@/components/admin/works-cms/types";

/** 数字以外を除去し、先頭の余分な0を落とす（050→50, 000→0） */
function normalizeOffsetDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return digits.replace(/^0+(?=\d)/, "");
}

function parseOffsetNumber(digits: string): number {
  if (!digits) return 0;
  const n = Number(digits);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function isImageOk(c: FetchedImportCandidate): boolean {
  return c.imageStatus === "ok" && !c.imageUrlMissing;
}

function needsImageWarning(c: FetchedImportCandidate): boolean {
  return !isImageOk(c);
}

type AddTabProps = {
  sort: AdultImportSortMode;
  setSort: (v: AdultImportSortMode) => void;
  fetchCount: (typeof FETCH_COUNTS)[number];
  setFetchCount: (v: (typeof FETCH_COUNTS)[number]) => void;
  offset: number;
  setOffset: (v: number | ((prev: number) => number)) => void;
  candidates: FetchedImportCandidate[];
  summary: FetchImportCandidatesSummary | null;
  selected: Set<string>;
  setSelected: (next: Set<string>) => void;
  cidInput: string;
  setCidInput: (v: string) => void;
  busy: boolean;
  onFetch: () => void;
  onAddByCid: () => void;
  onRecheckFailedImages: () => void;
  step: AddStep;
};

const STEPS: Array<{ id: AddStep; label: string }> = [
  { id: 1, label: "条件を選ぶ" },
  { id: 2, label: "候補を取得" },
  { id: 3, label: "作品を選択" },
  { id: 4, label: "Supabaseへ追加" },
];

export function WorksCmsAddTab({
  sort,
  setSort,
  fetchCount,
  setFetchCount,
  offset,
  setOffset,
  candidates,
  summary,
  selected,
  setSelected,
  cidInput,
  setCidInput,
  busy,
  onFetch,
  onAddByCid,
  onRecheckFailedImages,
  step,
}: AddTabProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  /** フォーカス中のみ文字列編集。null のときは offset(number) を表示 */
  const [offsetDraft, setOffsetDraft] = useState<string | null>(null);

  const imageStats = useMemo(() => {
    let ok = 0;
    let nowPrinting = 0;
    let fetchFailed = 0;
    let noUrl = 0;
    for (const c of candidates) {
      if (c.imageUrlMissing) noUrl += 1;
      else if (c.imageStatus === "ok") ok += 1;
      else if (c.imageStatus === "now_printing") nowPrinting += 1;
      else fetchFailed += 1;
    }
    return {
      total: candidates.length,
      ok,
      nowPrinting,
      fetchFailed,
      noUrl,
      selected: selected.size,
    };
  }, [candidates, selected]);

  const failedRecheckCount = useMemo(
    () =>
      candidates.filter(
        (c) => c.imageStatus === "fetch_failed" && !c.imageUrlMissing,
      ).length,
    [candidates],
  );

  const applyOffset = (next: number | ((prev: number) => number)) => {
    setOffsetDraft(null);
    setOffset(next);
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectImageOkOnly = () => {
    setSelected(
      new Set(candidates.filter(isImageOk).map((c) => c.contentId)),
    );
  };

  return (
    <section className="space-y-3">
      <ol className="flex gap-1 overflow-x-auto pb-0.5 text-[11px] sm:text-xs">
        {STEPS.map((s) => {
          const active = step === s.id;
          const done = step > s.id;
          return (
            <li
              key={s.id}
              className={`flex min-w-[4.5rem] flex-1 items-center gap-1 rounded-lg border px-2 py-1.5 ${
                active
                  ? "border-sky-400 bg-sky-50 font-bold text-sky-900"
                  : done
                    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                    : "border-border bg-white text-muted"
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  active
                    ? "bg-sky-600 text-white"
                    : done
                      ? "bg-emerald-600 text-white"
                      : "bg-zinc-200 text-zinc-600"
                }`}
              >
                {s.id}
              </span>
              <span className="leading-tight">{s.label}</span>
            </li>
          );
        })}
      </ol>

      <div className="rounded-xl border border-border bg-white p-3 space-y-3">
        <p className="text-sm font-bold">1. 条件を選ぶ</p>
        <div className="flex flex-wrap gap-1.5">
          {(["new", "popular"] as AdultImportSortMode[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSort(s)}
              className={`min-h-[40px] flex-1 rounded-lg px-3 text-sm sm:flex-none ${
                sort === s
                  ? "bg-sky-600 font-semibold text-white"
                  : "border border-border bg-white"
              }`}
            >
              {getAdultImportSortLabel(s)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FETCH_COUNTS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setFetchCount(n)}
              className={`min-h-[36px] rounded-lg px-2.5 text-sm ${
                fetchCount === n
                  ? "bg-sky-600 font-semibold text-white"
                  : "border border-border"
              }`}
            >
              {n}件
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <label className="text-xs text-muted" htmlFor="add-offset">
            offset
          </label>
          <input
            id="add-offset"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            enterKeyHint="done"
            value={offsetDraft !== null ? offsetDraft : String(offset)}
            onFocus={() => {
              setOffsetDraft(offset === 0 ? "" : String(offset));
            }}
            onChange={(e) => {
              const next = normalizeOffsetDigits(e.target.value);
              setOffsetDraft(next);
              if (next !== "") {
                setOffset(parseOffsetNumber(next));
              }
            }}
            onBlur={() => {
              const next =
                offsetDraft === null || offsetDraft === ""
                  ? 0
                  : parseOffsetNumber(offsetDraft);
              setOffset(next);
              setOffsetDraft(null);
            }}
            className="min-h-[36px] w-24 rounded-lg border border-border px-2 tabular-nums"
          />
          <button
            type="button"
            className="min-h-[36px] rounded-lg border px-2.5 text-xs"
            onClick={() =>
              applyOffset((v) => Math.max(0, v - fetchCount))
            }
          >
            前へ
          </button>
          <button
            type="button"
            className="min-h-[36px] rounded-lg border px-2.5 text-xs"
            onClick={() => applyOffset((v) => v + fetchCount)}
          >
            次へ
          </button>
          <button
            type="button"
            className="min-h-[36px] rounded-lg border px-2.5 text-xs"
            onClick={() => applyOffset(0)}
          >
            0に戻す
          </button>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={onFetch}
          className="min-h-[44px] w-full rounded-xl bg-sky-600 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? "取得・画像確認中…" : "2. 候補を取得"}
        </button>
      </div>

      {summary ? (
        <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-sky-200 bg-sky-50 p-2 text-[11px] text-sky-950 sm:grid-cols-6">
          <Stat label="API取得" value={summary.apiFetchedCount} />
          <Stat label="既存作品" value={summary.publishedExcludedCount} />
          <Stat label="重複除外" value={summary.duplicateExcludedCount} />
          <Stat label="無効除外" value={summary.invalidExcludedCount} />
          <Stat label="新規候補" value={summary.candidateCount} />
          <Stat
            label="初期選択"
            value={summary.initialSelectedCount ?? imageStats.ok}
          />
        </div>
      ) : null}

      {candidates.length > 0 ? (
        <div className="space-y-2 rounded-xl border border-border bg-white p-3">
          <div className="grid grid-cols-2 gap-1.5 text-[11px] sm:grid-cols-3">
            <Stat label="候補総数" value={imageStats.total} />
            <Stat label="画像あり" value={imageStats.ok} />
            <Stat label="NOW PRINTING" value={imageStats.nowPrinting} />
            <Stat label="画像確認失敗" value={imageStats.fetchFailed} />
            <Stat label="画像URLなし" value={imageStats.noUrl} />
            <Stat label="選択中" value={imageStats.selected} />
          </div>
          {summary?.imageCheckMessage ? (
            <p className="text-xs text-muted">{summary.imageCheckMessage}</p>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className="min-h-[36px] rounded-lg border px-2.5 text-xs font-semibold"
              onClick={selectImageOkOnly}
              disabled={busy || imageStats.ok === 0}
            >
              画像ありだけ選択
            </button>
            <button
              type="button"
              className="min-h-[36px] rounded-lg border px-2.5 text-xs font-semibold"
              onClick={onRecheckFailedImages}
              disabled={busy || failedRecheckCount === 0}
            >
              画像確認失敗を再確認
              {failedRecheckCount > 0 ? `（${failedRecheckCount}）` : ""}
            </button>
          </div>
        </div>
      ) : null}

      <details className="rounded-xl border border-border bg-white p-3">
        <summary className="cursor-pointer text-sm font-bold">
          CID直接追加
        </summary>
        <div className="mt-2 space-y-2">
          <textarea
            value={cidInput}
            onChange={(e) => setCidInput(e.target.value)}
            rows={2}
            placeholder="CIDを改行またはカンマ区切り"
            className="w-full rounded-lg border border-border p-2 text-sm"
          />
          <button
            type="button"
            disabled={busy || !cidInput.trim()}
            onClick={onAddByCid}
            className="min-h-[40px] w-full rounded-lg bg-sky-600 text-sm font-bold text-white disabled:opacity-50"
          >
            CIDでSupabaseへ追加
          </button>
        </div>
      </details>

      <ul className="space-y-1.5">
        {candidates.map((c) => {
          const id = c.contentId;
          const checked = selected.has(id);
          const rawImageUrl = c.packageImage || getDmmItemImageUrl(c.item);
          const showPlaceholder =
            c.imageUrlMissing ||
            c.imageStatus === "now_printing" ||
            urlIndicatesNowPrinting(rawImageUrl);
          const expanded = expandedIds.has(id);
          const actresses = getDmmItemActressNameList(c.item);
          const warn = checked && needsImageWarning(c);
          return (
            <li
              key={id}
              className={`rounded-xl border p-2 ${
                checked ? "border-sky-400 bg-sky-50/40" : "border-border bg-white"
              }`}
            >
              <div className="flex gap-2">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleSelect(id)}
                  className="mt-3"
                  aria-label={`${c.item.title} を選択`}
                />
                <div className="relative flex h-14 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-zinc-100">
                  {showPlaceholder || !rawImageUrl ? (
                    <span className="px-0.5 text-center text-[9px] font-semibold leading-tight text-zinc-500">
                      画像準備中
                    </span>
                  ) : (
                    <Image
                      src={rawImageUrl}
                      alt=""
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium leading-snug">
                    {c.item.title}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted">
                    {id} · {getDmmItemMakerName(c.item) ?? "—"}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <ImageStatusBadges candidate={c} />
                    <Badge tone="ok">新規</Badge>
                    <span className="text-[11px] text-muted">
                      {formatDmmItemPrice(c.item) || "—"}
                    </span>
                  </div>
                  {warn ? (
                    <p className="mt-1 text-[11px] leading-snug text-amber-800">
                      画像を確認できていない作品です。追加すると画像なしで公開される可能性があります。
                    </p>
                  ) : null}
                  <button
                    type="button"
                    className="mt-1 text-[11px] font-medium text-sky-700 underline"
                    onClick={() => toggleExpand(id)}
                  >
                    {expanded ? "閉じる" : "詳細"}
                  </button>
                  {expanded ? (
                    <div className="mt-1 space-y-0.5 text-[11px] text-muted">
                      <p>女優: {actresses.slice(0, 5).join("、") || "—"}</p>
                      <p>発売日: {c.item.date || "—"}</p>
                      <p>価格: {formatDmmItemPrice(c.item) || "—"}</p>
                      <p>
                        image_status: {c.imageStatus ?? "未判定"}
                        {c.imageStatusCheckedAt
                          ? ` @ ${c.imageStatusCheckedAt}`
                          : ""}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {candidates.length === 0 && summary ? (
        <p className="rounded-lg bg-zinc-100 px-3 py-2 text-xs text-muted">
          新規候補はありません。offsetを変えて再取得してください。
        </p>
      ) : null}
    </section>
  );
}

function ImageStatusBadges({
  candidate,
}: {
  candidate: FetchedImportCandidate;
}) {
  if (candidate.imageUrlMissing) {
    return <Badge tone="muted">画像URLなし</Badge>;
  }
  if (candidate.imageStatus === "ok") {
    return <Badge tone="ok">画像あり</Badge>;
  }
  if (candidate.imageStatus === "now_printing") {
    return (
      <>
        <Badge tone="danger">NOW PRINTING</Badge>
        <Badge tone="warn">自動選択解除</Badge>
      </>
    );
  }
  if (candidate.imageStatus === "fetch_failed") {
    return (
      <>
        <Badge tone="orange">画像確認失敗</Badge>
        <Badge tone="muted">再確認できます</Badge>
      </>
    );
  }
  return <Badge tone="muted">未判定</Badge>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-white/70 px-1.5 py-1 text-center">
      <p className="opacity-70">{label}</p>
      <p className="font-bold tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "ok" | "warn" | "danger" | "orange" | "muted";
}) {
  const toneClass =
    tone === "ok"
      ? "bg-emerald-100 text-emerald-800"
      : tone === "warn"
        ? "bg-amber-100 text-amber-900"
        : tone === "danger"
          ? "bg-red-100 text-red-800"
          : tone === "orange"
            ? "bg-orange-100 text-orange-900"
            : "bg-zinc-100 text-zinc-700";
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${toneClass}`}
    >
      {children}
    </span>
  );
}
