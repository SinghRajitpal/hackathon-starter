import "server-only";

import { ApiError, GoogleGenAI, ThinkingLevel, type Schema } from "@google/genai";

import { GenerateError, type GenerateFn } from "@/features/netzero/explain/gemini";

export const GEMINI_TIMEOUT_MS = 20_000;

/**
 * The real Gemini call: closed packet in, JSON text out. No tools, no grounding, no URL context, no
 * files. gemini-3.6-flash rejects thinkingBudget 0, so thinking is set to its minimal level instead.
 * The SDK's own retries are off; explain() owns the single retry.
 */
export function googleGenerate(apiKey: string, options: { onAuthError?: () => void } = {}): GenerateFn {
  const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: GEMINI_TIMEOUT_MS, retryOptions: { attempts: 1 } } });

  return async (request) => {
    try {
      const response = await ai.models.generateContent({
        model: request.model,
        contents: [{ role: "user", parts: [{ text: request.userMessage }] }],
        config: {
          systemInstruction: request.systemInstruction,
          temperature: 0,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          responseMimeType: "application/json",
          responseSchema: request.responseSchema as Schema,
        },
      });
      return response.text ?? "";
    } catch (e) {
      if (e instanceof ApiError) {
        // Gemini answers an invalid key with 400 "API key not valid"; revoked or unauthorised keys with 401/403.
        if (e.status === 401 || e.status === 403 || (e.status === 400 && /api key/i.test(e.message))) options.onAuthError?.();
        throw new GenerateError(e.status);
      }
      if (e instanceof Error && (e.name === "AbortError" || /time(d)?\s?out|abort/i.test(e.message))) throw new GenerateError("timeout");
      throw new GenerateError("network");
    }
  };
}
