"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { ACTRESS_LINK_CLASS } from "@/components/ui/ActressNameLinks";
import {
  getLabelDetailPath,
  getMakerDetailPath,
  getSeriesDetailPath,
} from "@/lib/entities/paths";
import { slugify } from "@/lib/utils";

type ClampExpandableProps = {
  text: string;
  lines?: 3;
  emptyLabel?: string;
  textClassName?: string;
  toggleClassName?: string;
  href?: string;
};

/** 初期は line-clamp、はみ出す場合のみ「続きを見る」 */
export function ClampExpandable({
  text,
  lines = 3,
  emptyLabel = "—",
  textClassName = "",
  toggleClassName = "mt-1 text-[11px] font-medium text-accent hover:underline",
  href,
}: ClampExpandableProps) {
  const trimmed = text.trim();
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el || expanded) return;
    setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [trimmed, expanded, lines]);

  if (!trimmed) {
    return <span className="text-muted">{emptyLabel}</span>;
  }

  const clampClass = expanded ? "" : "line-clamp-3";

  return (
    <div>
      <p
        ref={textRef}
        className={`${clampClass} break-words leading-snug ${textClassName}`.trim()}
      >
        {href ? (
          <Link href={href} className="hover:text-accent">
            {trimmed}
          </Link>
        ) : (
          trimmed
        )}
      </p>
      {overflows || expanded ? (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className={toggleClassName}
          aria-expanded={expanded}
        >
          {expanded ? "閉じる" : "続きを見る"}
        </button>
      ) : null}
    </div>
  );
}

type EntityKind = "maker" | "label" | "series";

function getEntityPath(kind: EntityKind, slug: string): string {
  if (kind === "maker") return getMakerDetailPath(slug);
  if (kind === "label") return getLabelDetailPath(slug);
  return getSeriesDetailPath(slug);
}

type CompareEntityNameLinkProps = {
  name?: string | null;
  kind: EntityKind;
  emptyLabel?: string;
};

export function CompareEntityNameLink({
  name,
  kind,
  emptyLabel = "—",
}: CompareEntityNameLinkProps) {
  const trimmed = name?.trim();
  if (!trimmed) {
    return <span className="text-muted">{emptyLabel}</span>;
  }

  const slug = slugify(trimmed);
  if (!slug) {
    return <span>{trimmed}</span>;
  }

  return (
    <Link href={getEntityPath(kind, slug)} className={ACTRESS_LINK_CLASS}>
      {trimmed}
    </Link>
  );
}
