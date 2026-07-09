import { spawn } from "node:child_process";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 開発サーバーを1プロセス・固定ポートで起動する。
 * 複数インスタンスや .next 削除後の stale サーバーによる CSS 404 を防ぐ。
 */
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = process.env.PORT ?? "3000";
const NEXT_BIN = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");

if (!existsSync(NEXT_BIN)) {
  console.error(
    "node_modules が見つかりません。先に npm install を実行してください。",
  );
  process.exit(1);
}

for (const port of [PORT, "3001"]) {
  try {
    execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null`, {
      stdio: "ignore",
      shell: true,
    });
  } catch {
    // 既存プロセスなし
  }
}

const child = spawn(process.execPath, [NEXT_BIN, "dev", "-p", PORT], {
  stdio: "inherit",
  cwd: ROOT,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
