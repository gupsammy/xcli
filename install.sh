#!/bin/sh
# xcli installer — https://github.com/gupsammy/xcli
# Usage: curl -fsSL https://raw.githubusercontent.com/gupsammy/xcli/main/install.sh | sudo sh
#        curl -fsSL ... | sudo VERSION=0.9.2 sh
set -eu

REPO="gupsammy/xcli"
INSTALL_DIR="/usr/local/bin"
BINARY_NAME="xcli"

# ── Colors ──────────────────────────────────────────────────────────
if [ -t 1 ] || [ "${FORCE_COLOR:-}" = "1" ]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  BOLD='\033[1m'
  RESET='\033[0m'
else
  RED='' GREEN='' BOLD='' RESET=''
fi

info()  { printf "%b\n" "$*"; }
error() { printf "%b\n" "${RED}Error: $*${RESET}" >&2; exit 1; }

# ── Cleanup ─────────────────────────────────────────────────────────
TMPFILE=""
cleanup() { [ -n "$TMPFILE" ] && rm -f "$TMPFILE"; }
trap cleanup EXIT

# ── OS detection ────────────────────────────────────────────────────
detect_os() {
  case "$(uname -s)" in
    Darwin) echo "darwin" ;;
    Linux)  echo "linux" ;;
    MINGW*|MSYS*|CYGWIN*)
      error "Windows detected. Use the PowerShell installer instead:\n  irm https://raw.githubusercontent.com/gupsammy/xcli/main/install.ps1 | iex" ;;
    *) error "Unsupported OS: $(uname -s). Supported: macOS, Linux" ;;
  esac
}

# ── Architecture detection ──────────────────────────────────────────
detect_arch() {
  case "$(uname -m)" in
    x86_64|amd64)   echo "x86_64" ;;
    arm64|aarch64)   echo "arm64" ;;
    *) error "Unsupported architecture: $(uname -m). Supported: x86_64, arm64" ;;
  esac
}

# ── Version resolution ──────────────────────────────────────────────
resolve_version() {
  if [ -n "${VERSION:-}" ]; then
    # Prepend v if missing
    case "$VERSION" in
      v*) echo "$VERSION" ;;
      *)  echo "v${VERSION}" ;;
    esac
    return
  fi

  info "Fetching latest release..." >&2
  API_URL="https://api.github.com/repos/${REPO}/releases/latest"

  if command -v curl >/dev/null 2>&1; then
    RESPONSE=$(curl -fsSL "$API_URL" 2>&1) || true
  elif command -v wget >/dev/null 2>&1; then
    RESPONSE=$(wget -qO- "$API_URL" 2>&1) || true
  else
    error "Neither curl nor wget found. Install one and retry."
  fi

  # Check for rate limiting
  case "$RESPONSE" in
    *"rate limit"*|*"API rate"*)
      error "GitHub API rate limit exceeded.\n  Set VERSION explicitly:\n  VERSION=x.y.z curl -fsSL ... | sudo sh" ;;
  esac

  # Parse tag_name from JSON without jq
  TAG=$(printf '%s' "$RESPONSE" | grep -o '"tag_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')

  if [ -z "$TAG" ]; then
    error "Could not determine latest version from GitHub API.\n  Set VERSION explicitly:\n  VERSION=x.y.z curl -fsSL ... | sudo sh"
  fi

  echo "$TAG"
}

# ── Download helper ─────────────────────────────────────────────────
download() {
  URL="$1"
  DEST="$2"

  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$URL" -o "$DEST"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "$DEST" "$URL"
  else
    error "Neither curl nor wget found. Install one and retry."
  fi
}

# ── Main ────────────────────────────────────────────────────────────
OS=$(detect_os)
ARCH=$(detect_arch)
VERSION_TAG=$(resolve_version)
ASSET="${BINARY_NAME}-${OS}-${ARCH}"
DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${VERSION_TAG}/${ASSET}"

info "Downloading ${BOLD}${BINARY_NAME} ${VERSION_TAG}${RESET} for ${OS}/${ARCH}..."

TMPFILE=$(mktemp)

# Try the new asset naming first
if ! download "$DOWNLOAD_URL" "$TMPFILE" 2>/dev/null; then
  # Fallback: legacy asset name (pre-rename releases ship just "xcli")
  if [ "$OS" = "darwin" ] && [ "$ARCH" = "arm64" ]; then
    info "Asset ${ASSET} not found, trying legacy name..."
    LEGACY_URL="https://github.com/${REPO}/releases/download/${VERSION_TAG}/${BINARY_NAME}"
    if ! download "$LEGACY_URL" "$TMPFILE" 2>/dev/null; then
      error "Could not download xcli ${VERSION_TAG}.\n  Check available assets at: https://github.com/${REPO}/releases/tag/${VERSION_TAG}"
    fi
  else
    error "No binary available for ${OS}/${ARCH} in release ${VERSION_TAG}.\n  Check available assets at: https://github.com/${REPO}/releases/tag/${VERSION_TAG}"
  fi
fi

# Install
chmod +x "$TMPFILE"

if [ -w "$INSTALL_DIR" ]; then
  mv "$TMPFILE" "${INSTALL_DIR}/${BINARY_NAME}"
else
  # Try with implicit sudo (works when piped as `| sudo sh`)
  mv "$TMPFILE" "${INSTALL_DIR}/${BINARY_NAME}" 2>/dev/null || \
    error "Permission denied writing to ${INSTALL_DIR}.\n  Run with sudo:\n  curl -fsSL https://raw.githubusercontent.com/${REPO}/main/install.sh | sudo sh"
fi
# Clear TMPFILE so cleanup trap doesn't try to remove the installed binary
TMPFILE=""

# Verify
${INSTALL_DIR}/${BINARY_NAME} --version >/dev/null 2>&1 || info "  Warning: could not verify installation"

info ""
info "  ${GREEN}${BOLD}${BINARY_NAME} ${VERSION_TAG}${RESET} installed to ${INSTALL_DIR}/${BINARY_NAME}"
info ""
info "  Get started:"
info "    ${BINARY_NAME} --help          Show all commands"
info "    ${BINARY_NAME} auth            Set up authentication"
info "    ${BINARY_NAME} timeline        View your timeline"
info ""
info "  Docs: https://github.com/${REPO}"
info ""

exit 0
