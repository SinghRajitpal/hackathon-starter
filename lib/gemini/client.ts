// Thin server-side wrapper around the Gemini REST API (no SDK
// dependency -- a single fetch call is simpler than adding
// @google/generative-ai for one endpoint). The API key never leaves
// the server: this module is only ever imported from
// app/api/sustainability-analysis/route.ts, never from a client
// component.
const DEFAULT_MODEL = "gemini-3.6-flash";
const TIMEOUT_MS = 25_000;

export class GeminiMissingApiKeyError extends Error {
  constructor() {
    super("GEMINI_API_KEY is not set");
    this.name = "GeminiMissingApiKeyError";
  }
}

export class GeminiTimeoutError extends Error {
  constructor() {
    super("Gemini request timed out");
    this.name = "GeminiTimeoutError";
  }
}

export class GeminiRateLimitError extends Error {
  constructor() {
    super("Gemini rate limit exceeded");
    this.name = "GeminiRateLimitError";
  }
}

export class GeminiApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "GeminiApiError";
    this.status = status;
  }
}

export async function callGemini(systemPrompt: string, userPayload: unknown): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiMissingApiKeyError();

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: JSON.stringify(userPayload) }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.3 },
      }),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw new GeminiTimeoutError();
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 429) throw new GeminiRateLimitError();
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new GeminiApiError(response.status, `Gemini API error ${response.status}: ${body.slice(0, 500)}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new GeminiApiError(502, "Gemini returned no text content");
  }
  return text;
}
