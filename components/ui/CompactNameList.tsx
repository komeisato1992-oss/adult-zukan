"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ACTRESS_LINK_CLASS } from "@/components/ui/ActressNameLinks";
import { getActressDetailPath } from "@/lib/actresses/slug";

type CompactNameListProps = {
  names: string[];
  className?: string;
};

function buildDisplayText(names: string[], visibleCount: number): string {
  if (visibleCount <= 0) return "";
  const shown = names.slice(0, visibleCount).join("・");
  const rest = names.length - visibleCount;
  return rest > 0 ? `${shown}＋${rest}名` : shown;
}

export function CompactNameList({ names, className = "" }: CompactNameListProps) {
  const hostRef = useRef<HTMLParagraphElement>(null);
  const normalizedNames = useMemo(() => names.filter(Boolean), [names]);
  const [visibleCount, setVisibleCount] = useState(normalizedNames.length);

  useEffect(() => {
    const host = hostRef.current;
    if (normalizedNames.length === 0) {
      setVisibleCount(0);
      return;
    }
    if (!host || normalizedNames.length <= 1) {
      setVisibleCount(normalizedNames.length);
      return;
    }

    const compute = () => {
      const width = host.clientWidth;
      if (width <= 0) {
        setVisibleCount(normalizedNames.length);
        return;
      }

      const style = window.getComputedStyle(host);
      const font = [
        style.fontStyle,
        style.fontVariant,
        style.fontWeight,
        style.fontSize,
        style.fontFamily,
      ].join(" ");
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setVisibleCount(normalizedNames.length);
        return;
      }
      ctx.font = font;

      let best = normalizedNames.length;
      for (let visible = normalizedNames.length; visible >= 1; visible -= 1) {
        const candidate = buildDisplayText(normalizedNames, visible);
        if (ctx.measureText(candidate).width <= width) {
          best = visible;
          break;
        }
      }
      setVisibleCount(best);
    };

    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(host);
    return () => observer.disconnect();
  }, [normalizedNames]);

  if (normalizedNames.length === 0) {
    return <p className={`truncate text-sm text-muted ${className}`}>-</p>;
  }

  const shown = normalizedNames.slice(0, visibleCount);
  const rest = normalizedNames.length - visibleCount;

  return (
    <p ref={hostRef} className={`truncate text-sm font-medium ${className}`}>
      {shown.map((name, index) => (
        <span key={name}>
          {index > 0 && "・"}
          <Link href={getActressDetailPath(name)} className={ACTRESS_LINK_CLASS}>
            {name}
          </Link>
        </span>
      ))}
      {rest > 0 ? <span className="text-foreground">＋{rest}名</span> : null}
    </p>
  );
}
