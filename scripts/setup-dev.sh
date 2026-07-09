#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

load_nvm() {
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    # shellcheck disable=SC1090
    . "$NVM_DIR/nvm.sh"
    return 0
  fi
  return 1
}

ensure_node() {
  if command -v npm >/dev/null 2>&1 && command -v node >/dev/null 2>&1; then
    return 0
  fi

  if load_nvm; then
    if [ -f "$ROOT_DIR/.nvmrc" ]; then
      nvm install
      nvm use
    else
      nvm install 20
      nvm use 20
    fi
    return 0
  fi

  cat <<'EOF'
Node.js / npm が見つかりません。

このプロジェクトは npm を使います（package-lock.json あり）。

初回セットアップ:

  # nvm をインストール
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

  # ターミナルを開き直してから
  cd /path/to/adult-zukan
  nvm install
  npm install
  npm run dev

または Node.js LTS を https://nodejs.org/ からインストールしてください。
EOF
  exit 1
}

ensure_node
npm install

echo
echo "セットアップ完了。開発サーバーを起動するには:"
echo "  npm run dev"
