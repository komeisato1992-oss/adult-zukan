"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { DoujinSampleLightbox } from "@/components/doujin/DoujinSampleLightbox";
import { DoujinSectionHeading } from "@/components/doujin/DoujinSectionHeading";
import { sanitizeDoujinSampleImageUrls } from "@/lib/doujin/sample-images";

export type DoujinSampleGalleryProps = {
  title: string;
  images: string[];
};

export function DoujinSampleGallery({ title, images }: DoujinSampleGalleryProps) {
  const sanitized = sanitizeDoujinSampleImageUrls(images);
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hiddenIndexes, setHiddenIndexes] = useState<Set<number>>(
    () => new Set(),
  );
  const triggerRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  if (sanitized.length === 0) return null;

  const visibleCount = sanitized.length - hiddenIndexes.size;
  if (visibleCount <= 0) return null;

  function openAt(index: number, trigger: HTMLButtonElement | null) {
    lastTriggerRef.current = trigger;
    setCurrentIndex(index);
    setIsOpen(true);
  }

  return (
    <>
      <section
        aria-labelledby="doujin-sample-images-title"
        className="doujin-sample-gallery mt-10"
      >
        <DoujinSectionHeading
          title="サンプル画像"
          id="doujin-sample-images-title"
        />

        <div className="doujin-sample-gallery__grid grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {sanitized.map((src, index) => {
            if (hiddenIndexes.has(index)) return null;
            return (
              <button
                key={`${src}-${index}`}
                ref={(node) => {
                  triggerRefs.current[index] = node;
                }}
                type="button"
                onClick={(event) => openAt(index, event.currentTarget)}
                className="doujin-sample-gallery__item group relative cursor-zoom-in overflow-hidden rounded border border-border bg-[#f7f7f7] transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                style={{ aspectRatio: "4 / 3" }}
                aria-label={`${title} サンプル画像 ${index + 1} を拡大表示`}
              >
                <Image
                  src={src}
                  alt={`${title} サンプル画像 ${index + 1}`}
                  fill
                  loading="lazy"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                  className="doujin-sample-gallery__image"
                  unoptimized
                  onError={() => {
                    setHiddenIndexes((prev) => {
                      const next = new Set(prev);
                      next.add(index);
                      return next;
                    });
                  }}
                />
              </button>
            );
          })}
        </div>
      </section>

      {isOpen ? (
        <DoujinSampleLightbox
          title={title}
          images={sanitized}
          index={currentIndex}
          onIndexChange={setCurrentIndex}
          onClose={() => setIsOpen(false)}
          returnFocusRef={lastTriggerRef}
        />
      ) : null}
    </>
  );
}
