import { describe, expect, it } from "vitest";

import { createKeyCache } from "./key-cache";

function reader(values: (string | null)[]) {
  let reads = 0;
  return { read: async () => values[Math.min(reads++, values.length - 1)], reads: () => reads };
}

describe("createKeyCache", () => {
  it("reads once, shares the read between concurrent callers, and reuses it until the TTL ends", async () => {
    let time = 0;
    const r = reader(["key-1", "key-2"]);
    const cache = createKeyCache(r.read, { ttlMs: 1000, now: () => time });
    expect(await Promise.all([cache.get(), cache.get()])).toEqual(["key-1", "key-1"]);
    expect(r.reads()).toBe(1);
    time = 999;
    expect(await cache.get()).toBe("key-1");
    time = 1001;
    expect(await cache.get()).toBe("key-2");
  });

  it("remembers a failed read briefly, then tries again", async () => {
    let time = 0;
    const r = reader([null, "key-1"]);
    const cache = createKeyCache(r.read, { failureTtlMs: 100, now: () => time });
    expect(await cache.get()).toBeNull();
    expect(await cache.get()).toBeNull();
    expect(r.reads()).toBe(1);
    time = 101;
    expect(await cache.get()).toBe("key-1");
  });

  it("reads again after invalidate, so a rotated key is picked up", async () => {
    const r = reader(["old", "rotated"]);
    const cache = createKeyCache(r.read);
    expect(await cache.get()).toBe("old");
    cache.invalidate();
    expect(await cache.get()).toBe("rotated");
  });
});
