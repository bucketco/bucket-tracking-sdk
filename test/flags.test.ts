import { fail } from "assert";
import fetch from "cross-fetch";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  FLAGS_EXPIRE_MS,
  FLAGS_STALE_MS,
  FeatureFlagsResponse,
  clearCache,
  getFlags,
} from "../src/flags";

vi.mock("cross-fetch", () => {
  return {
    default: vi.fn(),
  };
});

const flagsResponse: FeatureFlagsResponse = {
  success: true,
  flags: {
    featureA: { value: true, key: "featureA" },
  },
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  clearCache();

  vi.mocked(fetch).mockResolvedValue({
    status: 200,
    ok: true,
    json: function () {
      return Promise.resolve(flagsResponse);
    },
  } as Response);
});

afterAll(() => {
  vi.useRealTimers;
});

describe("getFlags unit tests", () => {
  test("fetches flags", async () => {
    const flags = await getFlags({
      apiBaseUrl: "https://localhost",
      context: { user: { id: "123" } },
      timeoutMs: 1000,
    });

    expect(flags).toEqual(flagsResponse.flags);
  });

  test("deduplicates inflight requests", async () => {
    let resolve;
    const p = new Promise<Response>((r) => (resolve = r));
    vi.mocked(fetch).mockReturnValue(p);

    expect(vi.mocked(fetch).mock.calls.length).toBe(0);
    const a = getFlags({
      apiBaseUrl: "https://localhost",
      context: { user: { id: "123" } },
      timeoutMs: 1000,
    });

    const b = getFlags({
      apiBaseUrl: "https://localhost",
      context: { user: { id: "123" } },
      timeoutMs: 1000,
    });

    expect(vi.mocked(fetch).mock.calls.length).toBe(1);
    resolve(flagsResponse);

    await a;
  });

  test("caches response", async () => {
    expect(vi.mocked(fetch).mock.calls.length).toBe(0);

    await getFlags({
      apiBaseUrl: "https://localhost",
      context: { user: { id: "123" } },
      timeoutMs: 1000,
    });

    const flags = await getFlags({
      apiBaseUrl: "https://localhost",
      context: { user: { id: "123" } },
      timeoutMs: 1000,
    });
    expect(flags).toEqual(flagsResponse.flags);
    expect(vi.mocked(fetch).mock.calls.length).toBe(1);
  });

  test("caches negative response", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("Failed to fetch flags"));

    expect(vi.mocked(fetch).mock.calls.length).toBe(0);

    await getFlags({
      apiBaseUrl: "https://localhost",
      context: { user: { id: "123" } },
      timeoutMs: 1000,
    });

    const b = await getFlags({
      apiBaseUrl: "https://localhost",
      context: { user: { id: "123" } },
      timeoutMs: 1000,
    });
    expect(b).toBeUndefined();
    expect(vi.mocked(fetch).mock.calls.length).toBe(1);
  });

  test("serves stale cache while reevaluating", async () => {
    expect(vi.mocked(fetch).mock.calls.length).toBe(0);

    const a = await getFlags({
      apiBaseUrl: "https://localhost",
      context: { user: { id: "123" } },
      timeoutMs: 1000,
    });

    // change the response so we can validate that we'll serve the stale cache
    vi.mocked(fetch).mockResolvedValue({
      status: 200,
      ok: true,
      json: function () {
        return Promise.resolve({
          success: true,
          flags: {
            featureB: { value: true, key: "featureB" },
          },
        });
      },
    } as Response);

    vi.advanceTimersByTime(FLAGS_STALE_MS + 1);

    const b = await getFlags({
      apiBaseUrl: "https://localhost",
      context: { user: { id: "123" } },
      timeoutMs: 1000,
      staleWhileRevalidate: true,
    });

    expect(a).toEqual(b);

    // new fetch was fired
    expect(vi.mocked(fetch).mock.calls.length).toBe(2);
  });

  test("expires cache eventually", async () => {
    expect(vi.mocked(fetch).mock.calls.length).toBe(0);

    const a = await getFlags({
      apiBaseUrl: "https://localhost",
      context: { user: { id: "123" } },
      timeoutMs: 1000,
    });

    // change the response so we can validate that we'll serve the stale cache
    vi.mocked(fetch).mockResolvedValue({
      status: 200,
      ok: true,
      json: function () {
        return Promise.resolve({
          success: true,
          flags: {
            featureB: { value: true, key: "featureB" },
          },
        });
      },
    } as Response);

    expect(vi.mocked(fetch).mock.calls.length).toBe(1);

    vi.advanceTimersByTime(FLAGS_EXPIRE_MS + 1);

    const b = await getFlags({
      apiBaseUrl: "https://localhost",
      context: { user: { id: "123" } },
      timeoutMs: 1000,
      staleWhileRevalidate: true,
    });

    expect(vi.mocked(fetch).mock.calls.length).toBe(2);
    expect(a).not.toEqual(b);
  });
});
