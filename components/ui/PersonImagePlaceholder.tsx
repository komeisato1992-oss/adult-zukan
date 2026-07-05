type PersonImagePlaceholderProps = {
  name: string;
  className?: string;
  shape?: "circle" | "square";
};

export function PersonImagePlaceholder({
  name,
  className = "",
  shape = "square",
}: PersonImagePlaceholderProps) {
  return (
    <div
      className={`relative flex h-full w-full flex-col items-center justify-center overflow-hidden px-2 py-3 text-center ${
        shape === "circle" ? "rounded-full" : ""
      } ${className}`}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#0d0000] via-[#3d0000] to-[#0a0a0a]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.65)_100%)]" />
      <div
        className="absolute inset-0 opacity-[0.12] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "128px 128px",
        }}
      />
      <div className="absolute inset-2 border border-white/10" />
      <div className="relative z-10 flex flex-col items-center">
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/90 sm:text-[10px]">
          ADULT ZUKAN
        </p>
        <div className="my-1.5 h-px w-10 bg-gradient-to-r from-transparent via-accent/80 to-transparent" />
        <p className="line-clamp-3 text-xs font-medium leading-snug text-white/80 sm:text-sm">
          {name}
        </p>
      </div>
    </div>
  );
}
