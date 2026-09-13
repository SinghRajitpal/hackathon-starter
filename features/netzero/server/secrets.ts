import "server-only";

import { createKeyCache } from "@/features/netzero/explain/key-cache";

import { createAdminClient } from "./supabase-admin";

const VAULT_SECRET_NAME = "gemini_api_key";

async function readFromVault(): Promise<string | null> {
  try {
    const admin = createAdminClient();
    if (!admin) throw new Error("no service-role client");
    const { data, error } = await admin.rpc("get_secret", { secret_name: VAULT_SECRET_NAME });
    if (error || typeof data !== "string" || data.length === 0) throw new Error("secret not returned");
    return data;
  } catch {
    // Never log the error object: keep anything key-related out of logs.
    console.error("gemini key unavailable");
    return null;
  }
}

const vaultKey = createKeyCache(readFromVault);

/**
 * The Gemini API key from Supabase Vault, reused for an hour. GEMINI_EXPLAIN_API_KEY overrides it for local
 * development. (GEMINI_API_KEY in .env.local is the data pipeline's older key, so it is deliberately not used.)
 * Returns null instead of throwing.
 */
export async function getGeminiApiKey(): Promise<string | null> {
  const override = process.env.GEMINI_EXPLAIN_API_KEY;
  if (override) return override;
  return vaultKey.get();
}

/** Forget the cached key after Gemini rejects it, so a key rotated in Vault is picked up on the next request. */
export function invalidateGeminiApiKey(): void {
  vaultKey.invalidate();
}
