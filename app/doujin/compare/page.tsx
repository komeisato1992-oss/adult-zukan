import type { Metadata } from "next";
import { Suspense } from "react";
import { DoujinComparePageClient } from "@/components/doujin/DoujinComparePageClient";
import { DoujinPageLayout } from "@/components/doujin/DoujinPageLayout";
import { DoujinSimplePage } from "@/components/doujin/DoujinSimplePage";
import { doujinPageIntros } from "@/lib/doujin/site-config";

export const metadata: Metadata = {
  title: "比較",
  description: doujinPageIntros.compare,
  robots: { index: false, follow: false, nocache: true },
};

export default function DoujinComparePage() {
  return (
    <DoujinPageLayout showSidebar={false}>
      <DoujinSimplePage title="同人作品比較" description={doujinPageIntros.compare}>
        <Suspense fallback={<p className="text-sm text-muted">読み込み中...</p>}>
          <DoujinComparePageClient />
        </Suspense>
      </DoujinSimplePage>
    </DoujinPageLayout>
  );
}
