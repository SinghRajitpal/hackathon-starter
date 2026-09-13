import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  callGemini,
  GeminiApiError,
  GeminiMissingApiKeyError,
  GeminiRateLimitError,
  GeminiTimeoutError,
} from "./client";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.GEMINI_API_KEY = "test-key";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

describe("callGemini", () => {
  it("throws GeminiMissingApiKeyError when GEMINI_API_KEY is unset", async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(callGemini("system", { a: 1 })).rejects.toBeInstanceOf(GeminiMissingApiKeyError);
  });

  it("returns the text from a successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }),
      }),
    );
    const text = await callGemini("system", { a: 1 });
    expect(text).toBe('{"ok":true}');
  });

  it("throws GeminiRateLimitError on a 429", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    await expect(callGemini("system", { a: 1 })).rejects.toBeInstanceOf(GeminiRateLimitError);
  });

  it("throws GeminiApiError on a non-429 error status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "server error" }),
    );
    await expect(callGemini("system", { a: 1 })).rejects.toBeInstanceOf(GeminiApiError);
  });

  it("throws GeminiApiError when the response has no text content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ candidates: [] }) }),
    );
    await expect(callGemini("system", { a: 1 })).rejects.toBeInstanceOf(GeminiApiError);
  });

  it("throws GeminiTimeoutError when the request aborts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        const err = new Error("aborted");
        err.name = "AbortError";
        return Promise.reject(err);
      }),
    );
    await expect(callGemini("system", { a: 1 })).rejects.toBeInstanceOf(GeminiTimeoutError);
  });
});
