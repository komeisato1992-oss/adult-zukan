import { DoujinBottomNav } from "@/components/doujin/DoujinBottomNav";
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
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <DoujinCompareFloatingButton />
      <DoujinFooter />
      <DoujinBottomNav />
    </div>
  );
}
