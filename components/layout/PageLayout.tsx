import { Sidebar } from "@/components/layout/Sidebar";

type PageLayoutProps = {
  children: React.ReactNode;
  showSidebar?: boolean;
};

export function PageLayout({ children, showSidebar = true }: PageLayoutProps) {
  return (
    <div className="mx-auto flex max-w-7xl gap-10 px-4 py-8 max-[768px]:gap-6 max-[768px]:px-2.5 max-[768px]:py-4 sm:px-6 lg:py-10">
      {showSidebar && <Sidebar />}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
