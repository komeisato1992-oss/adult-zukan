import Image from "next/image";
import { doujinSiteConfig } from "@/lib/doujin/site-config";

type DoujinLogoProps = {
  /** header: コンパクト / footer: やや小さめ / hero: TOP向け大 */
  variant?: "header" | "footer" | "hero";
  className?: string;
  priority?: boolean;
};

const VARIANT_CLASS: Record<NonNullable<DoujinLogoProps["variant"]>, string> = {
  header: "h-9 w-auto max-w-[200px] sm:h-11 sm:max-w-[260px]",
  footer: "h-12 w-auto max-w-[240px] sm:h-14 sm:max-w-[280px]",
  hero: "mx-auto h-auto w-full max-w-[28rem] sm:max-w-[34rem]",
};

const VARIANT_SIZE: Record<
  NonNullable<DoujinLogoProps["variant"]>,
  { width: number; height: number }
> = {
  header: { width: 320, height: 213 },
  footer: { width: 360, height: 240 },
  hero: { width: 640, height: 426 },
};

export function DoujinLogo({
  variant = "header",
  className = "",
  priority = false,
}: DoujinLogoProps) {
  const size = VARIANT_SIZE[variant];
  return (
    <Image
      src={doujinSiteConfig.logo}
      alt={doujinSiteConfig.name}
      width={size.width}
      height={size.height}
      className={`${VARIANT_CLASS[variant]} ${className}`.trim()}
      priority={priority}
    />
  );
}
