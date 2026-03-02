import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Command } from 'commander';
import { parsePaginationFlags } from '../cli/pagination.js';
import type { CliContext } from '../cli/shared.js';
import { mentionsQueryFromUserOption, normalizeHandle } from '../lib/normalize-handle.js';
import { TwitterClient } from '../lib/twitter-client.js';
import type { TweetData } from '../lib/twitter-client-types.js';

const AT_PREFIX_RE = /^@/;
const TRAILING_HYPHENS_RE = /-+$/;
const SLUG_UNSAFE_CHARS_RE = /[^a-z0-9]+/gi;
const TIMESTAMP_PUNCT_RE = /[:.]/g;

const SINCE_OFFSETS_MS: Record<string, number> = {
  '1h': 60 * 60 * 1000,
  '3h': 3 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};

export function buildSearchQuery(
  base: string,
  opts: {
    from?: string;
    noReplies?: boolean;
    quality?: boolean;
    minLikes?: string;
    minRetweets?: string;
    minReplies?: string;
    since?: string;
  },
): string {
  const parts: string[] = [base.trim()];

  if (opts.from) {
    parts.push(`from:${opts.from.replace(AT_PREFIX_RE, '')}`);
  }

  if (opts.since) {
    const offsetMs = SINCE_OFFSETS_MS[opts.since];
    if (offsetMs !== undefined) {
      const sinceSeconds = Math.floor((Date.now() - offsetMs) / 1000);
      parts.push(`since_time:${sinceSeconds}`);
    }
  }

  if (opts.minLikes) {
    parts.push(`min_faves:${opts.minLikes}`);
  } else if (opts.quality) {
    parts.push('min_faves:10');
  }

  if (opts.minRetweets) {
    parts.push(`min_retweets:${opts.minRetweets}`);
  }

  if (opts.minReplies) {
    parts.push(`min_replies:${opts.minReplies}`);
  }

  if (opts.noReplies) {
    parts.push('-filter:replies');
  }

  return parts.join(' ');
}

