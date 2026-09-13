import { describe, expect, it } from "vitest";

import { GenerateError, type GenerateRequest } from "./gemini";
import { budgetedGenerate, createRateLimiter } from "./limits";

describe("createRateLimiter", () => {
  it("allows the limit per key per window, then resets", () => {
    let time = 0;
    const allow = createRateLimiter(2, 1000, () => time);
    expect([allow("a"), allow("a"), allow("a")]).toEqual([true, true, false]);
    expect(allow("b")).toBe(true);
    time = 1000;
    expect(allow("a")).toBe(true);
  });
});

describe("budgetedGenerate", () => {
  const request = {} as GenerateRequest;

  it("stops calling Gemini after the daily cap and resets the next UTC day", async () => {
    let time = Date.parse("2026-09-13T23:00:00Z");
    let calls = 0;
    const generate = budgetedGenerate(async () => `call ${++calls}`, 2, () => time);
    await generate(request);
    await generate(request);
    await expect(generate(request)).rejects.toEqual(new GenerateError(429, "daily explanation budget reached"));
    expect(calls).toBe(2);
    time = Date.parse("2026-09-14T00:00:01Z");
    await expect(generate(request)).resolves.toBe("call 3");
  });
});
