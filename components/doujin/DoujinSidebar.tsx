import Link from "next/link";
import { DoujinSidebarNavLink } from "@/components/doujin/DoujinMainNav";
import { doujinLegalLinks, doujinSidebarSections } from "@/lib/doujin/site-config";

export function DoujinSidebar() {
  return (
    <aside
      aria-label="同人図鑑サイドナビゲーション"
      className="hidden w-56 shrink-0 lg:block"
    >
      <div className="sticky top-36 space-y-6">
        {doujinSidebarSections.map((section) => (
          <nav key={section.title} aria-labelledby={`doujin-sidebar-${section.title}`}>
            <h2
              id={`doujin-sidebar-${section.title}`}
              className="mb-2 border-b border-border pb-2 text-sm font-bold text-foreground"
            >
              {section.title}
            </h2>
            <ul className="space-y-1">
              {section.links.map((link) => (
                <li key={`${link.href}-${link.label}`}>
                  <DoujinSidebarNavLink href={link.href} label={link.label} />
                </li>
              ))}
            </ul>
          </nav>
        ))}

        <nav aria-labelledby="doujin-sidebar-legal">
          <h2
            id="doujin-sidebar-legal"
            className="mb-2 border-b border-border pb-2 text-sm font-bold text-foreground"
          >
            法的情報
          </h2>
          <ul className="space-y-1">
            {doujinLegalLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="block rounded px-2 py-1.5 text-sm text-muted transition-colors hover:bg-accent-light hover:text-accent"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="rounded border border-accent/20 bg-accent-light p-4">
          <p className="text-xs font-bold text-accent">セール情報</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            期間限定セール同人作品をチェック
          </p>
          <Link
            href="/doujin/sale"
            className="mt-3 inline-block text-xs font-medium text-accent hover:underline"
          >
            セール作品を見る →
          </Link>
        </div>
      </div>
    </aside>
  );
}
