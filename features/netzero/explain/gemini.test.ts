import { describe, expect, it } from "vitest";

import { EXPLAIN_MODEL, explain, GenerateError, type GenerateFn, type GenerateRequest } from "./gemini";
import type { Packet } from "./packets";
import { GROUNDING_RETRY_MESSAGE, SYSTEM_INSTRUCTION } from "./prompt";
import { RESPONSE_SCHEMAS } from "./schemas";

const packet = {
  schema_version: 1,
  generated_at: "2026-09-13T08:00:00.000Z",
  scope: "company",
  ticker: "ENE3",
  transition_bill_to_ebitda_years: 1.13,
  rank_in_sector: 3,
  sector_size: 22,
  verdict_band: "HOLD",
} as unknown as Packet;

const answer = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    key_drivers: ["Cleanup costs 1.13 years of earnings", "Rank 3 of 22 in its sector", "Revenue upside not computed"],
    rationale: "Mixed numbers.",
    caveat: "",
    verdict_line: "HOLD: burden of 1.13 years.",
    verdict: "HOLD",
    ...overrides,
  });

function fake(steps: (string | Error)[]) {
  const requests: GenerateRequest[] = [];
  const generate: GenerateFn = async (request) => {
    requests.push(request);
    const step = steps.shift();
    if (step === undefined) throw new Error("unexpected extra Gemini call");
    if (step instanceof Error) throw step;
    return step;
  };
  const sleeps: number[] = [];
  return { requests, sleeps, deps: { generate, sleep: async (ms: number) => void sleeps.push(ms), random: () => 0.5 } };
}

describe("explain", () => {
  it("sends only the system instruction, the <data> packet and the scope line, with the scope's schema", async () => {
    const f = fake([answer()]);
    const outcome = await explain("company", packet, f.deps);
    expect(outcome.ok).toBe(true);
    expect(f.requests).toHaveLength(1);
    expect(f.requests[0]).toEqual({
      model: EXPLAIN_MODEL,
      systemInstruction: SYSTEM_INSTRUCTION,
      userMessage: `<data>${JSON.stringify(packet)}</data>\nscope: company`,
      responseSchema: RESPONSE_SCHEMAS.company,
    });
  });

  it("retries once after a 429 with a jittered wait", async () => {
    const f = fake([new GenerateError(429), answer()]);
    expect((await explain("company", packet, f.deps)).ok).toBe(true);
    expect(f.sleeps).toEqual([1500]);
  });

  it("falls back as rate-limited when the retry is also refused", async () => {
    const f = fake([new GenerateError(429), new GenerateError(429)]);
    expect(await explain("company", packet, f.deps)).toEqual({ ok: false, reason: "rate-limited", discarded: [] });
  });

  it("does not retry a timeout", async () => {
    const f = fake([new GenerateError("timeout")]);
    expect(await explain("company", packet, f.deps)).toMatchObject({ ok: false, reason: "timeout" });
    expect(f.requests).toHaveLength(1);
  });

  it("regenerates with the correction line when a number is not in the packet", async () => {
    const f = fake([answer({ rationale: "Demand falls 40%." }), answer()]);
    expect((await explain("company", packet, f.deps)).ok).toBe(true);
    expect(f.requests[1].userMessage).toBe(`<data>${JSON.stringify(packet)}</data>\nscope: company\n${GROUNDING_RETRY_MESSAGE}`);
  });

  it("discards two ungrounded answers", async () => {
    const bad = answer({ rationale: "Demand falls 40%." });
    const f = fake([bad, bad]);
    expect(await explain("company", packet, f.deps)).toEqual({ ok: false, reason: "ungrounded", discarded: [bad, bad] });
  });

  it("rejects a verdict that differs from verdict_band", async () => {
    const wrong = answer({ verdict: "BUY" });
    const f = fake([wrong, wrong]);
    expect(await explain("company", packet, f.deps)).toMatchObject({ ok: false, reason: "invalid-output" });
  });

  it("treats a JSON null response as invalid output instead of throwing", async () => {
    const f = fake(["null", "null"]);
    expect(await explain("company", packet, f.deps)).toEqual({ ok: false, reason: "invalid-output", discarded: ["null", "null"] });
  });

  it("rejects text that is not JSON or misses a field", async () => {
    const f = fake(["not json", JSON.stringify({ verdict: "HOLD" })]);
    expect(await explain("company", packet, f.deps)).toMatchObject({ ok: false, reason: "invalid-output" });
  });
});
