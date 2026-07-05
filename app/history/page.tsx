import { createPageMetadata } from "@/lib/seo/metadata";
import { HistoryClient } from "./HistoryClient";

export const metadata = createPageMetadata({
  title: "閲覧履歴",
  description: "最近閲覧した作品の履歴一覧。",
  path: "/history",
  noIndex: true,
});

export default function HistoryPage() {
  return <HistoryClient />;
}
