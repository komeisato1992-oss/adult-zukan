#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

prepend_node_bin() {
  local bin_dir="$1"
  if [ -x "${bin_dir}/node" ] && [ -x "${bin_dir}/npm" ]; then
    case ":${PATH}:" in
      *":${bin_dir}:"*) ;;
      *) export PATH="${bin_dir}:${PATH}" ;;
    esac
    return 0
  fi
  return 1
}

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
  # 1) Project-local symlink (.node -> existing install)
  if prepend_node_bin "${ROOT_DIR}/.node/bin"; then
    return 0
  fi

  # 2) Known existing install used by sibling project
  if prepend_node_bin "${HOME}/ai-keiba-labo/.node/bin"; then
    if [ ! -e "${ROOT_DIR}/.node" ]; then
      ln -sfn "${HOME}/ai-keiba-labo/.node" "${ROOT_DIR}/.node"
    fi
    return 0
  fi

  # 3) Already on PATH
  if command -v npm >/dev/null 2>&1 && command -v node >/dev/null 2>&1; then
    return 0
  fi

  # 4) nvm / fnm / volta / Homebrew
  if load_nvm; then
    if [ -f "$ROOT_DIR/.nvmrc" ]; then
      nvm install
      nvm use
    else
      nvm install 22
      nvm use 22
    fi
    return 0
  fi

  if command -v fnm >/dev/null 2>&1; then
    eval "$(fnm env)"
    fnm install --lts
    fnm use lts-latest
    return 0
  fi

  if [ -x "${HOME}/.volta/bin/node" ]; then
    prepend_node_bin "${HOME}/.volta/bin"
    return 0
  fi

  for brew_node in /opt/homebrew/bin /usr/local/bin; do
    if prepend_node_bin "${brew_node}"; then
      return 0
    fi
  done

  cat <<'EOF'
Node.js / npm が見つかりません。

このマシンには既存の Node が次にあります（推奨）:
  ~/ai-keiba-labo/.node/bin

修復:
  bash scripts/fix-node-path.sh
  source ~/.zshrc

または:
  bash scripts/setup-dev.sh
EOF
  exit 1
}

ensure_node
echo "node $(node -v) / npm $(npm -v) @ $(command -v node)"
npm install

echo
echo "セットアップ完了。開発サーバーを起動するには:"
echo "  npm run dev"
echo
echo "シェルPATHが未設定の場合は一度だけ実行してください:"
echo "  bash scripts/fix-node-path.sh && source ~/.zshrc"
