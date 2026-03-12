# xcli Single-Line Installer Spec

## Overview

A curl-pipe-sh installer that downloads the correct xcli binary from GitHub Releases and installs it to `/usr/local/bin`, replacing the current manual download-chmod-copy workflow. The script lives in the repo at `install.sh`, served via `raw.githubusercontent.com`. A companion PowerShell script (`install.ps1`) handles Windows.

## Install Commands

**macOS / Linux:**
```bash
curl -fsSL https://raw.githubusercontent.com/gupsammy/xcli/main/install.sh | sudo sh
```

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/gupsammy/xcli/main/install.ps1 | iex
```

**Pinning a version:**
```bash
curl -fsSL https://raw.githubusercontent.com/gupsammy/xcli/main/install.sh | sudo VERSION=0.9.2 sh
```

## Key Decisions

- Install path: `/usr/local/bin/xcli` (requires sudo on Unix)
- Binary name: `xcli`
- Asset naming convention: `xcli-{os}-{arch}` (e.g., `xcli-darwin-arm64`, `xcli-linux-x86_64`, `xcli-windows-x86_64.exe`)
- Version: latest release by default, pinnable via `VERSION` env var
- Script hosted in repo root as `install.sh` and `install.ps1`, versioned with code
- Repo: `gupsammy/xcli` is the canonical source

## Platform Support

| Platform | Architecture | Asset Name | Status |
|----------|-------------|------------|--------|
| macOS | arm64 (Apple Silicon) | `xcli-darwin-arm64` | Available (needs rename from `xcli`) |
| macOS | x86_64 (Intel) | `xcli-darwin-x86_64` | Future |
| Linux | x86_64 | `xcli-linux-x86_64` | Future |
| Linux | arm64 | `xcli-linux-arm64` | Future |
| Windows | x86_64 | `xcli-windows-x86_64.exe` | Future |

Currently only macOS arm64 is built. The installer script includes multi-platform detection logic now, but will error gracefully for unsupported platforms until binaries are added.

## install.sh Behavior

1. Detect OS via `uname -s` (Darwin, Linux)
2. Detect architecture via `uname -m` (x86_64, arm64/aarch64)
3. Map to asset name: `xcli-{os}-{arch}`
4. Determine version: use `VERSION` env var if set, otherwise query GitHub API for latest release tag
5. Construct download URL: `https://github.com/gupsammy/xcli/releases/download/{version}/{asset}`
6. Download binary to a temp file
7. `chmod +x` the binary
8. Move to `/usr/local/bin/xcli` (requires sudo, which the user provides in the pipe)
9. Verify installation by running `xcli --version`
10. Print success message with getting-started hints

## install.ps1 Behavior

1. Detect architecture (x86_64 assumed for now)
2. Determine version (same logic as Unix)
3. Download `xcli-windows-x86_64.exe` to a temp location
4. Move to a directory in PATH (e.g., `$env:LOCALAPPDATA\xcli\`)
5. Add to PATH if not already present
6. Print success + getting started

## Post-Install Output

```
  xcli v0.9.2 installed to /usr/local/bin/xcli

  Get started:
    xcli --help          Show all commands
    xcli auth            Set up authentication
    xcli timeline        View your timeline

  Docs: https://github.com/gupsammy/xcli
```

## Error Handling

- Unsupported OS/arch: clear error message listing supported platforms
- Network failure: curl `-f` flag surfaces HTTP errors; script checks exit codes
- Missing release asset: error with link to releases page
- No sudo: error explaining sudo is required for /usr/local/bin install
- Existing install: overwrite silently (standard behavior for CLI installers)

## Open Questions

- When to set up CI cross-compilation for Linux/Windows binaries (not in scope now)
- Whether to rename the current release asset from `xcli` to `xcli-darwin-arm64` immediately or in the next release
- Whether to add a checksum verification step (SHA256 sums published alongside release assets)
- Whether to add an uninstall command or script

## Constraints

- This is NOT a package manager (no update command, no dependency tracking)
- This is NOT a version manager (no switching between versions)
- No Homebrew tap or apt/rpm packages — just the direct binary install
- The script must work with bash and sh (no bashisms) for maximum compatibility
