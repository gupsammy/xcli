import type { Command } from 'commander';
import type { CliContext } from '../cli/shared.js';
import { normalizeHandle } from '../lib/normalize-handle.js';
import { TwitterClient } from '../lib/twitter-client.js';

const ONLY_DIGITS_REGEX = /^\d+$/;

async function resolveUserId(
  client: TwitterClient,
  usernameOrId: string,
  ctx: CliContext,
): Promise<{ userId: string; username?: string } | null> {
  const raw = usernameOrId.trim();
  const isNumeric = ONLY_DIGITS_REGEX.test(raw);

  // Otherwise, treat as username and look up
  const handle = normalizeHandle(raw);
  if (handle) {
    const lookup = await client.getUserIdByUsername(handle);
    if (lookup.success && lookup.userId) {
      return { userId: lookup.userId, username: lookup.username };
    }
    if (!isNumeric) {
      console.error(`${ctx.p('err')}Failed to find user @${handle}: ${lookup.error ?? 'Unknown error'}`);
      return null;
    }
  }

  if (isNumeric) {
    return { userId: raw };
  }

  console.error(`${ctx.p('err')}Invalid username: ${usernameOrId}`);
  return null;
}

export function registerFollowCommands(program: Command, ctx: CliContext): void {
  program
    .command('follow')
    .description('Follow a user')
    .argument('<username-or-id>', 'Username (with or without @) or user ID to follow')
    .option('--json', 'Output result as JSON (auto-enabled when piped)')
    .action(async (usernameOrId: string, cmdOpts: { json?: boolean }) => {
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

      const resolved = await resolveUserId(client, usernameOrId, ctx);
      if (!resolved) {
        process.exit(1);
      }

      const { userId, username } = resolved;
      const displayName = username ? `@${username}` : userId;

      const result = await client.follow(userId);
      if (result.success) {
        const finalName = result.username ? `@${result.username}` : displayName;
        const useJson = cmdOpts.json || !ctx.isTty;
        if (useJson) {
          console.log(JSON.stringify({ action: 'follow', username: result.username ?? username ?? userId }));
        } else {
          console.log(`${ctx.p('ok')}Now following ${finalName}`);
        }
      } else {
        ctx.emitError('fetch_failed', `Failed to follow ${displayName}: ${result.error}`);
        process.exit(1);
      }
    });

  program
    .command('unfollow')
    .description('Unfollow a user')
    .argument('<username-or-id>', 'Username (with or without @) or user ID to unfollow')
    .option('--json', 'Output result as JSON (auto-enabled when piped)')
    .action(async (usernameOrId: string, cmdOpts: { json?: boolean }) => {
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

      const resolved = await resolveUserId(client, usernameOrId, ctx);
      if (!resolved) {
        process.exit(1);
      }

      const { userId, username } = resolved;
      const displayName = username ? `@${username}` : userId;

      const result = await client.unfollow(userId);
      if (result.success) {
        const finalName = result.username ? `@${result.username}` : displayName;
        const useJson = cmdOpts.json || !ctx.isTty;
        if (useJson) {
          console.log(JSON.stringify({ action: 'unfollow', username: result.username ?? username ?? userId }));
        } else {
          console.log(`${ctx.p('ok')}Unfollowed ${finalName}`);
        }
      } else {
        ctx.emitError('fetch_failed', `Failed to unfollow ${displayName}: ${result.error}`);
        process.exit(1);
      }
    });
}
