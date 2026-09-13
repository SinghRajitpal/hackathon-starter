import { describe, expect, it } from "vitest";
import { waterfill } from "./waterfill";

describe("waterfill", () => {
  it("allocates in proportion to preference", () => {
    const { alloc, leftover } = waterfill(1, [
      { key: "a", pref: 1, cap: 1 },
      { key: "b", pref: 3, cap: 1 },
    ]);
    expect(alloc.get("a")).toBeCloseTo(0.25);
    expect(alloc.get("b")).toBeCloseTo(0.75);
    expect(leftover).toBeCloseTo(0);
  });

  it("respects caps and passes the excess on", () => {
    const { alloc, leftover } = waterfill(1, [
      { key: "a", pref: 3, cap: 0.3 },
      { key: "b", pref: 1, cap: 1 },
    ]);
    expect(alloc.get("a")).toBeCloseTo(0.3);
    expect(alloc.get("b")).toBeCloseTo(0.7);
    expect(leftover).toBeCloseTo(0);
  });

  it("reports leftover when every entry is capped", () => {
    const { leftover } = waterfill(1, [
      { key: "a", pref: 1, cap: 0.2 },
      { key: "b", pref: 1, cap: 0.3 },
    ]);
    expect(leftover).toBeCloseTo(0.5);
  });
});
