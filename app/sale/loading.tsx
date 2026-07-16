import { RouteLoadingSkeleton } from "@/components/ui/RouteLoadingSkeleton";

export default function Loading() {
  return <RouteLoadingSkeleton title="セール作品を読み込み中…" cards={12} />;
}
