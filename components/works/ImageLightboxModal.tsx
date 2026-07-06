"use client";

import Image from "next/image";
import { useEffect } from "react";

type ImageLightboxModalProps = {
  src: string;
  alt: string;
  onClose: () => void;
};

export function ImageLightboxModal({
  src,
  alt,
  onClose,
}: ImageLightboxModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="画像の拡大表示"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/20"
      >
        閉じる
      </button>
      <div
        className="relative max-h-[90vh] w-full max-w-5xl"
        onClick={(event) => event.stopPropagation()}
      >
        <Image
          src={src}
          alt={alt}
          width={1280}
          height={720}
          className="mx-auto h-auto max-h-[90vh] w-auto object-contain"
          unoptimized
        />
      </div>
    </div>
  );
}
