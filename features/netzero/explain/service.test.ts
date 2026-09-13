import { describe, expect, it } from "vitest";

import { GenerateError, type GenerateFn } from "./gemini";
import type { Packet } from "./packets";
import {
  createExplainMemory,
  explainPacket,
  FAILURE_COOLDOWN_MS,
  packetHash,
  type CacheRow,
  type ExplanationCache,
  type ExplainServiceDeps,
} from "./service";

const packet = {
  schema_version: 1,
  generated_at: "2026-09-13T08:00:00.000Z",
  scope: "sector",
  sector: "Energy",
  sector_verdict: "Pick winners here",
  pickable: true,
  cleanup_cost_years_of_sector_ebitda: 0.42,
  fossil_revenue_share_pct: 61.5,
  green_revenue_share_pct: 3.2,
  winner_loser_gap_years: 0.3,
  best_ticker: "AAA",
  best_composite_score: 80.1,
  worst_ticker: "ZZZ",
  worst_composite_score: 12.4,
} as unknown as Packet;

const gemini = JSON.stringify({
  takeaways: ["Cleanup costs 0.42 years of sector EBITDA.", "Fossil revenue is 61.5%.", "AAA scores 80.1, ZZZ 12.4."],
  pickability: "A 0.3-year gap rewards stock picking.",
  headline: "Energy: pick winners",
});

const ungrounded = JSON.stringify({ ...JSON.parse(gemini), headline: "Energy falls 40%" });

function memoryCache(): ExplanationCache & { rows: Map<string, CacheRow> } {
  const rows = new Map<string, CacheRow>();
  return {
    rows,
    get: async (scope, key, hash) => rows.get(`${scope}|${key}|${hash}`) ?? null,
    put: async (row) => void rows.set(`${row.scope}|${row.key}|${row.input_hash}`, row),
  };
}

function deps(generate: GenerateFn | null, overrides: Partial<ExplainServiceDeps> = {}) {
  const logs: string[] = [];
  let calls = 0;
  const counted: GenerateFn | null = generate && ((req) => (calls++, generate(req)));
  const d: ExplainServiceDeps = {
    cache: memoryCache(),
    generate: counted,
    log: (event) => void logs.push(event),
    sleep: async () => {},
    ...overrides,
  };
  return { d, logs, calls: () => calls };
}

describe("explainPacket", () => {
  it("calls Gemini once and serves the same text from the cache afterwards", async () => {
    const { d, calls } = deps(async () => gemini);
    const first = await explainPacket("sector", "Energy", packet, d);
    const second = await explainPacket("sector", "Energy", { ...packet, generated_at: "2026-09-14T00:00:00.000Z" }, d);
    expect(first.source).toBe("gemini");
    expect(second.source).toBe("cache");
    expect(second.explanation).toEqual(first.explanation);
    expect(calls()).toBe(1);
  });

  it("hashes the packet independent of key order and timestamp, but not of values or the explanation version", () => {
    const reordered = Object.fromEntries(Object.entries(packet).reverse()) as unknown as Packet;
    expect(packetHash(reordered)).toBe(packetHash({ ...packet, generated_at: "2030-01-01T00:00:00.000Z" }));
    expect(packetHash({ ...packet, fossil_revenue_share_pct: 61.6 } as Packet)).not.toBe(packetHash(packet));
    expect(packetHash(packet, "prompt-v1")).not.toBe(packetHash(packet, "prompt-v2"));
  });

  it("returns the fallback without caching it when Gemini fails, and tries Gemini again next time", async () => {
    const steps: (string | Error)[] = [new GenerateError(500), new GenerateError(500), gemini];
    const { d, logs } = deps(async () => {
      const s = steps.shift()!;
      if (s instanceof Error) throw s;
      return s;
    });
    const failed = await explainPacket("sector", "Energy", packet, d);
    expect(failed).toMatchObject({ source: "fallback", fallbackReason: "gemini-error", model: null });
    expect(logs).toContain("explain fell back");
    expect((await explainPacket("sector", "Energy", packet, d)).source).toBe("gemini");
  });

  it("falls back with no-key when no API key is available", async () => {
    const { d } = deps(null);
    expect(await explainPacket("sector", "Energy", packet, d)).toMatchObject({ source: "fallback", fallbackReason: "no-key" });
  });

  it("still answers when the cache is unreachable", async () => {
    const broken: ExplanationCache = {
      get: async () => {
        throw new Error("db down");
      },
      put: async () => {
        throw new Error("db down");
      },
    };
    const { d, logs } = deps(async () => gemini, { cache: broken });
    expect((await explainPacket("sector", "Energy", packet, d)).source).toBe("gemini");
    expect(logs).toEqual(["explain cache read failed", "explain cache write failed"]);
  });

  it("shares one Gemini call between identical concurrent requests", async () => {
    let release!: (text: string) => void;
    const { d, calls } = deps(() => new Promise<string>((resolve) => (release = resolve)), { memory: createExplainMemory() });
    const a = explainPacket("sector", "Energy", packet, d);
    const b = explainPacket("sector", "Energy", packet, d);
    await new Promise((r) => setTimeout(r, 0));
    release(gemini);
    expect((await a).source).toBe("gemini");
    expect((await b).source).toBe("gemini");
    expect(calls()).toBe(1);
  });

  it("does not call Gemini again for a packet that just failed grounding, until its cooldown ends", async () => {
    let time = 0;
    const { d, calls } = deps(async () => ungrounded, { memory: createExplainMemory(), now: () => time });
    expect((await explainPacket("sector", "Energy", packet, d)).fallbackReason).toBe("ungrounded");
    expect(calls()).toBe(2);
    expect((await explainPacket("sector", "Energy", packet, d)).fallbackReason).toBe("ungrounded");
    expect(calls()).toBe(2);
    time = FAILURE_COOLDOWN_MS.ungrounded + 1;
    await explainPacket("sector", "Energy", packet, d);
    expect(calls()).toBe(4);
  });

  it("pauses Gemini for every packet after a rate limit", async () => {
    let time = 0;
    const { d, calls } = deps(
      async () => {
        throw new GenerateError(429);
      },
      { memory: createExplainMemory(), now: () => time },
    );
    expect((await explainPacket("sector", "Energy", packet, d)).fallbackReason).toBe("rate-limited");
    expect(calls()).toBe(2);
    const other = { ...packet, sector: "Utilities" } as Packet;
    expect((await explainPacket("sector", "Utilities", other, d)).fallbackReason).toBe("rate-limited");
    expect(calls()).toBe(2);
    time = FAILURE_COOLDOWN_MS["rate-limited"] + 1;
    await explainPacket("sector", "Utilities", other, d);
    expect(calls()).toBe(4);
  });
});
