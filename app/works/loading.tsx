import { RouteLoadingSkeleton } from "@/components/ui/RouteLoadingSkeleton";

export default function Loading() {
  return <RouteLoadingSkeleton title="作品一覧を読み込み中…" cards={12} />;
}
