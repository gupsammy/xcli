# xcli — fast X/Twitter CLI

`xcli` is a fast command-line interface for X/Twitter, forked and extended from [bird](https://github.com/steipete/bird) by [@steipete](https://github.com/steipete) (now private). It lets you post, read, bookmark, follow, search, and more — straight from your terminal using cookie auth extracted from your browser. No API key required.

> **Note:** xcli uses X's internal, undocumented GraphQL API. It may break without notice. Use responsibly.

## Install

### Prebuilt binary (macOS)

```bash
curl -fsSL https://github.com/gupsammy/xcli/releases/latest/download/xcli -o xcli
chmod +x xcli
sudo mv xcli /usr/local/bin/xcli
```

Verify the installation:

```bash
xcli --version
```

### Build from source

Requires [Bun](https://bun.sh) and [pnpm](https://pnpm.io).

```bash
git clone https://github.com/gupsammy/xcli
cd xcli
pnpm install
pnpm run build:binary
```

The compiled binary will be at `./xcli`. Move it to a directory on your `$PATH`.

## Quickstart

```bash
# Show the logged-in account (verifies auth is working)
xcli whoami

# Post a tweet
xcli tweet "hello from xcli"

# Read a tweet by URL or ID
xcli read https://x.com/user/status/1234567890123456789
xcli 1234567890123456789 --json

# Fetch your home timeline
xcli home -n 20
```

## Commands

| Command | Description |
|---------|-------------|
| `xcli tweet "<text>"` | Post a new tweet |
| `xcli reply <tweet-id-or-url> "<text>"` | Reply to a tweet |
| `xcli read <tweet-id-or-url>` | Fetch tweet content as text |
| `xcli <tweet-id-or-url>` | Shorthand for `xcli read` |
| `xcli replies <tweet-id-or-url>` | List replies to a tweet |
| `xcli thread <tweet-id-or-url>` | Show the full conversation thread |
| `xcli home` | Fetch your home timeline (For You or Following) |
| `xcli search "<query>"` | Search for tweets matching a query |
| `xcli mentions` | Find tweets mentioning you (or another user via `--user`) |
| `xcli user-tweets <@handle>` | Get tweets from a user's profile timeline |
| `xcli bookmarks` | List your bookmarked tweets |
| `xcli unbookmark <tweet-id-or-url...>` | Remove one or more bookmarks |
| `xcli likes` | List your liked tweets |
| `xcli news` | Fetch news and trending topics from X's Explore tabs |
| `xcli trending` | Alias for `news` |
| `xcli lists` | List your Twitter Lists (owned or memberships) |
| `xcli list-timeline <list-id-or-url>` | Get tweets from a list timeline |
| `xcli following` | List users you follow |
| `xcli followers` | List users who follow you |
| `xcli follow <username-or-id>` | Follow a user |
| `xcli unfollow <username-or-id>` | Unfollow a user |
| `xcli about <@handle>` | Get account origin and location metadata for a user |
| `xcli whoami` | Print which X account your cookies belong to |
| `xcli check` | Show which credentials are available and where they came from |
| `xcli query-ids` | Inspect or refresh the cached GraphQL query IDs |
| `xcli help [command]` | Show help (or help for a specific subcommand) |

### Pagination flags

Most list commands support `--all`, `--max-pages <n>`, `--cursor <string>`, and `--delay <ms>` for paginating through results. `--max-pages` requires `--all` or `--cursor`.

### Search flags

Query operator shortcuts for `xcli search "<query>"`:

- `--from <username>` — restrict to tweets from this user (shorthand for `from:username`; leading `@` is stripped)
- `--since <period>` — time window: `1h`, `3h`, `12h`, `1d`, `7d` (injects a precise `since_time:` Unix timestamp)
- `--min-likes <n>` — minimum likes (`min_faves:N` operator)
- `--min-retweets <n>` — minimum retweets
- `--min-replies <n>` — minimum replies
- `--no-replies` — exclude replies (`-filter:replies` operator)
- `--quality` — shorthand for `min_faves:10`; ignored if `--min-likes` is set

Result control:

- `--sort <order>` — `recent` (default, chronological), `top` (Twitter's ranking), `likes`, `retweets` (client-side sort)
- `--pages <n>` — fetch N pages (20 tweets/page); shorthand for `--all --max-pages N`
- `--limit <n>` — cap results displayed after fetch and sort
- `--markdown` — print results as a research document to stdout
- `--save` — write results to `~/clawd/drafts/` as a markdown file (independent of `--markdown`)

Example:

```bash
xcli search "AI" --from sama --since 7d --min-likes 100 --sort top --limit 10
xcli search "open source" --no-replies --quality --pages 3 --save
```

### Bookmarks flags

The `bookmarks` command has additional flags for controlling thread context in the output:

- `--expand-root-only` — expand threads only when the bookmark is a root tweet
- `--author-chain` — keep only the bookmarked author's connected self-reply chain
- `--author-only` — include all tweets from the bookmarked author within the thread
- `--full-chain-only` — keep the entire reply chain connected to the bookmarked tweet
- `--include-ancestor-branches` — include sibling branches for ancestors (with `--full-chain-only`)
- `--include-parent` — include the direct parent tweet for non-root bookmarks
- `--thread-meta` — add thread metadata fields to each tweet
- `--sort-chronological` — sort output oldest to newest (default preserves bookmark order)

### News flags

Tab filters for `xcli news` (combinable):

- `--for-you` — For You tab
- `--news-only` — News tab
- `--sports` — Sports tab
- `--entertainment` — Entertainment tab
- `--trending-only` — Trending tab
- `--ai-only` — Filter to AI-curated headlines only
- `--with-tweets` — Include related tweets per news item

### Global options

| Flag | Description |
|------|-------------|
| `--auth-token <token>` | Set the `auth_token` cookie manually |
| `--ct0 <token>` | Set the `ct0` cookie manually |
| `--cookie-source <browser>` | Browser to extract cookies from: `safari`, `chrome`, `firefox` (repeatable) |
| `--chrome-profile <name>` | Chrome profile name (e.g. `Default`, `Profile 2`) |
| `--chrome-profile-dir <path>` | Chrome/Chromium profile directory or cookie DB path (for Arc, Brave, etc.) |
| `--firefox-profile <name>` | Firefox profile name for cookie extraction |
| `--cookie-timeout <ms>` | Timeout for cookie extraction via keychain/OS helpers |
| `--timeout <ms>` | Abort HTTP requests after this many milliseconds |
| `--quote-depth <n>` | Max quoted tweet depth in JSON output (default: 1; 0 disables) |
| `--plain` | Stable output: no emoji, no color |
| `--no-emoji` | Disable emoji output |
| `--no-color` | Disable ANSI colors |
| `--human` | Force human-readable output even when stdout is piped |
| `--media <path>` | Attach a media file (repeatable, up to 4 images or 1 video) |
| `--alt <text>` | Alt text for the corresponding `--media` (repeatable) |
| `--json` | Output machine-readable JSON |

## Configuration

Config is read in this priority order: CLI flags > env vars > project config > global config.

- Global: `~/.config/xcli/config.json5`
- Project: `.xclirc.json5` (in current working directory)

Example `~/.config/xcli/config.json5`:

```json5
{
  // Cookie source order for browser extraction (string or array)
  cookieSource: ["firefox", "safari"],

  // For Chromium variants (Arc, Brave, etc.)
  chromeProfileDir: "/path/to/Chromium/Profile",

  // Firefox profile name
  firefoxProfile: "default-release",

  // Timeouts in milliseconds
  cookieTimeoutMs: 30000,
  timeoutMs: 20000,

  // Depth limit for quoted tweet expansion in JSON output
  quoteDepth: 1,

  // Secondary account for read-only commands (search, bookmarks, etc.)
  // Useful to avoid rate-limiting your write account
  secondaryCookieSource: "chrome",
  secondaryChromeProfile: "Profile 2"
}
```

### Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `XCLI_TIMEOUT_MS` | HTTP request timeout in milliseconds | `30000` |
| `XCLI_COOKIE_TIMEOUT_MS` | Cookie extraction timeout in milliseconds | `30000` |
| `XCLI_QUOTE_DEPTH` | Max quoted tweet depth in JSON output | `1` |
| `NO_COLOR` | Set to `1` to disable ANSI colors | — |

## Authentication

`xcli` uses your existing X/Twitter web session — no API key or password prompt required. It reads the `auth_token` and `ct0` cookies directly from your browser.

Credentials are resolved in this order:

1. CLI flags: `--auth-token` and `--ct0`
2. Environment variables: `AUTH_TOKEN` and `CT0` (fallbacks: `TWITTER_AUTH_TOKEN`, `TWITTER_CT0`)
3. Browser cookies, extracted automatically from the sources configured via `--cookie-source` or `cookieSource` in config

Browser cookie locations:

- Safari: `~/Library/Cookies/Cookies.binarycookies`
- Chrome: `~/Library/Application Support/Google/Chrome/<Profile>/Cookies`
- Firefox: `~/Library/Application Support/Firefox/Profiles/<profile>/cookies.sqlite`

For Chromium variants (Arc, Brave, etc.), use `--chrome-profile-dir` to point at a profile directory or cookie DB file directly.

To verify what credentials xcli found and where they came from:

```bash
xcli check
```

To use a specific browser or profile:

```bash
xcli --cookie-source firefox whoami
xcli --cookie-source safari --cookie-source chrome whoami
xcli --chrome-profile-dir "/Users/you/Library/Application Support/Arc/User Data/Default" whoami
```

## Output

Add `--json` to most commands for machine-readable JSON output. When using `--json` with pagination (`--all`, `--cursor`, `--max-pages`), output is `{ tweets, nextCursor }`.

Add `--json-full` to include the raw API response in a `_raw` field (tweet commands only).

Use `--plain` for stable, script-friendly output with no emoji and no ANSI color codes.

### Tweet JSON schema

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Tweet ID |
| `text` | string | Full tweet text (includes Note/Article content when present) |
| `author` | object | `{ username, name }` |
| `authorId` | string? | Author's user ID |
| `createdAt` | string | Timestamp |
| `replyCount` | number | Number of replies |
| `retweetCount` | number | Number of retweets |
| `likeCount` | number | Number of likes |
| `conversationId` | string | Thread conversation ID |
| `inReplyToStatusId` | string? | Parent tweet ID (present if this is a reply) |
| `quotedTweet` | object? | Embedded quote tweet (same schema; depth controlled by `--quote-depth`) |

### User JSON schema (following/followers)

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | User ID |
| `username` | string | Username/handle |
| `name` | string | Display name |
| `description` | string? | User bio |
| `followersCount` | number? | Followers count |
| `followingCount` | number? | Following count |
| `isBlueVerified` | boolean? | Blue verified flag |
| `profileImageUrl` | string? | Profile image URL |
| `createdAt` | string? | Account creation timestamp |

### News JSON schema

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier for the news item |
| `headline` | string | News headline or trend title |
| `category` | string? | Category (e.g., "AI · Technology", "Trending") |
| `timeAgo` | string? | Relative time (e.g., "2h ago") |
| `postCount` | number? | Number of posts |
| `description` | string? | Item description |
| `url` | string? | URL to the trend or news article |
| `tweets` | array? | Related tweets (only with `--with-tweets`) |

## Media uploads

Attach media to tweets and replies with `--media` (repeatable) and optional `--alt` per item. Up to 4 images/GIFs, or 1 video. Supported formats: jpg, jpeg, png, webp, gif, mp4, mov.

```bash
xcli tweet "check this out" --media screenshot.png --alt "A screenshot showing the results"
xcli tweet "two images" --media a.png --alt "first" --media b.png --alt "second"
```

## Query IDs

X rotates GraphQL "query IDs" frequently. `xcli` ships with a baseline mapping and caches a refreshed copy on disk.

- Default cache path: `~/.config/xcli/query-ids-cache.json`
- Override path: `XCLI_QUERY_IDS_CACHE=/path/to/file.json`
- Cache TTL: 24 hours

On a GraphQL 404 (stale query ID), `xcli` automatically refreshes the cache and retries. You can also refresh manually:

```bash
xcli query-ids --fresh
```

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Runtime error (network, auth, etc.) |
| `2` | Invalid usage or validation error (e.g., bad `--user` handle) |

## Development

```bash
git clone https://github.com/gupsammy/xcli
cd xcli
pnpm install
pnpm run build:dist   # TypeScript compilation only (outputs to dist/)
pnpm test             # Run the test suite
pnpm run build:binary # Compile standalone xcli binary (requires Bun)
```

To run commands during development without building the binary:

```bash
pnpm run dev tweet "Test tweet"
pnpm run dev -- --plain check
```

Contributions are welcome. Open issues and pull requests at [github.com/gupsammy/xcli](https://github.com/gupsammy/xcli).

## Credits

`xcli` is a fork of [bird](https://github.com/steipete/bird) by [@steipete](https://github.com/steipete) (now private). Many features were contributed by the bird community — see [CHANGELOG](./CHANGELOG.md) for details.

## License

MIT — see [LICENSE](./LICENSE)
