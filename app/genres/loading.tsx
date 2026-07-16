import { RouteLoadingSkeleton } from "@/components/ui/RouteLoadingSkeleton";

export default function Loading() {
  return <RouteLoadingSkeleton title="ジャンル一覧を読み込み中…" cards={12} />;
}
