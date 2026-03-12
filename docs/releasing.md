# Releasing xcli

Target destinations:
- npm: `xcli`
- Homebrew: tap formula in `steipete/homebrew-tap` (e.g., `xcli.rb`)

## Checklist (npm + GitHub)
1) Version bump
   - Update `package.json` `version` (semver, e.g., `0.5.0`).
   - Update `CHANGELOG.md` and tag the release section.

2) Clean build & tests
   - `pnpm install`
   - `pnpm test`
   - `pnpm run build`

3) Publish to npm (scoped)
   - Ensure you are logged in (`npm whoami`).
   - `npm publish --access public` (from repo root). Package name is `xcli`.
   - Verify:
     - `npm view xcli version`
     - `npx -y xcli@<version> --help`

4) Git tag & GitHub release
   - `git tag v<version> && git push origin v<version>`
   - Create GitHub release from the tag. Include changelog notes and attach optional binary (see below).

## Attach compiled binary
Build and upload platform-specific binaries for the installer and Homebrew:
- Build: `pnpm run build:binary` (uses Bun to produce `./xcli`).
- Rename for the installer: `cp xcli xcli-darwin-arm64`
- Upload both assets during the transition period (legacy + new naming):
  `gh release create v<version> xcli-darwin-arm64 xcli --repo gupsammy/xcli`
- After two releases with dual naming, stop uploading the legacy `xcli` asset.

## Homebrew tap update (steipete/homebrew-tap)
1) Package the binary
   - From repo root: `tar -czf xcli-macos-universal-v<version>.tar.gz xcli`
   - Compute SHA: `shasum -a 256 xcli-macos-universal-v<version>.tar.gz`

2) Update formula in tap repo
   - File: `homebrew-tap/xcli.rb` (create if absent). Model it after `poltergeist.rb`.
   - Fields to update:
     - `url "https://github.com/steipete/xcli/releases/download/v<version>/xcli-macos-universal-v<version>.tar.gz"`
     - `sha256 "<calculated_sha>"`
     - `version "<version>"`
   - Install block: `bin.install "xcli"`
   - `test do`: minimal `assert_match "<version>", shell_output("#{bin}/xcli --version")`

3) Push tap changes
   - `git add xcli.rb && git commit -m "xcli 0.1.0" && git push`

## Release order suggestion
1) Merge to `main` and tag.
2) Publish npm.
3) Build binary (`pnpm run build:binary`), rename (`cp xcli xcli-darwin-arm64`), upload both to GitHub release.
4) Update Homebrew tap with new URL/SHA.
5) Verify installer: `curl -fsSL https://raw.githubusercontent.com/gupsammy/xcli/main/install.sh | sudo sh`

## Notes
- npm name (`xcli`) requires `--access public` on first publish.
- Homebrew formula assumes macOS universal binary; adjust URL/name if you ship per-arch.
- Config defaults (JSON5) and Safari/Chrome/Firefox cookie selection are documented in `README.md` — keep that in sync for each release.
