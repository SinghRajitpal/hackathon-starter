/**
 * Grounding check: every number in Gemini's text must come from the packet. Formatting is normalised
 * (thousands separators, currency symbols, percent signs, unicode minus, B/bn/billion suffixes). A number
 * may be rounded, dropping at most one decimal place. A written minus sign must match a negative packet
 * value; an unsigned figure matches by magnitude ("underweight 0.15pp" for -0.15).
 */

/** Bump when the matching rules change, so cached explanations checked under old rules are not served. */
export const GROUNDING_RULES_VERSION = 2;

const PHRASES_WITHOUT_FIGURES = [/S&P\s?500/gi];
const NUMBER_RE = /(?<![A-Za-z0-9.])[-−]?\d[\d,]*(?:\.\d+)?(?:\s?(billion|bn|b|trillion|tn)\b)?/gi;
const SKIP_PACKET_KEYS = new Set(["generated_at"]);
/** Multiples written as words ("nearly triple the median") are computed ratios the packet never states. */
const MULTIPLE_WORDS = /\b(?:twice|double[sd]?|doubling|triple[sd]?|tripling|quadruple[sd]?|(?:two|three|four|five|ten)fold|half)\b/gi;

interface NumberToken {
  text: string;
  /** Unsigned value as written. */
  value: number;
  negative: boolean;
  decimals: number;
  scale: 1 | 1e3 | 1e6;
}

function tokens(text: string): NumberToken[] {
  let cleaned = text;
  for (const re of PHRASES_WITHOUT_FIGURES) cleaned = cleaned.replace(re, " ");
  const out: NumberToken[] = [];
  for (const match of cleaned.matchAll(NUMBER_RE)) {
    const suffix = match[1]?.toLowerCase();
    const numeric = match[0].replace(/\s?(billion|bn|b|trillion|tn)$/i, "").replace(/[-−,]/g, "");
    const point = numeric.indexOf(".");
    // Money in packets is USD millions, so "$1.2bn" is 1,200 of those units.
    const scale = suffix === "billion" || suffix === "bn" || suffix === "b" ? 1e3 : suffix === "trillion" || suffix === "tn" ? 1e6 : 1;
    out.push({
      text: match[0],
      value: Number(numeric),
      negative: /^[-−]/.test(match[0]),
      decimals: point < 0 ? 0 : numeric.length - point - 1,
      scale,
    });
  }
  return out;
}

function collect(value: unknown, numbers: number[], strings: string[], key?: string): void {
  if (key !== undefined && SKIP_PACKET_KEYS.has(key)) return;
  if (typeof value === "number") numbers.push(value);
  else if (typeof value === "string") strings.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collect(v, numbers, strings));
  else if (value !== null && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) collect(v, numbers, strings, k);
  }
}

/** Every number the packet states, signed, including figures inside its strings (e.g. a company named "3M"). */
function allowedNumbers(packet: unknown): number[] {
  const numbers: number[] = [];
  const strings: string[] = [];
  collect(packet, numbers, strings);
  for (const s of strings) for (const t of tokens(s)) numbers.push((t.negative ? -1 : 1) * t.value * t.scale);
  return numbers;
}

function decimalsOf(value: number): number {
  const s = String(Math.abs(value));
  if (s.includes("e")) return 0;
  const point = s.indexOf(".");
  return point < 0 ? 0 : s.length - point - 1;
}

function matches(token: NumberToken, allowed: number[]): boolean {
  return allowed.some((v) => {
    if (token.negative && v >= 0) return false;
    // Scaled money ("$8.3bn" from 8260.52 million) may round freely; plain figures may drop one decimal.
    if (token.scale === 1 && token.decimals < decimalsOf(v) - 1) return false;
    return Math.abs(Math.abs(v) / token.scale - token.value) <= 0.5 * 10 ** -token.decimals + 1e-9;
  });
}

export interface GroundingResult {
  ok: boolean;
  unmatched: string[];
}

export function validateGrounding(output: unknown, packet: unknown): GroundingResult {
  const allowed = allowedNumbers(packet);
  const strings: string[] = [];
  collect(output, [], strings);
  const unmatched = strings.flatMap((s) => [
    ...tokens(s)
      .filter((t) => !matches(t, allowed))
      .map((t) => t.text),
    ...(s.match(MULTIPLE_WORDS) ?? []),
  ]);
  return { ok: unmatched.length === 0, unmatched };
}
