"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type RefObject,
} from "react";

type DoujinSampleLightboxProps = {
  title: string;
  images: string[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
};

function wrapIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

export function DoujinSampleLightbox({
  title,
  images,
  index,
  onClose,
  onIndexChange,
  returnFocusRef,
}: DoujinSampleLightboxProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const titleId = useId();
  const [failed, setFailed] = useState(false);
  const currentIndex = wrapIndex(index, images.length);
  const currentSrc = images[currentIndex];
  const total = images.length;

  const goPrev = useCallback(() => {
    onIndexChange(wrapIndex(currentIndex - 1, total));
  }, [currentIndex, onIndexChange, total]);

  const goNext = useCallback(() => {
    onIndexChange(wrapIndex(currentIndex + 1, total));
  }, [currentIndex, onIndexChange, total]);

  useEffect(() => {
    setFailed(false);
  }, [currentSrc]);

  // 前後画像の事前読み込み（現在±1のみ）
  useEffect(() => {
    if (total < 2) return;
    const neighbors = [
      images[wrapIndex(currentIndex - 1, total)],
      images[wrapIndex(currentIndex + 1, total)],
    ];
    for (const src of neighbors) {
      if (!src || src === currentSrc) continue;
      const img = new window.Image();
      img.src = src;
    }
  }, [currentIndex, currentSrc, images, total]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrev();
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
        return;
      }

      // 簡易フォーカストラップ
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      returnFocusRef?.current?.focus();
    };
  }, [goNext, goPrev, onClose, returnFocusRef]);

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    if (event.touches.length !== 1) {
      touchStart.current = null;
      return;
    }
    touchStart.current = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY,
    };
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || event.changedTouches.length !== 1) return;

    const endX = event.changedTouches[0].clientX;
    const endY = event.changedTouches[0].clientY;
    const deltaX = endX - start.x;
    const deltaY = endY - start.y;
    if (Math.abs(deltaX) < 50) return;
    if (Math.abs(deltaX) <= Math.abs(deltaY)) return;

    if (deltaX < 0) goNext();
    else goPrev();
  }

  if (!currentSrc) return null;

  return (
    <div
      ref={dialogRef}
      className="doujin-sample-lightbox fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0, 0, 0, 0.88)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => {
        touchStart.current = null;
      }}
    >
      <p id={titleId} className="sr-only">
        {title} のサンプル画像
      </p>

      <button
        ref={closeButtonRef}
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 z-20 flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/10 px-3 text-sm font-medium text-white backdrop-blur hover:bg-white/20"
        aria-label="閉じる"
      >
        閉じる
      </button>

      <p className="absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-sm text-white">
        {currentIndex + 1} / {total}
      </p>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          goPrev();
        }}
        className="absolute left-2 top-1/2 z-20 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-2xl text-white backdrop-blur hover:bg-white/20 sm:left-4"
        aria-label="前の画像"
      >
        ‹
      </button>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          goNext();
        }}
        className="absolute right-2 top-1/2 z-20 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-2xl text-white backdrop-blur hover:bg-white/20 sm:right-4"
        aria-label="次の画像"
      >
        ›
      </button>

      <div
        className="relative z-10 flex max-h-[88vh] max-w-[min(92vw,1200px)] items-center justify-center px-12 sm:px-16"
        onClick={(event) => event.stopPropagation()}
      >
        {failed ? (
          <p className="rounded bg-white/10 px-4 py-3 text-sm text-white">
            画像を読み込めませんでした
          </p>
        ) : (
          <Image
            src={currentSrc}
            alt={`${title} サンプル画像 ${currentIndex + 1}`}
            width={1200}
            height={900}
            className="doujin-sample-lightbox__image h-auto w-auto"
            style={{
              maxWidth: "min(92vw, 1200px)",
              maxHeight: "88vh",
              objectFit: "contain",
            }}
            priority
            unoptimized
            onError={() => setFailed(true)}
          />
        )}
      </div>
    </div>
  );
}
