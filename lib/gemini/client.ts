import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

// Free-tier Gemini model as of this writing (Sept 2026) -- Google retires
// these periodically (gemini-2.5-flash was already retired for new users
// when this was written). If generateWithGemini starts 404ing, check
// https://ai.google.dev/gemini-api/docs/models for the current free model.
const GEMINI_MODEL = "gemini-3.6-flash";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

let cachedApiKey: string | null = null;

async function getApiKey(): Promise<string> {
  if (cachedApiKey) return cachedApiKey;

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("get_gemini_api_key");
  if (error || !data) {
    throw new Error(`Failed to load Gemini API key from Supabase: ${error?.message ?? "no key stored"}`);
  }
  cachedApiKey = data as string;
  return cachedApiKey;
}

/**
 * Sends a single prompt to Gemini and returns the generated text.
 * Server-only (imports the service-role Supabase client) -- call this from
 * a server action or route handler, never from a Client Component.
 *
 * Example:
 *   const report = await generateWithGemini(
 *     `Given this company's data: ${JSON.stringify(companyData)}, write a 3-paragraph sustainability assessment.`
 *   );
 */
export async function generateWithGemini(prompt: string): Promise<string> {
  const apiKey = await getApiKey();

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorBody}`);
  }

  const result = await response.json();
  const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") {
    throw new Error(`Unexpected Gemini response shape: ${JSON.stringify(result)}`);
  }
  return text;
}
