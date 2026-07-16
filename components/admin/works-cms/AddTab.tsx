"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { getAdultImportSortLabel } from "@/lib/admin/import-simple-types";
import {
  getDmmItemActressNameList,
  getDmmItemImageUrl,
  getDmmItemMakerName,
} from "@/lib/dmm/display";
import { formatDmmItemPrice } from "@/lib/dmm/release-date";
import {
  FETCH_COUNTS,
  type AddStep,
  type AdultImportSortMode,
  type FetchedImportCandidate,
  type FetchImportCandidatesSummary,
} from "@/components/admin/works-cms/types";

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
  step,
}: AddTabProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

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
            type="number"
            min={0}
            value={offset}
            onChange={(e) => setOffset(Number(e.target.value) || 0)}
            className="min-h-[36px] w-24 rounded-lg border border-border px-2"
          />
          <button
            type="button"
            className="min-h-[36px] rounded-lg border px-2.5 text-xs"
            onClick={() => setOffset((v) => Math.max(0, v - fetchCount))}
          >
            前へ
          </button>
          <button
            type="button"
            className="min-h-[36px] rounded-lg border px-2.5 text-xs"
            onClick={() => setOffset((v) => v + fetchCount)}
          >
            次へ
          </button>
          <button
            type="button"
            className="min-h-[36px] rounded-lg border px-2.5 text-xs"
            onClick={() => setOffset(0)}
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
          {busy ? "取得中…" : "2. 候補を取得"}
        </button>
      </div>

      {summary ? (
        <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-sky-200 bg-sky-50 p-2 text-[11px] text-sky-950 sm:grid-cols-6">
          <Stat label="API取得" value={summary.apiFetchedCount} />
          <Stat label="既存作品" value={summary.publishedExcludedCount} />
          <Stat label="重複除外" value={summary.duplicateExcludedCount} />
          <Stat label="画像なし除外" value={summary.imageMissingExcludedCount} />
          <Stat label="新規候補" value={summary.candidateCount} />
          <Stat label="エラー" value={summary.invalidExcludedCount} />
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
          const imageUrl = getDmmItemImageUrl(c.item);
          const expanded = expandedIds.has(id);
          const actresses = getDmmItemActressNameList(c.item);
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
                <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded bg-zinc-100">
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      alt=""
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium leading-snug">
                    {c.item.title}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted">
                    {id} · {getDmmItemMakerName(c.item) ?? "—"}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge tone={imageUrl ? "ok" : "warn"}>
                      {imageUrl ? "画像あり" : "画像なし"}
                    </Badge>
                    <Badge tone="ok">新規</Badge>
                    <span className="text-[11px] text-muted">
                      {formatDmmItemPrice(c.item) || "—"}
                    </span>
                  </div>
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
  tone: "ok" | "warn";
}) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
        tone === "ok"
          ? "bg-emerald-100 text-emerald-800"
          : "bg-amber-100 text-amber-900"
      }`}
    >
      {children}
    </span>
  );
}
