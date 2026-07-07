import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { PageLayout } from "@/components/layout/PageLayout";

type LegalPageProps = {
  title: string;
  breadcrumbLabel: string;
  children: React.ReactNode;
};

export function LegalPageLayout({
  title,
  breadcrumbLabel,
  children,
}: LegalPageProps) {
  return (
    <PageLayout showSidebar={false}>
      <Breadcrumb
        items={[{ label: "トップ", href: "/" }, { label: breadcrumbLabel }]}
      />
      <article className="prose-legal mt-6 max-w-3xl">
        <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
          {title}
        </h1>
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted">
          {children}
        </div>
      </article>
    </PageLayout>
  );
}
