# Plan: `xcli bookmark-folders` command

## Context

xcli supports `--folder-id` on the `bookmarks` command to fetch tweets from a specific bookmark folder, but there's no way to discover which folders exist or what their IDs are. Users must manually inspect browser DevTools to find folder IDs before they can use `--folder-id`.

Twitter's internal GraphQL API exposes `BookmarkFoldersSlice` (query, no feature switches, no variables), which returns the authenticated user's bookmark folders. This endpoint is documented in fa0311/TwitterInternalAPIDocument and the query ID rotates with other operations.

The goal is to add an `xcli bookmark-folders` command that lists bookmark folders with their IDs, names, and descriptions — both human-readable and `--json` output.

## Approach

The response shape of `BookmarkFoldersSlice` is not documented. Rather than guessing, we'll make a raw API call first, capture the real response, then build the parser to match.

## Files to modify

- `src/lib/twitter-client-constants.ts` — add `BookmarkFoldersSlice` to `FALLBACK_QUERY_IDS`
- `src/lib/query-ids.json` — add discovered queryId
- `scripts/update-query-ids.ts` — add `BookmarkFoldersSlice` to `TARGET_OPERATIONS`
- `src/lib/twitter-client-types.ts` — add `BookmarkFolder` and `BookmarkFoldersResult` types
- `src/lib/twitter-client-bookmarks.ts` — add `getBookmarkFolders()` method
- `src/lib/twitter-client.ts` — export new types

## New files

- `src/commands/bookmark-folders.ts` — CLI command registration

## Steps

### Step 1: Register the query ID

Add `BookmarkFoldersSlice` to three locations so the query ID is discoverable and refreshable.

In `src/lib/twitter-client-constants.ts`, add to `FALLBACK_QUERY_IDS`:

```ts
BookmarkFoldersSlice: 'i78YDd0Tza-dV4SYs58kRg',
```

In `src/lib/query-ids.json`, add:

```json
"BookmarkFoldersSlice": "i78YDd0Tza-dV4SYs58kRg"
```

In `scripts/update-query-ids.ts`, add `'BookmarkFoldersSlice'` to the `TARGET_OPERATIONS` array.

### Step 2: Make a raw API call to capture the response shape

Before building any parser, hit the endpoint and inspect what comes back. Use the existing `fetchWithTimeout` and `getHeaders()` from the base client.

Write a temporary test or one-off script (or use `--json-full` style raw output) that:

1. Authenticates with the user's cookies (same as any other command)
2. Calls `GET https://x.com/i/api/graphql/{queryId}/BookmarkFoldersSlice` with no variables and no features
3. Dumps the full JSON response to stdout

The simplest way: add a minimal `getBookmarkFoldersRaw()` method to the bookmarks mixin that returns the raw JSON response, wire it into a temporary `bookmark-folders` command with `--json` that just dumps the response, then run it:

```bash
xcli bookmark-folders --json 2>/dev/null | python3 -m json.tool
```

