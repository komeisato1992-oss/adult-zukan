import { DoujinBottomNav } from "@/components/doujin/DoujinBottomNav";
import { DoujinCompareCandidateGuide } from "@/components/doujin/DoujinCompareCandidateGuide";
import { DoujinCompareFloatingButton } from "@/components/doujin/DoujinCompareFloatingButton";
import { DoujinFooter } from "@/components/doujin/DoujinFooter";
import { DoujinHeader } from "@/components/doujin/DoujinHeader";

type DoujinSiteShellProps = {
  children: React.ReactNode;
};

export function DoujinSiteShell({ children }: DoujinSiteShellProps) {
  return (
    <div data-site="doujin" className="flex min-h-screen flex-col">
      <DoujinHeader />
      {/* モバイル: 比較バー(〜56px) + 下部ナビ(56px) + safe-area。PCは余白なし維持 */}
      <main className="flex-1 max-[768px]:pb-[calc(144px+env(safe-area-inset-bottom,0px))] min-[769px]:pb-0">
        {children}
      </main>
      <DoujinCompareFloatingButton />
      <DoujinCompareCandidateGuide />
      <DoujinFooter />
      <DoujinBottomNav />
    </div>
  );
}
