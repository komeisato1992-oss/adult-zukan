import Image from "next/image";
import {
  imageCoverClassName,
  imageCoverStyle,
} from "@/components/ui/image-cover";

const VARIANTS = {
  landscape: {
    frameClass: "work-image-frame work-image-frame--landscape aspect-[3/2]",
    defaultSizes: "(max-width: 389px) 50vw, (max-width: 768px) 33vw, 25vw",
  },
  portrait: {
    frameClass: "work-image-frame work-image-frame--portrait aspect-[2/3]",
    defaultSizes: "(max-width: 389px) 50vw, (max-width: 768px) 33vw, 25vw",
  },
} as const;

type CatalogWorkImageProps = {
  src: string;
  alt: string;
  variant?: keyof typeof VARIANTS;
  priority?: boolean;
  loading?: "lazy" | "eager";
  sizes?: string;
  frameClassName?: string;
};

export function CatalogWorkImage({
  src,
  alt,
  variant = "landscape",
  priority = false,
  loading = "lazy",
  sizes,
  frameClassName = "",
}: CatalogWorkImageProps) {
  const config = VARIANTS[variant];

  return (
    <div
      className={`relative w-full max-w-full overflow-hidden bg-surface ${config.frameClass} ${frameClassName}`}
    >
      <Image
        src={src}
        alt={alt}
        fill
        className={`catalog-work-image ${imageCoverClassName}`}
        style={imageCoverStyle}
        sizes={sizes ?? config.defaultSizes}
        loading={priority ? undefined : loading}
        priority={priority}
        unoptimized
      />
    </div>
  );
}
