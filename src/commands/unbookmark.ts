import type { Command } from 'commander';
import type { CliContext } from '../cli/shared.js';
import { TwitterClient } from '../lib/twitter-client.js';

export function registerUnbookmarkCommand(program: Command, ctx: CliContext): void {
  program
    .command('unbookmark')
    .description('Remove bookmarked tweets')
    .argument('<tweet-id-or-url...>', 'Tweet IDs or URLs to remove from bookmarks')
    .option('--json', 'Output result as JSON (auto-enabled when piped)')
    .action(async (tweetIdOrUrls: string[], cmdOpts: { json?: boolean }) => {
      const opts = program.opts();
      const timeoutMs = ctx.resolveTimeoutFromOptions(opts);

      const { cookies, warnings } = await ctx.resolveCredentialsFromOptions(opts);

      for (const warning of warnings) {
        console.error(`${ctx.p('warn')}${warning}`);
      }

      if (!cookies.authToken || !cookies.ct0) {
        ctx.emitError('missing_credentials', 'Missing required credentials', 'bird check');
        process.exit(1);
      }

      const client = new TwitterClient({ cookies, timeoutMs });
      let failures = 0;
      const useJson = cmdOpts.json || !ctx.isTty;

      for (const input of tweetIdOrUrls) {
        const tweetId = ctx.extractTweetId(input);
        const result = await client.unbookmark(tweetId);
        if (result.success) {
          if (useJson) {
            process.stdout.write(`${JSON.stringify({ removed: tweetId })}\n`);
          } else {
            console.log(`${ctx.p('ok')}Removed bookmark for ${tweetId}`);
          }
        } else {
          failures += 1;
          ctx.emitError('fetch_failed', `Failed to remove bookmark for ${tweetId}: ${result.error}`);
        }
      }

      if (failures > 0) {
        process.exit(1);
      }
    });
}
