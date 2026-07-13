import Link from "next/link";
import { DoujinApiDiagnosticClient } from "@/components/admin/DoujinApiDiagnosticClient";

export default function DoujinApiDiagnosticPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">同人 API 診断</h1>
          <p className="mt-1 text-sm text-muted">
            FloorList と商品1件取得で、同人フロアとレスポンス項目を確認します。
          </p>
        </div>
        <Link
          href="/admin/doujin"
          className="text-sm font-medium text-accent hover:underline"
        >
          ← 同人管理トップ
        </Link>
      </div>
      <DoujinApiDiagnosticClient />
    </div>
  );
}
