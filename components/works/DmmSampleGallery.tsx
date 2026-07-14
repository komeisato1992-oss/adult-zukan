"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageLightboxModal } from "@/components/works/ImageLightboxModal";

type DmmSampleGalleryProps = {
  images: string[];
  title: string;
};

const MOBILE_INITIAL_COUNT = 4;
/** PC: 2行×6列相当まで初期表示 */
const DESKTOP_INITIAL_COUNT = 12;

export function DmmSampleGallery({ images, title }: DmmSampleGalleryProps) {
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [desktopExpanded, setDesktopExpanded] = useState(false);

  if (images.length === 0) {
    return null;
  }

  const mobileHiddenCount = Math.max(0, images.length - MOBILE_INITIAL_COUNT);
  const desktopHiddenCount = Math.max(0, images.length - DESKTOP_INITIAL_COUNT);
  const showMobileToggle = mobileHiddenCount > 0;
  const showDesktopToggle = desktopHiddenCount > 0;

  return (
    <>
      <section
        aria-labelledby="sample-images-title"
        className="mt-8 max-[768px]:mt-6"
      >
        <h2
          id="sample-images-title"
          className="mb-3 border-l-4 border-accent pl-3 text-lg font-bold text-foreground max-[768px]:mb-3 max-[768px]:text-[17px]"
        >
          サンプル画像
        </h2>

        <div className="grid grid-cols-2 gap-2 min-[769px]:gap-3 lg:grid-cols-6">
          {images.map((image, index) => {
            const hideOnMobile =
              index >= MOBILE_INITIAL_COUNT && !mobileExpanded;
            const hideOnDesktop =
              index >= DESKTOP_INITIAL_COUNT && !desktopExpanded;

            return (
              <button
                key={`${image}-${index}`}
                type="button"
                onClick={() => setActiveImage(image)}
                className={`relative aspect-[3/2] cursor-zoom-in overflow-hidden rounded border border-border bg-white transition-shadow hover:shadow-md ${
                  hideOnMobile ? "max-[768px]:hidden" : ""
                } ${hideOnDesktop ? "min-[769px]:hidden" : ""}`}
                aria-label={`${title} サンプル画像 ${index + 1} を拡大表示`}
              >
                <Image
                  src={image}
                  alt={`${title} サンプル画像 ${index + 1}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 50vw, 16vw"
                  unoptimized
                />
              </button>
            );
          })}
        </div>

        {showMobileToggle ? (
          <button
            type="button"
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-border bg-white px-3 text-[13px] font-medium text-accent hover:bg-accent-light min-[769px]:hidden"
            aria-expanded={mobileExpanded}
            onClick={() => setMobileExpanded((prev) => !prev)}
          >
            {mobileExpanded
              ? "画像を閉じる"
              : `他の画像を見る（残り${mobileHiddenCount}枚）`}
          </button>
        ) : null}

        {showDesktopToggle ? (
          <button
            type="button"
            className="mt-3 hidden min-h-11 w-full max-w-md items-center justify-center rounded-lg border border-border bg-white px-3 text-sm font-medium text-accent hover:bg-accent-light min-[769px]:inline-flex"
            aria-expanded={desktopExpanded}
            onClick={() => setDesktopExpanded((prev) => !prev)}
          >
            {desktopExpanded
              ? "画像を閉じる"
              : `他の画像を見る（残り${desktopHiddenCount}枚）`}
          </button>
        ) : null}
      </section>

      {activeImage && (
        <ImageLightboxModal
          src={activeImage}
          alt={`${title} サンプル画像`}
          onClose={() => setActiveImage(null)}
        />
      )}
    </>
  );
}
