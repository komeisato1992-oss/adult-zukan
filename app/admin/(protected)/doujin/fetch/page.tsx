import Link from "next/link";
import { DoujinFetchClient } from "@/components/admin/DoujinFetchClient";
import { DoujinImportClient } from "@/components/admin/DoujinImportClient";

export default function DoujinFetchPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">同人作品取得</h1>
          <p className="mt-1 text-sm text-muted">
            FANZA同人フロアから商品を取得し、同人図鑑用データへ保存します。
          </p>
        </div>
        <Link
          href="/admin/doujin"
          className="text-sm font-medium text-accent hover:underline"
        >
          ← 同人管理トップ
        </Link>
      </div>
      <DoujinImportClient />
      <DoujinFetchClient />
    </div>
  );
}
