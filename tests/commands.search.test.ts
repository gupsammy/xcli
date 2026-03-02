import { Command } from 'commander';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CliContext } from '../src/cli/shared.js';
import { buildSearchQuery, registerSearchCommands } from '../src/commands/search.js';
import { TwitterClient } from '../src/lib/twitter-client.js';

const SINCE_TIME_RE = /^cats since_time:(\d+)$/;

describe('buildSearchQuery', () => {
  it('returns base query unchanged when no opts given', () => {
    expect(buildSearchQuery('cats', {})).toBe('cats');
  });

  it('appends from: operator, stripping leading @', () => {
    expect(buildSearchQuery('cats', { from: '@steipete' })).toBe('cats from:steipete');
    expect(buildSearchQuery('cats', { from: 'steipete' })).toBe('cats from:steipete');
  });

  it('appends min_faves for --min-likes', () => {
    expect(buildSearchQuery('cats', { minLikes: '50' })).toBe('cats min_faves:50');
  });

  it('appends min_faves:10 for --quality', () => {
    expect(buildSearchQuery('cats', { quality: true })).toBe('cats min_faves:10');
  });

  it('--min-likes takes precedence over --quality', () => {
    expect(buildSearchQuery('cats', { quality: true, minLikes: '100' })).toBe('cats min_faves:100');
  });

  it('appends -filter:replies for --no-replies', () => {
    expect(buildSearchQuery('cats', { noReplies: true })).toBe('cats -filter:replies');
  });

  it('appends since_time for --since', () => {
    const before = Math.floor((Date.now() - 60 * 60 * 1000) / 1000);
    const result = buildSearchQuery('cats', { since: '1h' });
    const after = Math.floor((Date.now() - 60 * 60 * 1000) / 1000);
    const match = result.match(SINCE_TIME_RE);
    expect(match).not.toBeNull();
    const ts = Number(match?.[1]);
    expect(ts).toBeGreaterThanOrEqual(before - 1);
    expect(ts).toBeLessThanOrEqual(after + 1);
  });

  it('appends min_retweets for --min-retweets', () => {
    expect(buildSearchQuery('cats', { minRetweets: '5' })).toBe('cats min_retweets:5');
  });

  it('appends min_replies for --min-replies', () => {
    expect(buildSearchQuery('cats', { minReplies: '3' })).toBe('cats min_replies:3');
  });

  it('combines multiple operators', () => {
    const result = buildSearchQuery('AI', {
      from: 'sama',
      noReplies: true,
      minLikes: '20',
      minRetweets: '5',
      minReplies: '2',
    });
    expect(result).toContain('from:sama');
    expect(result).toContain('min_faves:20');
    expect(result).toContain('min_retweets:5');
    expect(result).toContain('min_replies:2');
    expect(result).toContain('-filter:replies');
    expect(result.startsWith('AI ')).toBe(true);
  });
});

describe('search command', () => {
  let program: Command;
  let mockContext: Partial<CliContext>;

  beforeEach(() => {
    program = new Command();
    const mockCreds = async () => ({
      cookies: { authToken: 'auth', ct0: 'ct0', cookieHeader: 'auth=auth; ct0=ct0' },
      warnings: [],
    });
    mockContext = {
      resolveTimeoutFromOptions: () => undefined,
      resolveQuoteDepthFromOptions: () => undefined,
      resolveCredentialsFromOptions: mockCreds,
      resolvePublicCredentialsFromOptions: mockCreds,
      p: () => '',
      printTweetsResult: vi.fn(),
    };
  });

  it('requires --all or --cursor when --max-pages is provided', async () => {
    registerSearchCommands(program, mockContext as CliContext);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit ${code}`);
    }) as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      await expect(program.parseAsync(['node', 'xcli', 'search', 'cats', '--max-pages', '2'])).rejects.toThrow(
        'exit 1',
      );
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('--max-pages requires --all or --cursor'));
    } finally {
      exitSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it('requires positive --count when not paging', async () => {
    registerSearchCommands(program, mockContext as CliContext);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit ${code}`);
    }) as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      await expect(program.parseAsync(['node', 'xcli', 'search', 'cats', '--count', '0'])).rejects.toThrow('exit 1');
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid --count. Expected a positive integer.'));
    } finally {
      exitSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it('requires positive --max-pages when paging', async () => {
    registerSearchCommands(program, mockContext as CliContext);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit ${code}`);
    }) as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      await expect(program.parseAsync(['node', 'xcli', 'search', 'cats', '--all', '--max-pages', '0'])).rejects.toThrow(
        'exit 1',
      );
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid --max-pages. Expected a positive integer.'),
      );
    } finally {
      exitSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it('uses paged search when --all is set', async () => {
    registerSearchCommands(program, mockContext as CliContext);
    const getAllSpy = vi
      .spyOn(TwitterClient.prototype, 'getAllSearchResults')
      .mockResolvedValue({ success: true, tweets: [] });
    const searchSpy = vi.spyOn(TwitterClient.prototype, 'search').mockResolvedValue({ success: true, tweets: [] });

    try {
      await program.parseAsync(['node', 'xcli', 'search', 'cats', '--all', '--json']);
      expect(getAllSpy).toHaveBeenCalledWith('cats', expect.objectContaining({ includeRaw: false }));
      expect(searchSpy).not.toHaveBeenCalled();
      expect(mockContext.printTweetsResult).toHaveBeenCalledWith(expect.objectContaining({ tweets: [] }), {
        json: true,
        usePagination: true,
        emptyMessage: 'No tweets found.',
      });
    } finally {
      getAllSpy.mockRestore();
      searchSpy.mockRestore();
    }
  });

  it('uses cursor pagination when --cursor is set', async () => {
    registerSearchCommands(program, mockContext as CliContext);
    const getAllSpy = vi
      .spyOn(TwitterClient.prototype, 'getAllSearchResults')
      .mockResolvedValue({ success: true, tweets: [] });

    try {
      await program.parseAsync(['node', 'xcli', 'search', 'cats', '--cursor', 'cursor-1']);
      expect(getAllSpy).toHaveBeenCalledWith('cats', expect.objectContaining({ cursor: 'cursor-1' }));
      expect(mockContext.printTweetsResult).toHaveBeenCalledWith(expect.objectContaining({ tweets: [] }), {
        json: false,
        usePagination: true,
        emptyMessage: 'No tweets found.',
      });
    } finally {
      getAllSpy.mockRestore();
    }
  });
});
