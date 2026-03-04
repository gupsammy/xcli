import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TwitterClient } from '../src/lib/twitter-client.js';
import { validCookies } from './twitter-client-fixtures.js';

const originalFetch = global.fetch;
const X_PREMIUM_REGEX = /X Premium/i;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('TwitterClient getBookmarkFolders', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  const makeSuccessResponse = (items: unknown[]) => ({
    ok: true,
    status: 200,
    json: async () => ({
      data: {
        viewer: {
          user_results: {
            result: {
              bookmark_collections_slice: {
                items,
              },
            },
          },
        },
      },
    }),
  });

  const makePremiumError = () => ({
    ok: true,
    status: 200,
    json: async () => ({
      data: {
        viewer: {
          user_results: {
            result: { __typename: 'User' },
          },
        },
      },
      errors: [
        {
          code: 37,
          message: 'Authorization: User is not authorized to use bookmark collections.',
          kind: 'Permissions',
          name: 'AuthorizationError',
        },
      ],
    }),
  });

  it('parses bookmark folders from a success response', async () => {
    mockFetch.mockResolvedValueOnce(
      makeSuccessResponse([
        {
          id: '2023077896198422998',
          name: 'AI Tools',
          description: 'Saving AI research links',
        },
        {
          id: '9876543210',
          name: 'Design Inspo',
          description: null,
        },
      ]),
    );

    const client = new TwitterClient({ cookies: validCookies });
    const result = await client.getBookmarkFolders();

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.folders).toHaveLength(2);
    expect(result.folders[0]).toMatchObject({
      id: '2023077896198422998',
      name: 'AI Tools',
      description: 'Saving AI research links',
    });
    expect(result.folders[1]).toMatchObject({
      id: '9876543210',
      name: 'Design Inspo',
    });
    expect(result.folders[1].description).toBeUndefined();
  });

  it('returns an empty array when the slice has no items', async () => {
    mockFetch.mockResolvedValueOnce(makeSuccessResponse([]));

    const client = new TwitterClient({ cookies: validCookies });
    const result = await client.getBookmarkFolders();

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.folders).toHaveLength(0);
  });

  it('returns a descriptive error when the account lacks X Premium (error code 37)', async () => {
    mockFetch.mockResolvedValueOnce(makePremiumError());

    const client = new TwitterClient({ cookies: validCookies });
    const result = await client.getBookmarkFolders();

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error).toMatch(X_PREMIUM_REGEX);
  });

  it('retries with refreshed query IDs on 404', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 404, text: async () => '' })
      .mockResolvedValueOnce(makeSuccessResponse([{ id: '111', name: 'Read Later' }]));

    const client = new TwitterClient({ cookies: validCookies });
    const result = await client.getBookmarkFolders();

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.folders[0]?.id).toBe('111');
    // Two fetches: first 404, then success
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('skips items missing id or name', async () => {
    mockFetch.mockResolvedValueOnce(
      makeSuccessResponse([
        { id: '123', name: 'Valid' },
        { id: '' }, // missing name
        { name: 'Missing ID' }, // missing id
        {}, // completely empty item
      ]),
    );

    const client = new TwitterClient({ cookies: validCookies });
    const result = await client.getBookmarkFolders();

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.folders).toHaveLength(1);
    expect(result.folders[0]?.name).toBe('Valid');
  });
});
