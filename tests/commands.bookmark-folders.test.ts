import { Command } from 'commander';
import { describe, expect, it, vi } from 'vitest';
import type { CliContext } from '../src/cli/shared.js';
import { registerBookmarkFoldersCommand } from '../src/commands/bookmark-folders.js';

const makeCtx = (getBookmarkFoldersResult = { success: true as const, folders: [] }) =>
  ({
    resolveTimeoutFromOptions: () => undefined,
    resolveCredentialsFromOptions: async () => ({
      cookies: { authToken: 'auth', ct0: 'ct0', cookieHeader: 'auth_token=auth; ct0=ct0', source: 'test' },
      warnings: [],
    }),
    p: (kind: string) => `[${kind}] `,
    colors: {
      muted: (s: string) => s,
      accent: (s: string) => s,
    },
    getOutput: () => ({ hyperlinks: false }),
    // Inject a fake client via TwitterClient mock below
    _getBookmarkFoldersResult: getBookmarkFoldersResult,
  }) as unknown as CliContext;

describe('bookmark-folders command', () => {
  it('prints "No bookmark folders found." when result is empty', async () => {
    const program = new Command();
    const ctx = makeCtx({ success: true, folders: [] });

    // Mock TwitterClient to return empty folders
    const { TwitterClient } = await import('../src/lib/twitter-client.js');
    const spy = vi.spyOn(TwitterClient.prototype, 'getBookmarkFolders').mockResolvedValue({
      success: true,
      folders: [],
    });

    registerBookmarkFoldersCommand(program, ctx);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      await program.parseAsync(['node', 'xcli', 'bookmark-folders']);
      expect(logSpy).toHaveBeenCalledWith('No bookmark folders found.');
    } finally {
      spy.mockRestore();
      logSpy.mockRestore();
    }
  });

  it('outputs JSON when --json flag is passed', async () => {
    const program = new Command();
    const ctx = makeCtx();

    const { TwitterClient } = await import('../src/lib/twitter-client.js');
    const mockFolders = [{ id: '123', name: 'AI Tools' }];
    const spy = vi.spyOn(TwitterClient.prototype, 'getBookmarkFolders').mockResolvedValue({
      success: true,
      folders: mockFolders,
    });

    registerBookmarkFoldersCommand(program, ctx);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      await program.parseAsync(['node', 'xcli', 'bookmark-folders', '--json']);
      expect(logSpy).toHaveBeenCalledWith(JSON.stringify(mockFolders, null, 2));
    } finally {
      spy.mockRestore();
      logSpy.mockRestore();
    }
  });

  it('exits with code 1 on API error', async () => {
    const program = new Command();
    const ctx = makeCtx();

    const { TwitterClient } = await import('../src/lib/twitter-client.js');
    const spy = vi.spyOn(TwitterClient.prototype, 'getBookmarkFolders').mockResolvedValue({
      success: false,
      error: 'Bookmark folders require X Premium.',
    });

    registerBookmarkFoldersCommand(program, ctx);

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit ${code}`);
    }) as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      await expect(program.parseAsync(['node', 'xcli', 'bookmark-folders'])).rejects.toThrow('exit 1');
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Bookmark folders require X Premium.'));
    } finally {
      spy.mockRestore();
      exitSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it('exits with code 1 when credentials are missing', async () => {
    const program = new Command();
    const ctx = {
      resolveTimeoutFromOptions: () => undefined,
      resolveCredentialsFromOptions: async () => ({
        cookies: { authToken: null, ct0: null, cookieHeader: null, source: null },
        warnings: [],
      }),
      p: (kind: string) => `[${kind}] `,
      colors: { muted: (s: string) => s, accent: (s: string) => s },
      getOutput: () => ({ hyperlinks: false }),
    } as unknown as CliContext;

    registerBookmarkFoldersCommand(program, ctx);

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit ${code}`);
    }) as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      await expect(program.parseAsync(['node', 'xcli', 'bookmark-folders'])).rejects.toThrow('exit 1');
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Missing required credentials'));
    } finally {
      exitSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});
