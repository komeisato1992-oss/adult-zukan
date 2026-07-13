import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { doujinSidebarSections } from "@/lib/doujin/site-config";

export function DoujinContentLinksSection() {
  const links = doujinSidebarSections[0].links;

  return (
    <section aria-labelledby="doujin-content-links" className="mb-10">
      <SectionHeader title="コンテンツ一覧" id="doujin-content-links" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {links.map((link) => (
          <Link
            key={`${link.href}-${link.label}`}
            href={link.href}
            className="rounded-lg border border-border bg-white px-3 py-3 text-center text-sm text-foreground transition-colors hover:border-accent hover:text-accent"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
