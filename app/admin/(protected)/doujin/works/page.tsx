import { Suspense } from "react";
import Link from "next/link";
import { DoujinWorksAdminClient } from "@/components/admin/DoujinWorksAdminClient";
import {
  listDoujinWorksForAdmin,
  type DoujinWorksAdminSort,
} from "@/lib/admin/doujin-works-admin";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function pick(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function DoujinWorksAdminPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = pick(params.q);
  const sort = (pick(params.sort) || "new") as DoujinWorksAdminSort;
  const published = (pick(params.published) || "all") as
    | "all"
    | "published"
    | "unpublished";
  const sale = (pick(params.sale) || "all") as "all" | "sale" | "not-sale";
  const page = Number.parseInt(pick(params.page) || "1", 10) || 1;
  const pageSizeRaw = Number.parseInt(pick(params.pageSize) || "20", 10);
  const pageSize =
    pageSizeRaw === 50 || pageSizeRaw === 100 ? pageSizeRaw : 20;

  const result = listDoujinWorksForAdmin({
    q,
    sort,
    published,
    sale,
    page,
    pageSize,
    circleId: pick(params.circleId) || undefined,
    authorId: pick(params.authorId) || undefined,
    seriesId: pick(params.seriesId) || undefined,
    genreId: pick(params.genreId) || undefined,
  });

  return (
    <div className="space-y-4" data-site-type="doujin">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="border-l-4 border-[#F78FA7] pl-3 text-2xl font-bold">
            同人作品管理
          </h1>
          <p className="mt-2 text-sm text-muted">
            同人カタログの一覧・検索・絞り込み（site_type=doujin）
          </p>
        </div>
        <Link
          href="/admin/doujin"
          className="inline-flex h-10 items-center rounded-lg border border-border px-3 text-sm"
        >
          ダッシュボードへ
        </Link>
      </div>

      <Suspense fallback={<p className="text-sm text-muted">読み込み中…</p>}>
        <DoujinWorksAdminClient
          items={result.items}
          total={result.total}
          page={result.page}
          pageSize={result.pageSize}
          totalPages={result.totalPages}
          q={q}
          sort={sort}
          published={published}
          sale={sale}
          filters={result.filters}
        />
      </Suspense>
    </div>
  );
}
