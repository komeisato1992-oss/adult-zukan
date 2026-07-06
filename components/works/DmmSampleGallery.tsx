"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageLightboxModal } from "@/components/works/ImageLightboxModal";

type DmmSampleGalleryProps = {
  images: string[];
  title: string;
};

export function DmmSampleGallery({ images, title }: DmmSampleGalleryProps) {
  const [activeImage, setActiveImage] = useState<string | null>(null);

  if (images.length === 0) {
    return null;
  }

  return (
    <>
      <section aria-labelledby="sample-images-title" className="mt-10">
        <h2
          id="sample-images-title"
          className="mb-4 border-l-4 border-accent pl-3 text-lg font-bold text-foreground"
        >
          サンプル画像
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          {images.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              onClick={() => setActiveImage(image)}
              className="relative aspect-[3/2] cursor-zoom-in overflow-hidden rounded border border-border bg-white transition-shadow hover:shadow-md"
              aria-label={`${title} サンプル画像 ${index + 1} を拡大表示`}
            >
              <Image
                src={image}
                alt={`${title} サンプル画像 ${index + 1}`}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 50vw, 16vw"
                unoptimized
              />
            </button>
          ))}
        </div>
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
