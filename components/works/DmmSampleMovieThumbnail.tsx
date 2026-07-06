import Image from "next/image";
import { AFFILIATE_LINK_REL } from "@/lib/utils";

type DmmSampleMovieThumbnailProps = {
  posterUrl: string;
  title: string;
  fanzaUrl: string;
};

export function DmmSampleMovieThumbnail({
  posterUrl,
  title,
  fanzaUrl,
}: DmmSampleMovieThumbnailProps) {
  if (!fanzaUrl) {
    return null;
  }

  return (
    <a
      href={fanzaUrl}
      target="_blank"
      rel={AFFILIATE_LINK_REL}
      className="relative mt-3 block w-full overflow-hidden rounded-lg border border-border"
      aria-label={`${title} のサンプル動画をFANZAで見る`}
    >
      <div className="relative aspect-video w-full">
        <Image
          src={posterUrl}
          alt={`${title} サンプル動画`}
          fill
          className="object-cover"
          sizes="280px"
          unoptimized
        />
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40 transition-colors hover:bg-black/50">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-md">
            <svg
              viewBox="0 0 24 24"
              className="ml-0.5 h-5 w-5 text-neutral-900"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
          <span className="rounded bg-black/60 px-3 py-1 text-xs font-bold text-white">
            FANZAでサンプルを見る
          </span>
        </span>
      </div>
    </a>
  );
}
