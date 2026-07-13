import type { Metadata } from "next";
import { DoujinHistoryClient } from "@/components/doujin/DoujinHistoryClient";
import { DoujinPageLayout } from "@/components/doujin/DoujinPageLayout";
import { DoujinSimplePage } from "@/components/doujin/DoujinSimplePage";
import { doujinPageIntros } from "@/lib/doujin/site-config";

export const metadata: Metadata = {
  title: "閲覧履歴",
  description: doujinPageIntros.history,
  robots: { index: false, follow: false, nocache: true },
};

export default function DoujinHistoryPage() {
  return (
    <DoujinPageLayout>
      <DoujinSimplePage title="閲覧履歴" description={doujinPageIntros.history}>
        <DoujinHistoryClient />
      </DoujinSimplePage>
    </DoujinPageLayout>
  );
}
