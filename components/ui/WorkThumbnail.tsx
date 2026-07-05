import { WorkImagePlaceholder } from "@/components/ui/WorkImagePlaceholder";

type WorkThumbnailProps = {
  title: string;
  variant?: "card" | "detail" | "hero";
  className?: string;
  showHoverOverlay?: boolean;
};

export function WorkThumbnail({
  title,
  variant = "card",
  className = "",
  showHoverOverlay = false,
}: WorkThumbnailProps) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <WorkImagePlaceholder title={title} variant={variant} />
      {showHoverOverlay && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      )}
    </div>
  );
}
