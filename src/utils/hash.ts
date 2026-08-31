import crypto from 'crypto';

/**
 * Deterministic hash of request payload for idempotency key reuse check.
 * Uses canonical JSON (sorted keys) + sha256. Returns hex.
 * Excludes idempotency header itself; caller passes normalized body.
 */
export function hashRequest(payload: unknown): string {
  const canonical = stableStringify(payload);
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}
