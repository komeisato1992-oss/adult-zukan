import Image from "next/image";

const VARIANTS = {
  landscape: {
    frameClass: "work-image-frame work-image-frame--landscape aspect-[3/2]",
    defaultSizes: "(max-width: 640px) 50vw, 25vw",
  },
  portrait: {
    frameClass: "work-image-frame work-image-frame--portrait aspect-[2/3]",
    defaultSizes: "(max-width: 640px) 50vw, 25vw",
  },
} as const;

const COVER_STYLE = {
  objectFit: "cover" as const,
  objectPosition: "right center" as const,
  maxWidth: "100%",
};

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
        className="catalog-work-image object-cover object-[right_center]"
        style={COVER_STYLE}
        sizes={sizes ?? config.defaultSizes}
        loading={priority ? undefined : loading}
        priority={priority}
        unoptimized
      />
    </div>
  );
}
