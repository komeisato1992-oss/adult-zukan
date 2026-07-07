import { ComparePageClient } from "@/components/compare/ComparePageClient";
import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata = createPageMetadata({
  title: "作品比較",
  description: "気になる作品を最大3件まで並べて比較できます。",
  path: "/compare",
  absoluteTitle: true,
});

export default function ComparePage() {
  return (
    <PageLayout>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/" },
          { label: "作品比較" },
        ]}
      />
      <header className="mt-4 mb-4">
        <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
          作品比較
        </h1>
      </header>
      <ComparePageClient />
    </PageLayout>
  );
}