export function formatTweetsAsMarkdown(tweets: TweetData[], opts: { query: string; sort: string }): string {
  const date = new Date().toISOString().slice(0, 10);
  const count = tweets.length;
  const lines: string[] = [
    `# Search: ${opts.query}`,
    `*${count} result${count !== 1 ? 's' : ''} · sorted by ${opts.sort} · ${date}*`,
    '',
    '---',
    '',
  ];

  for (const tweet of tweets) {
    const created = tweet.createdAt
      ? new Date(tweet.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
      : '';
    lines.push(`**@${tweet.author.username}** (${tweet.author.name}) · ${created}`);
    lines.push(tweet.text);
    lines.push(`❤️ ${tweet.likeCount ?? 0} · 🔁 ${tweet.retweetCount ?? 0} · 💬 ${tweet.replyCount ?? 0}`);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

export function registerSearchCommands(program: Command, ctx: CliContext): void {
  program
    .command('search')
    .description('Search for tweets')
    .argument('<query>', 'Search query (e.g., "@clawdbot" or "from:clawdbot")')
    .option('-n, --count <number>', 'Number of tweets to fetch', '10')
    .option('--all', 'Fetch all search results (paged)')
    .option('--max-pages <number>', 'Stop after N pages when using --all')
    .option('--cursor <string>', 'Resume pagination from a cursor')
    .option('--sort <order>', 'Sort order: recent (default), top, likes, retweets', 'recent')
    .option('--from <username>', 'Restrict to tweets from this user (shorthand for from:username)')
    .option('--since <period>', 'Time window: 1h, 3h, 12h, 1d, 7d')
    .option('--min-likes <n>', 'Minimum likes (min_faves:N operator)')
    .option('--min-retweets <n>', 'Minimum retweets (min_retweets:N operator)')
    .option('--min-replies <n>', 'Minimum replies (min_replies:N operator)')
    .option('--no-replies', 'Exclude replies (-filter:replies operator)')
    .option('--quality', 'Pre-filter low-engagement tweets (min_faves:10); ignored if --min-likes is set')
    .option('--pages <n>', 'Fetch N pages (20 tweets/page); shorthand for --all --max-pages N')
    .option('--limit <n>', 'Cap results displayed (applied after fetch and sort)')
    .option('--markdown', 'Print results as a markdown research document')
    .option('--save', 'Save results to ~/clawd/drafts/ as a markdown file')
    .option('--json', 'Output as JSON')
    .option('--json-full', 'Output as JSON with full raw API response in _raw field')
    .action(
      async (
        query: string,
        cmdOpts: {
          count?: string;
          all?: boolean;
          maxPages?: string;
          cursor?: string;
          sort?: string;
          from?: string;
          since?: string;
          minLikes?: string;
          minRetweets?: string;
          minReplies?: string;
          replies?: boolean; // commander flips --no-replies to replies:false
          quality?: boolean;
          pages?: string;
          limit?: string;
          markdown?: boolean;
          save?: boolean;
          json?: boolean;
          jsonFull?: boolean;
        },
      ) => {
        const opts = program.opts();
        const timeoutMs = ctx.resolveTimeoutFromOptions(opts);
        const quoteDepth = ctx.resolveQuoteDepthFromOptions(opts);
        const count = Number.parseInt(cmdOpts.count || '10', 10);

        const VALID_SORTS = ['recent', 'top', 'likes', 'retweets'] as const;
        type SortOrder = (typeof VALID_SORTS)[number];
        const sort = (cmdOpts.sort ?? 'recent') as SortOrder;
        if (!VALID_SORTS.includes(sort)) {
          console.error(`${ctx.p('err')}Invalid --sort value "${sort}". Expected one of: recent, top, likes, retweets`);
          process.exit(2);
        }

        if (cmdOpts.since && !SINCE_OFFSETS_MS[cmdOpts.since]) {
          console.error(
            `${ctx.p('err')}Invalid --since value "${cmdOpts.since}". Expected one of: 1h, 3h, 12h, 1d, 7d`,
          );
          process.exit(2);
        }

        if (cmdOpts.minLikes !== undefined) {
          const n = Number.parseInt(cmdOpts.minLikes, 10);
          if (!Number.isFinite(n) || n < 0) {
            console.error(`${ctx.p('err')}Invalid --min-likes value. Expected a non-negative integer.`);
            process.exit(2);
          }
        }

        let pagesN: number | undefined;
        if (cmdOpts.pages !== undefined) {
          pagesN = Number.parseInt(cmdOpts.pages, 10);
          if (!Number.isFinite(pagesN) || pagesN <= 0) {
            console.error(`${ctx.p('err')}Invalid --pages value. Expected a positive integer.`);
            process.exit(2);
          }
        }

        let limitN: number | undefined;
        if (cmdOpts.limit !== undefined) {
          limitN = Number.parseInt(cmdOpts.limit, 10);
          if (!Number.isFinite(limitN) || limitN <= 0) {
            console.error(`${ctx.p('err')}Invalid --limit value. Expected a positive integer.`);
            process.exit(2);
          }
        }

        const pagination = parsePaginationFlags(cmdOpts);
        if (!pagination.ok) {
          console.error(`${ctx.p('err')}${pagination.error}`);
          process.exit(1);
        }
        // --pages N is shorthand for --all --max-pages N
        const usePagesShorthand = pagesN !== undefined;
        const maxPages = usePagesShorthand ? pagesN : pagination.maxPages;

        const { cookies, warnings } = await ctx.resolvePublicCredentialsFromOptions(opts);

        for (const warning of warnings) {
          console.error(`${ctx.p('warn')}${warning}`);
        }

        if (!cookies.authToken || !cookies.ct0) {
          console.error(`${ctx.p('err')}Missing required credentials`);
          process.exit(1);
        }

        const usePagination = usePagesShorthand || pagination.usePagination;
        if (maxPages !== undefined && !usePagination) {
          console.error(`${ctx.p('err')}--max-pages requires --all or --cursor.`);
          process.exit(1);
        }
        if (!usePagination && (!Number.isFinite(count) || count <= 0)) {
          console.error(`${ctx.p('err')}Invalid --count. Expected a positive integer.`);
          process.exit(1);
        }

        const finalQuery = buildSearchQuery(query, {
          from: cmdOpts.from,
          since: cmdOpts.since,
          minLikes: cmdOpts.minLikes,
          minRetweets: cmdOpts.minRetweets,
          minReplies: cmdOpts.minReplies,
          noReplies: cmdOpts.replies === false,
          quality: cmdOpts.quality,
        });

        const client = new TwitterClient({ cookies, timeoutMs, quoteDepth });
        const includeRaw = cmdOpts.jsonFull ?? false;
        const searchOptions = { includeRaw, sort };
        const paginationOptions = { includeRaw, maxPages, cursor: pagination.cursor, sort };
        const result = usePagination
          ? await client.getAllSearchResults(finalQuery, paginationOptions)
          : await client.search(finalQuery, count, searchOptions);

        if (result.success) {
          const tweets = limitN ? result.tweets.slice(0, limitN) : result.tweets;

          if (cmdOpts.save) {
            const draftsDir = join(homedir(), 'clawd', 'drafts');
            mkdirSync(draftsDir, { recursive: true });
            const slug = finalQuery
              .replace(SLUG_UNSAFE_CHARS_RE, '-')
              .toLowerCase()
              .slice(0, 50)
              .replace(TRAILING_HYPHENS_RE, '');
            const timestamp = new Date().toISOString().replace(TIMESTAMP_PUNCT_RE, '-').slice(0, 19);
            const filepath = join(draftsDir, `${timestamp}-${slug}.md`);
            writeFileSync(filepath, formatTweetsAsMarkdown(tweets, { query: finalQuery, sort }), 'utf8');
            console.error(`Saved to ${filepath}`);
          }

          if (cmdOpts.markdown) {
            process.stdout.write(formatTweetsAsMarkdown(tweets, { query: finalQuery, sort }));
            return;
          }

          const isJson = Boolean(cmdOpts.json || cmdOpts.jsonFull);
          ctx.printTweetsResult(
            { ...result, tweets },
            {
              json: isJson,
              usePagination: Boolean(usePagination),
              emptyMessage: 'No tweets found.',
            },
          );
        } else {
          console.error(`${ctx.p('err')}Search failed: ${result.error}`);
          process.exit(1);
        }
      },
    );

  program
    .command('mentions')
    .description('Find tweets mentioning a user (defaults to current user)')
    .option('-u, --user <handle>', 'User handle (e.g. @steipete)')
    .option('-n, --count <number>', 'Number of tweets to fetch', '10')
    .option('--json', 'Output as JSON')
    .option('--json-full', 'Output as JSON with full raw API response in _raw field')
    .action(async (cmdOpts: { user?: string; count?: string; json?: boolean; jsonFull?: boolean }) => {
      const opts = program.opts();
      const timeoutMs = ctx.resolveTimeoutFromOptions(opts);
      const quoteDepth = ctx.resolveQuoteDepthFromOptions(opts);
      const count = Number.parseInt(cmdOpts.count || '10', 10);

      const fromUserOpt = mentionsQueryFromUserOption(cmdOpts.user);
      if (fromUserOpt.error) {
        console.error(`${ctx.p('err')}${fromUserOpt.error}`);
        process.exit(2);
      }

      let query: string | null = fromUserOpt.query;

      const { cookies, warnings } = await ctx.resolveCredentialsFromOptions(opts);

      for (const warning of warnings) {
        console.error(`${ctx.p('warn')}${warning}`);
      }

      if (!cookies.authToken || !cookies.ct0) {
        console.error(`${ctx.p('err')}Missing required credentials`);
        process.exit(1);
      }

      const client = new TwitterClient({ cookies, timeoutMs, quoteDepth });

      if (!query) {
        const who = await client.getCurrentUser();
        const handle = normalizeHandle(who.user?.username);
        if (handle) {
          query = `@${handle}`;
        } else {
          console.error(
            `${ctx.p('err')}Could not determine current user (${who.error ?? 'Unknown error'}). Use --user <handle>.`,
          );
          process.exit(1);
        }
      }

      const includeRaw = cmdOpts.jsonFull ?? false;
      const result = await client.search(query, count, { includeRaw });

      if (result.success) {
        ctx.printTweets(result.tweets, {
          json: cmdOpts.json || cmdOpts.jsonFull,
          emptyMessage: 'No mentions found.',
        });
      } else {
        console.error(`${ctx.p('err')}Failed to fetch mentions: ${result.error}`);
        process.exit(1);
      }
    });
}
