export interface KeyCacheOptions {
  /** How long a resolved key is reused before it is read again. */
  ttlMs: number;
  /** How long a failed read is remembered before trying again. */
  failureTtlMs: number;
  now: () => number;
}

const DEFAULTS: KeyCacheOptions = { ttlMs: 60 * 60_000, failureTtlMs: 60_000, now: Date.now };

/**
 * Reuses a secret read (e.g. from Supabase Vault) for a while, shares one read between concurrent callers,
 * remembers a failed read briefly, and can be invalidated when the provider rejects the key.
 * `read` must not throw; it returns null when the key cannot be resolved.
 */
export function createKeyCache(read: () => Promise<string | null>, options: Partial<KeyCacheOptions> = {}) {
  const { ttlMs, failureTtlMs, now } = { ...DEFAULTS, ...options };
  let value: string | null = null;
  let expires = 0;
  let pending: Promise<string | null> | null = null;

  return {
    get(): Promise<string | null> {
      if (now() < expires) return Promise.resolve(value);
      pending ??= read()
        .then((v) => {
          value = v;
          expires = now() + (v ? ttlMs : failureTtlMs);
          return v;
        })
        .finally(() => {
          pending = null;
        });
      return pending;
    },
    invalidate(): void {
      value = null;
      expires = 0;
    },
  };
}
