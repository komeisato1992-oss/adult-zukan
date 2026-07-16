"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import type { CmsListItem } from "@/components/admin/works-cms/types";
import { hasValidPackageImage } from "@/lib/works/package-image";

type PublishFilters = {
  cid: string;
  title: string;
  actress: string;
  maker: string;
  label: string;
  series: string;
  genre: string;
  status:
    | "all"
    | "published"
    | "unpublished"
    | "noImage"
    | "unavailable"
    | "manualHidden"
    | "fanzaActive"
    | "fanzaUnchecked";
};

type PublishTabProps = {
  items: CmsListItem[];
  filters: PublishFilters;
  setFilters: (next: PublishFilters) => void;
  selected: Set<string>;
  setSelected: (next: Set<string>) => void;
  busy: boolean;
  onSearch: () => void;
  onMutate: (
    action: string,
    cids: string[],
    extra?: Record<string, unknown>,
  ) => void;
  onEdit: (cid: string, title: string) => void;
  editCid: string | null;
  editTitle: string;
  setEditTitle: (v: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  fanzaReady: boolean;
};

const STATUS_OPTIONS: Array<{ id: PublishFilters["status"]; label: string }> = [
  { id: "all", label: "すべて" },
  { id: "published", label: "公開中" },
  { id: "unpublished", label: "非公開" },
  { id: "noImage", label: "画像なし" },
  { id: "unavailable", label: "販売終了" },
  { id: "manualHidden", label: "手動非公開" },
  { id: "fanzaActive", label: "見放題対象" },
  { id: "fanzaUnchecked", label: "見放題未確認" },
];

export function WorksCmsPublishTab({
  items,
  filters,
  setFilters,
  selected,
  setSelected,
  busy,
  onSearch,
  onMutate,
  onEdit,
  editCid,
  editTitle,
  setEditTitle,
  onSaveEdit,
  onCancelEdit,
  fanzaReady,
}: PublishTabProps) {
  const [showFilters, setShowFilters] = useState(false);

  const toggle = (cid: string) => {
    const next = new Set(selected);
    if (next.has(cid)) next.delete(cid);
    else next.add(cid);
    setSelected(next);
  };

  return (
    <section className="space-y-3">
      <div className="rounded-xl border border-border bg-white p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold">検索・絞り込み</p>
          <button
            type="button"
            className="text-xs text-sky-700 underline"
            onClick={() => setShowFilters((v) => !v)}
          >
            {showFilters ? "閉じる" : "詳細条件"}
          </button>
        </div>
        <input
          value={filters.title}
          onChange={(e) => setFilters({ ...filters, title: e.target.value })}
          placeholder="タイトル検索"
          className="min-h-[40px] w-full rounded-lg border border-border px-2 text-sm"
        />
        {showFilters ? (
          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                ["cid", "CID"],
                ["actress", "女優"],
                ["maker", "メーカー"],
                ["label", "レーベル"],
                ["series", "シリーズ"],
                ["genre", "ジャンル"],
              ] as const
            ).map(([key, label]) => (
              <input
                key={key}
                value={filters[key]}
                onChange={(e) =>
                  setFilters({ ...filters, [key]: e.target.value })
                }
                placeholder={label}
                className="min-h-[36px] rounded-lg border border-border px-2 text-xs"
              />
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-1">
          {STATUS_OPTIONS.map((opt) => {
            const isFanza =
              opt.id === "fanzaActive" || opt.id === "fanzaUnchecked";
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setFilters({ ...filters, status: opt.id })}
                className={`min-h-[32px] rounded-lg px-2 text-[11px] ${
                  filters.status === opt.id
                    ? "bg-sky-600 font-semibold text-white"
                    : "border border-border"
                }`}
                title={
                  isFanza && !fanzaReady ? "判定機能準備中" : undefined
                }
              >
                {opt.label}
                {isFanza && !fanzaReady ? (
                  <span className="ml-1 opacity-80">*</span>
                ) : null}
              </button>
            );
          })}
        </div>
        {!fanzaReady &&
        (filters.status === "fanzaActive" ||
          filters.status === "fanzaUnchecked") ? (
          <p className="text-[11px] text-amber-800">
            見放題関連フィルターは表示のみです（判定機能準備中）
          </p>
        ) : null}
        <button
          type="button"
          onClick={onSearch}
          disabled={busy}
          className="min-h-[40px] w-full rounded-lg bg-sky-600 text-sm font-bold text-white disabled:opacity-50"
        >
          検索
        </button>
      </div>

      <ul className="space-y-1.5">
        {items.map((item) => {
          const checked = selected.has(item.cid);
          const noImage = !hasValidPackageImage(item.package_image);
          return (
            <li
              key={item.cid}
              className="rounded-xl border border-border bg-white p-2"
            >
              <div className="flex gap-2">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(item.cid)}
                  className="mt-3"
                />
                <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded bg-zinc-100">
                  {item.package_image ? (
                    <Image
                      src={item.package_image}
                      alt=""
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium leading-snug">
                    {item.title}
                  </p>
                  <p className="truncate text-[11px] text-muted">
                    {item.cid} · {item.maker ?? "—"}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                    <Tag tone={item.published ? "ok" : "unset"}>
                      {item.published ? "公開中" : "非公開"}
                    </Tag>
                    {noImage ? <Tag tone="warn">画像なし</Tag> : null}
                    {!item.is_available ? <Tag tone="warn">販売終了</Tag> : null}
                    {item.manual_hidden ? <Tag tone="warn">手動非公開</Tag> : null}
                    {item.fanza_tv_status === "active" ? (
                      <Tag tone="ok">見放題</Tag>
                    ) : null}
                  </div>
                  <details className="mt-1">
                    <summary className="cursor-pointer text-[11px] font-medium text-sky-700">
                      操作
                    </summary>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <ActionBtn
                        onClick={() => onEdit(item.cid, item.title)}
                        label="編集"
                      />
                      <ActionBtn
                        onClick={() => onMutate("publish", [item.cid])}
                        label="公開"
                        primary
                        disabled={noImage}
                        hint={
                          noImage
                            ? "画像がないため公開できません"
                            : undefined
                        }
                      />
                      <ActionBtn
                        onClick={() => onMutate("unpublish", [item.cid])}
                        label="非公開"
                      />
                      <ActionBtn
                        onClick={() =>
                          onMutate("mark_unavailable", [item.cid])
                        }
                        label="販売終了"
                      />
                      <ActionBtn
                        onClick={() => onMutate("restore", [item.cid])}
                        label="復活"
                      />
                      <ActionBtn
                        onClick={() => onMutate("reset_fanza_tv", [item.cid])}
                        label="再取得"
                        hint={
                          !fanzaReady
                            ? "判定機能準備中（ステータスリセットのみ）"
                            : undefined
                        }
                      />
                      <ActionBtn
                        onClick={() => {
                          if (
                            typeof window !== "undefined" &&
                            window.confirm("論理削除しますか？")
                          ) {
                            onMutate("soft_delete", [item.cid]);
                          }
                        }}
                        label="削除"
                        danger
                      />
                    </div>
                  </details>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {items.length === 0 ? (
        <p className="rounded-lg bg-zinc-100 px-3 py-2 text-xs text-muted">
          該当作品がありません
        </p>
      ) : null}

      {editCid ? (
        <div className="rounded-xl border border-sky-300 bg-sky-50 p-3">
          <p className="text-sm font-bold">編集: {editCid}</p>
          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="mt-2 min-h-[40px] w-full rounded-lg border px-2 text-sm"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="min-h-[40px] flex-1 rounded-lg bg-sky-600 text-sm font-bold text-white"
              onClick={onSaveEdit}
            >
              保存
            </button>
            <button
              type="button"
              className="min-h-[40px] rounded-lg border px-3 text-sm"
              onClick={onCancelEdit}
            >
              キャンセル
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Tag({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "ok" | "warn" | "unset";
}) {
  const cls =
    tone === "ok"
      ? "bg-emerald-100 text-emerald-800"
      : tone === "warn"
        ? "bg-amber-100 text-amber-900"
        : "bg-zinc-200 text-zinc-700";
  return (
    <span className={`rounded px-1.5 py-0.5 font-semibold ${cls}`}>
      {children}
    </span>
  );
}

function ActionBtn({
  label,
  onClick,
  primary,
  danger,
  disabled,
  hint,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={`rounded-lg px-2 py-1 text-[11px] font-semibold disabled:opacity-40 ${
          danger
            ? "border border-red-400 text-red-700"
            : primary
              ? "bg-sky-600 text-white"
              : "border border-border"
        }`}
      >
        {label}
      </button>
      {disabled && hint ? (
        <span className="mt-0.5 max-w-[9rem] text-[10px] text-amber-800">
          {hint}
        </span>
      ) : null}
    </span>
  );
}

export type { PublishFilters };
