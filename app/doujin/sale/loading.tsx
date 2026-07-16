import { RouteLoadingSkeleton } from "@/components/ui/RouteLoadingSkeleton";

export default function Loading() {
  return <RouteLoadingSkeleton title="同人セールを読み込み中…" cards={12} />;
}
