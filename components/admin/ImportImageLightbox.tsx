"use client";

import { useEffect, useRef, useState } from "react";

type ImportImageLightboxProps = {
  src: string;
  alt: string;
  onClose: () => void;
};

function getTouchDistance(touchA: React.Touch, touchB: React.Touch): number {
  return Math.hypot(touchA.clientX - touchB.clientX, touchA.clientY - touchB.clientY);
}

export function ImportImageLightbox({
  src,
  alt,
  onClose,
}: ImportImageLightboxProps) {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const pinchState = useRef<{ distance: number; scale: number } | null>(null);
  const dragState = useRef<{
    startX: number;
    startY: number;
    translateX: number;
    translateY: number;
  } | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    if (event.touches.length === 2) {
      pinchState.current = {
        distance: getTouchDistance(event.touches[0], event.touches[1]),
        scale,
      };
      dragState.current = null;
      return;
    }

    if (event.touches.length === 1 && scale > 1) {
      dragState.current = {
        startX: event.touches[0].clientX,
        startY: event.touches[0].clientY,
        translateX: translate.x,
        translateY: translate.y,
      };
    }
  }

  function handleTouchMove(event: React.TouchEvent<HTMLDivElement>) {
    if (event.touches.length === 2 && pinchState.current) {
      event.preventDefault();
      const distance = getTouchDistance(event.touches[0], event.touches[1]);
      const nextScale = Math.min(
        4,
        Math.max(1, (pinchState.current.scale * distance) / pinchState.current.distance),
      );
      setScale(nextScale);
      return;
    }

    if (event.touches.length === 1 && dragState.current) {
      event.preventDefault();
      setTranslate({
        x:
          dragState.current.translateX +
          (event.touches[0].clientX - dragState.current.startX),
        y:
          dragState.current.translateY +
          (event.touches[0].clientY - dragState.current.startY),
      });
    }
  }

  function handleTouchEnd() {
    pinchState.current = null;
    dragState.current = null;

    if (scale <= 1.05) {
      setScale(1);
      setTranslate({ x: 0, y: 0 });
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="画像の拡大表示"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-2xl leading-none text-white"
        aria-label="閉じる"
      >
        ×
      </button>

      <div
        className="flex max-h-[90vh] max-w-[90vw] touch-none items-center justify-center"
        onClick={(event) => event.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onWheel={(event) => {
          event.preventDefault();
          setScale((current) =>
            Math.min(4, Math.max(1, current + (event.deltaY > 0 ? -0.12 : 0.12))),
          );
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="max-h-[90vh] max-w-[90vw] select-none object-contain"
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          }}
          draggable={false}
        />
      </div>
    </div>
  );
}
