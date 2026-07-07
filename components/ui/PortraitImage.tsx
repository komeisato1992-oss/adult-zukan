import Image from "next/image";

const PORTRAIT_STYLE = {
  objectFit: "cover" as const,
  objectPosition: "right center" as const,
  maxWidth: "100%",
};

type PortraitImageProps = {
  src: string;
  alt: string;
  sizes?: string;
  priority?: boolean;
  loading?: "lazy" | "eager";
  className?: string;
  children?: React.ReactNode;
};

export function PortraitImage({
  src,
  alt,
  sizes = "200px",
  priority = false,
  loading = "lazy",
  className = "",
  children,
}: PortraitImageProps) {
  return (
    <div
      className={`portrait-image-frame relative aspect-[3/4] w-full max-w-full overflow-hidden bg-surface ${className}`}
    >
      <Image
        src={src}
        alt={alt}
        fill
        className="portrait-image object-cover object-[right_center]"
        style={PORTRAIT_STYLE}
        sizes={sizes}
        loading={priority ? undefined : loading}
        priority={priority}
        unoptimized
      />
      {children}
    </div>
  );
}
