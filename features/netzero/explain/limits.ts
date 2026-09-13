import { GenerateError, type GenerateFn } from "./gemini";

/** Fixed-window request limiter per key (e.g. client IP). Process-local. Returns true when the request may proceed. */
export function createRateLimiter(limit: number, windowMs: number, now: () => number = Date.now) {
  const windows = new Map<string, { start: number; count: number }>();
  return (key: string): boolean => {
    const t = now();
    const current = windows.get(key);
    if (!current || t - current.start >= windowMs) {
      if (windows.size >= 10_000) {
        for (const [k, w] of windows) if (t - w.start >= windowMs) windows.delete(k);
      }
      windows.set(key, { start: t, count: 1 });
      return true;
    }
    current.count++;
    return current.count <= limit;
  };
}

/** Caps Gemini calls per UTC day for this process; over the cap, calls fail as rate-limited without reaching Gemini. */
export function budgetedGenerate(generate: GenerateFn, perDay: number, now: () => number = Date.now): GenerateFn {
  let day = "";
  let used = 0;
  return async (request) => {
    const today = new Date(now()).toISOString().slice(0, 10);
    if (today !== day) {
      day = today;
      used = 0;
    }
    if (used >= perDay) throw new GenerateError(429, "daily explanation budget reached");
    used++;
    return generate(request);
  };
}
