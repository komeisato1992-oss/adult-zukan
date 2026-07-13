"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import {
  DOUJIN_COMPARE_GA_EVENTS,
  trackDoujinCompareEvent,
} from "@/lib/doujin/compare/analytics";
import { buildDoujinCompareSelectHref } from "@/lib/doujin/compare/urls";

export type DoujinCompareCandidateGuidePayload = {
  contentId: string;
  title: string;
};

const GUIDE_EVENT = "doujin:compare-candidate-guide";

export function openDoujinCompareCandidateGuide(
  payload: DoujinCompareCandidateGuidePayload,
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(GUIDE_EVENT, {
      detail: payload,
    }),
  );
}

export function DoujinCompareCandidateGuide() {
  const titleId = useId();
  const [payload, setPayload] =
    useState<DoujinCompareCandidateGuidePayload | null>(null);

  useEffect(() => {
    const onGuide = (event: Event) => {
      const detail = (event as CustomEvent<DoujinCompareCandidateGuidePayload>)
        .detail;
      if (!detail?.contentId) return;
      setPayload(detail);
      trackDoujinCompareEvent(DOUJIN_COMPARE_GA_EVENTS.candidatePopupShow, {
        content_id: detail.contentId,
      });
    };
    window.addEventListener(GUIDE_EVENT, onGuide);
    return () => window.removeEventListener(GUIDE_EVENT, onGuide);
  }, []);

  if (!payload) return null;

  function close() {
    setPayload(null);
  }

  const similarHref = buildDoujinCompareSelectHref(payload.contentId);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-end sm:justify-end">
      <button
        type="button"
        aria-label="閉じる"
        className="absolute inset-0 bg-black/20"
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-md rounded-t-2xl border border-border bg-white p-4 shadow-xl sm:bottom-6 sm:right-6 sm:mb-0 sm:mr-0 sm:w-[360px] sm:rounded-xl sm:p-5"
      >
        <button
          type="button"
          onClick={close}
          className="absolute right-3 top-3 rounded p-1 text-muted hover:bg-surface hover:text-foreground"
          aria-label="閉じる"
        >
          ✕
        </button>

        <p id={titleId} className="pr-8 text-sm font-bold text-foreground">
          「
          <span className="line-clamp-2 inline">
            {payload.title.length > 40
              ? `${payload.title.slice(0, 40)}…`
              : payload.title}
          </span>
          」を比較に追加しました
        </p>
        <p className="mt-2 text-sm text-muted">
          似ている作品から比較対象を選びますか？
        </p>

        <div className="mt-4 space-y-2">
          <Link
            href={similarHref}
            onClick={() => {
              trackDoujinCompareEvent(DOUJIN_COMPARE_GA_EVENTS.seeSimilarClick, {
                content_id: payload.contentId,
              });
              close();
            }}
            className="flex min-h-11 w-full items-center justify-center rounded-md bg-accent px-3 py-2.5 text-sm font-bold text-white hover:bg-accent-hover"
          >
            似ている作品を見る
          </Link>
          <Link
            href="/doujin/works"
            onClick={() => {
              trackDoujinCompareEvent(DOUJIN_COMPARE_GA_EVENTS.browseListClick, {
                content_id: payload.contentId,
              });
              close();
            }}
            className="flex min-h-11 w-full items-center justify-center rounded-md border border-accent px-3 py-2.5 text-sm font-bold text-accent hover:bg-accent-light"
          >
            作品一覧から探す
          </Link>
          <button
            type="button"
            onClick={() => {
              trackDoujinCompareEvent(DOUJIN_COMPARE_GA_EVENTS.laterClick, {
                content_id: payload.contentId,
              });
              close();
            }}
            className="flex min-h-10 w-full items-center justify-center rounded-md px-3 py-2 text-sm text-muted hover:text-foreground"
          >
            あとで選ぶ
          </button>
        </div>
      </div>
    </div>
  );
}
