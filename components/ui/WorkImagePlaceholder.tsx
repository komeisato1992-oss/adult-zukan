type WorkImagePlaceholderProps = {
  title: string;
  className?: string;
  variant?: "card" | "detail" | "hero";
};

export function WorkImagePlaceholder({
  title,
  className = "",
  variant = "card",
}: WorkImagePlaceholderProps) {
  const brandSize =
    variant === "hero"
      ? "text-sm tracking-[0.35em] sm:text-base"
      : variant === "detail"
        ? "text-xs tracking-[0.3em] sm:text-sm"
        : "text-[10px] tracking-[0.25em] sm:text-xs";

  const titleSize =
    variant === "hero"
      ? "text-lg sm:text-2xl"
      : variant === "detail"
        ? "text-base sm:text-lg"
        : "text-xs sm:text-sm";

  return (
    <div
      className={`relative flex h-full w-full flex-col items-center justify-center overflow-hidden px-3 py-4 text-center ${className}`}
      aria-hidden="true"
    >
      {/* 赤黒グラデーション */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0d0000] via-[#3d0000] to-[#0a0a0a]" />

      {/* フィルム風ビネット */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.65)_100%)]" />

      {/* 薄いノイズ */}
      <div
        className="absolute inset-0 opacity-[0.12] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "128px 128px",
        }}
      />

      {/* フィルム穴（上下） */}
      <div className="absolute left-0 right-0 top-0 flex justify-around px-1 py-1 opacity-30">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={`t-${i}`} className="h-1.5 w-2 rounded-sm bg-white/40" />
        ))}
      </div>
      <div className="absolute bottom-0 left-0 right-0 flex justify-around px-1 py-1 opacity-30">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={`b-${i}`} className="h-1.5 w-2 rounded-sm bg-white/40" />
        ))}
      </div>

      {/* フィルム枠 */}
      <div className="absolute inset-2 border border-white/10" />
      <div className="absolute inset-3 border border-accent/20" />

      {/* コンテンツ */}
      <div className="relative z-10 flex flex-col items-center">
        <p className={`font-bold uppercase text-white/95 ${brandSize}`}>
          ADULT ZUKAN
        </p>
        <div className="my-2 h-px w-14 bg-gradient-to-r from-transparent via-accent to-transparent" />
        <p
          className={`max-w-[90%] line-clamp-4 font-medium leading-snug text-white/85 ${titleSize}`}
        >
          {title}
        </p>
      </div>
    </div>
  );
}
