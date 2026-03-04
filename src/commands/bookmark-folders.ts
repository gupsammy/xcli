// ABOUTME: CLI command for listing Twitter bookmark folders (X Premium feature).
// ABOUTME: Outputs folder IDs and names in human-readable or JSON format.

import type { Command } from 'commander';
import type { CliContext } from '../cli/shared.js';
import { hyperlink } from '../lib/output.js';
import type { BookmarkFolder } from '../lib/twitter-client.js';
import { TwitterClient } from '../lib/twitter-client.js';

function printBookmarkFolders(folders: BookmarkFolder[], ctx: CliContext): void {
  for (const folder of folders) {
    const folderUrl = `https://x.com/i/bookmarks/${folder.id}`;
    console.log(`${folder.name}  ${ctx.colors.muted(`[${folder.id}]`)}`);
    if (folder.description) {
      console.log(`  ${folder.description}`);
    }
    console.log(`  ${ctx.colors.accent(hyperlink(folderUrl, folderUrl, ctx.getOutput()))}`);
    console.log('──────────────────────────────────────────────────');
  }
}

export function registerBookmarkFoldersCommand(program: Command, ctx: CliContext): void {
  program
    .command('bookmark-folders')
    .description('List your bookmark folders (requires X Premium)')
    .option('--json', 'Output as JSON')
    .action(async (cmdOpts: { json?: boolean }) => {
      const opts = program.opts();
      const timeoutMs = ctx.resolveTimeoutFromOptions(opts);

      const { cookies, warnings } = await ctx.resolveCredentialsFromOptions(opts);

      for (const warning of warnings) {
        console.error(`${ctx.p('warn')}${warning}`);
      }

      if (!cookies.authToken || !cookies.ct0) {
        console.error(`${ctx.p('err')}Missing required credentials`);
        process.exit(1);
      }

      const client = new TwitterClient({ cookies, timeoutMs });
      const result = await client.getBookmarkFolders();

      if (!result.success) {
        console.error(`${ctx.p('err')}${result.error}`);
        process.exit(1);
      }

      if (cmdOpts.json) {
        console.log(JSON.stringify(result.folders, null, 2));
        return;
      }

      if (result.folders.length === 0) {
        console.log('No bookmark folders found.');
        return;
      }

      printBookmarkFolders(result.folders, ctx);
    });
}
