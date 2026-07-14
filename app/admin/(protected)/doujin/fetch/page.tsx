import Link from "next/link";
import { DoujinFetchClient } from "@/components/admin/DoujinFetchClient";
import { DoujinImportClient } from "@/components/admin/DoujinImportClient";

export default function DoujinFetchPage() {
  return (
    <div className="space-y-4" data-site-type="doujin">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="border-l-4 border-[#F78FA7] pl-3 text-2xl font-bold text-foreground">
            同人作品追加
          </h1>
          <p className="mt-1 text-sm text-muted">
            FANZA同人フロアから取得・追加します（site_type=doujin）。一括追加はプレビュー確認後に実行してください。
          </p>
        </div>
        <Link
          href="/admin/doujin"
          className="text-sm font-medium text-[#e56b8a] hover:underline"
        >
          ← 同人管理トップ
        </Link>
      </div>
      <DoujinImportClient />
      <DoujinFetchClient />
    </div>
  );
}
