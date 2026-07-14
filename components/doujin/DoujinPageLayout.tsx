import { DoujinSidebar } from "@/components/doujin/DoujinSidebar";

type DoujinPageLayoutProps = {
  children: React.ReactNode;
  showSidebar?: boolean;
};

export function DoujinPageLayout({
  children,
  showSidebar = true,
}: DoujinPageLayoutProps) {
  return (
    <div className="mx-auto flex max-w-[90rem] gap-8 px-4 py-8 max-[768px]:gap-6 max-[768px]:px-2.5 max-[768px]:py-4 sm:px-6 lg:gap-10 lg:py-10">
      {showSidebar ? <DoujinSidebar /> : null}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
