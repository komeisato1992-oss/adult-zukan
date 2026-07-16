#!/usr/bin/env bash
# Fix shell PATH for the existing Node.js at ~/ai-keiba-labo/.node
# Safe: only prepends PATH when the binary exists; does not overwrite other config.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SNIPPET_SRC="${SCRIPT_DIR}/shell/node-path.zsh"

NODE_DIR="${HOME}/ai-keiba-labo/.node/bin"
PROJECT_NODE="${PROJECT_ROOT}/.node/bin"

if [ ! -x "${NODE_DIR}/node" ] && [ -x "${PROJECT_NODE}/node" ]; then
  NODE_DIR="${PROJECT_NODE}"
fi

# Keep a project-local symlink when using the sibling install.
# CI / Vercel では絶対パス symlink を作らない（デプロイ時に ENOENT:/vercel/path0/.node になる）
if [ -z "${VERCEL:-}" ] && [ -z "${CI:-}" ]; then
  if [ ! -e "${PROJECT_ROOT}/.node" ] && [ -x "${HOME}/ai-keiba-labo/.node/bin/node" ]; then
    ln -sfn "${HOME}/ai-keiba-labo/.node" "${PROJECT_ROOT}/.node" 2>/dev/null || true
    if [ -x "${PROJECT_NODE}/node" ]; then
      NODE_DIR="${PROJECT_NODE}"
    fi
  fi
fi

if [ ! -x "${NODE_DIR}/node" ]; then
  echo "Node.js が見つかりませんでした: ${HOME}/ai-keiba-labo/.node/bin/node"
  echo "先に Node.js LTS を用意するか、シンボリックリンク .node を確認してください。"
  exit 1
fi

if [ ! -f "${SNIPPET_SRC}" ]; then
  echo "snippet missing: ${SNIPPET_SRC}"
  exit 1
fi

# Copy snippet into a target file (create or append). Never uses $(...heredoc with *)).
install_snippet() {
  local file="$1"
  local marker="ai-keiba-labo/.node/bin"

  if [ ! -f "${file}" ]; then
    if ! cp "${SNIPPET_SRC}" "${file}" 2>/dev/null; then
      echo "ファイルを作成できません: ${file}"
      return 1
    fi
    echo "created ${file}"
    return 0
  fi

  if grep -Fq "${marker}" "${file}"; then
    echo "already configured: ${file}"
    return 0
  fi

  {
    printf '\n'
    cat "${SNIPPET_SRC}"
  } >>"${file}" || {
    echo "ファイルへ追記できません: ${file}"
    return 1
  }
  echo "appended ${file}"
  return 0
}

ok_zprofile=0
ok_zshrc=0
install_snippet "${HOME}/.zprofile" && ok_zprofile=1 || true
install_snippet "${HOME}/.zshrc" && ok_zshrc=1 || true

if [ "${ok_zshrc}" -ne 1 ]; then
  echo
  echo "ERROR: ~/.zshrc を作成できませんでした。"
  echo "次を Terminal.app で実行してください（Cursor のサンドボックス外）:"
  echo "  cp \"${SNIPPET_SRC}\" ~/.zshrc"
  echo "  cp \"${SNIPPET_SRC}\" ~/.zprofile"
  echo "  source ~/.zshrc"
  # Still export PATH for this shell session
  export PATH="${NODE_DIR}:${PATH}"
  hash -r 2>/dev/null || true
  if command -v node >/dev/null 2>&1; then
    echo
    echo "(このセッションのみ) node $(node -v) / npm $(npm -v)"
  fi
  exit 1
fi

# Ensure zprofile also exists when only zshrc succeeded
if [ "${ok_zprofile}" -ne 1 ] && [ -f "${HOME}/.zshrc" ]; then
  cp "${HOME}/.zshrc" "${HOME}/.zprofile" 2>/dev/null || true
fi

export PATH="${NODE_DIR}:${PATH}"
hash -r 2>/dev/null || true

echo
echo "node: $(command -v node) ($(node -v))"
echo "npm:  $(command -v npm) ($(npm -v))"
echo
echo "次を実行してください:"
echo "  source ~/.zshrc"
echo "  node -v && npm -v"
