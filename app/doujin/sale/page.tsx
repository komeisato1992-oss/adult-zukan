import type { Metadata } from "next";
import { DoujinEmptyState } from "@/components/doujin/DoujinEmptyState";
import { DoujinPageLayout } from "@/components/doujin/DoujinPageLayout";
import { DoujinSimplePage } from "@/components/doujin/DoujinSimplePage";
import { DoujinWorksGrid } from "@/components/doujin/DoujinWorksGrid";
import {
  getDoujinSaleWorks,
  hasDoujinCatalogData,
} from "@/lib/doujin/catalog";
import { doujinPageIntros } from "@/lib/doujin/site-config";

export const metadata: Metadata = {
  title: "セール",
  description: doujinPageIntros.sale,
  robots: { index: false, follow: false, nocache: true },
};

export default function DoujinSalePage() {
  const hasData = hasDoujinCatalogData();
  const works = hasData ? getDoujinSaleWorks() : [];

  return (
    <DoujinPageLayout>
      <DoujinSimplePage title="セール" description={doujinPageIntros.sale}>
        {!hasData ? (
          <DoujinEmptyState />
        ) : works.length === 0 ? (
          <DoujinEmptyState
            title="セール中の作品はありません"
            description="セール情報がある作品が取得されると表示されます。"
          />
        ) : (
          <DoujinWorksGrid works={works} />
        )}
      </DoujinSimplePage>
    </DoujinPageLayout>
  );
}
