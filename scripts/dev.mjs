#!/usr/bin/env node
/**
 * 開発サーバーを1プロセス・固定ポートで起動する。
 * 複数インスタンスや .next 削除後の stale サーバーによる CSS 404 を防ぐ。
 */
import { spawn } from "node:child_process";
import { execSync } from "node:child_process";

const PORT = process.env.PORT ?? "3000";

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

const child = spawn("npx", ["next", "dev", "-p", PORT], {
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