Expected response structure (hypothesized from Twitter's patterns, to be confirmed):

```jsonc
{
  "data": {
    "bookmark_collections_slice": {    // or "bookmark_folders_slice"
      "items": [                       // or nested under "slice_items"
        {
          "id": "1234567890",
          "name": "AI Tools",
          "description": "...",
          "icon": "...",               // possibly an emoji or icon name
          "bookmark_count": 42
        }
      ]
    }
  }
}
```

The actual shape will likely differ. Capture the real response and use it to define the types in Steps 3-4.

### Step 3: Define types based on real response

In `src/lib/twitter-client-types.ts`, add:

```ts
export interface BookmarkFolder {
  id: string;
  name: string;
  description?: string;
  // Add additional fields discovered from the raw response
  // (e.g., icon, bookmarkCount, mediaUrl, etc.)
}

export interface BookmarkFoldersResult {
  success: boolean;
  folders?: BookmarkFolder[];
  error?: string;
}
```

Adjust these fields based on whatever Step 2 reveals.

### Step 4: Implement `getBookmarkFolders()` in the bookmarks mixin

In `src/lib/twitter-client-bookmarks.ts`:

1. Add `getBookmarkFolders(): Promise<BookmarkFoldersResult>` to the `TwitterClientBookmarkMethods` interface.

2. Implement the method in the `withBookmarks` mixin class:

```ts
async getBookmarkFolders(): Promise<BookmarkFoldersResult> {
  // Get query IDs (primary from runtime/cache + fallback)
  const primary = await this.getQueryId('BookmarkFoldersSlice');
  const queryIds = Array.from(new Set([primary, 'i78YDd0Tza-dV4SYs58kRg']));

  // No variables, no features needed for this endpoint
  const params = new URLSearchParams({
    variables: JSON.stringify({}),
  });

  // Try each query ID (same retry-on-404 pattern as lists)
  // On success: parse response into BookmarkFolder[]
  // On 404: refresh query IDs and retry once
}
```

Key differences from other endpoints:
- No `variables` needed (empty object or omit entirely — confirm in Step 2)
- No `features` parameter (the endpoint has empty `featureSwitches`)
- Response parsing is custom (not the standard `parseTweetsFromInstructions`)

Follow the same `tryOnce` + `had404` refresh pattern used by `getOwnedLists()` in `twitter-client-lists.ts`.

### Step 5: Build the CLI command

Create `src/commands/bookmark-folders.ts`:

```ts
export function registerBookmarkFoldersCommand(program: Command, ctx: CliContext): void {
  program
    .command('bookmark-folders')
    .description('List your bookmark folders')
    .option('--json', 'Output as JSON')
    .action(async (cmdOpts: { json?: boolean }) => {
      // Auth resolution (same pattern as lists command)
      // Call client.getBookmarkFolders()
      // JSON mode: console.log(JSON.stringify(result.folders, null, 2))
      // Human mode: print each folder with id, name, description, bookmark URL
    });
}
```

Human-readable output format:

```
AI Tools
  3 bookmarks
  https://x.com/i/bookmarks/1234567890
──────────────────────────────────────────────────
Design Inspo
  12 bookmarks
  https://x.com/i/bookmarks/9876543210
──────────────────────────────────────────────────
```

Register in `src/cli/program.ts`:

```ts
import { registerBookmarkFoldersCommand } from '../commands/bookmark-folders.js';
// ...
registerBookmarkFoldersCommand(program, ctx);  // after registerBookmarksCommand
```

### Step 6: Export types and update the mixin chain

In `src/lib/twitter-client.ts`:
- Add `BookmarkFolder` and `BookmarkFoldersResult` to the re-exports
- The `TwitterClientBookmarkMethods` interface update from Step 4 automatically flows through the mixin chain (no changes needed to the composition)

### Step 7: Add to query ID refresh script

Verify `scripts/update-query-ids.ts` can discover the new operation by running:

```bash
cd ~/repos/forks/bird && npx tsx scripts/update-query-ids.ts
```

Confirm `BookmarkFoldersSlice` appears in the output with a query ID.

### Step 8: Test

```bash
# List folders (human-readable)
xcli bookmark-folders

# List folders (JSON, for piping to bookmark-sync config)
xcli bookmark-folders --json

# Generate bookmark-sync config directly
xcli bookmark-folders --json | jq '[.[] | {id: .id, tag: (.name | ascii_downcase | gsub(" "; "-"))}] | {folders: .}'
```

If the user has no bookmark folders, the command should print "No bookmark folders found." and exit 0.

### Step 9: Update xcli-bookmark-sync to auto-discover folders

Once `xcli bookmark-folders --json` works, update `~/scripts/xcli-bookmark-sync` to optionally auto-discover folders instead of requiring the manual `~/.xcli_bookmark_folders.json` config. This is a separate change to the sync script, not to xcli itself.

The sync script would call `xcli bookmark-folders --json` at startup, parse the folder list, and use it directly — falling back to the manual config if the command fails or isn't available.

## Notes

- `BookmarkFoldersSlice` has no feature switches (unlike most Twitter GraphQL queries). This means the request is simpler — no `features` parameter needed.
- Query IDs rotate every 2-4 weeks. The fallback ID `i78YDd0Tza-dV4SYs58kRg` is current as of March 2026 (sourced from fa0311/TwitterInternalAPIDocument daily auto-update).
- Bookmark folders are a premium/X Blue feature. The endpoint may return an empty list or an error for non-premium accounts. Handle gracefully.
- The existing `--folder-id` flag on `bookmarks` already accepts both raw numeric IDs and `https://x.com/i/bookmarks/<id>` URLs (via `extractBookmarkFolderId`), so the IDs from this new command can be used directly.
