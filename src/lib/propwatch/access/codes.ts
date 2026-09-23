import { createHmac, randomBytes } from 'node:crypto'

/**
 * Access code generation, normalisation and hashing.
 *
 * Server-only: `hashAccessCode` reads ACCESS_CODE_PEPPER. Never import this
 * from a client component.
 *
 * Codes are stored as HMAC-SHA256(normalised code, pepper) rather than a
 * password hash, because redemption needs lookup-by-hash and a per-row salt
 * makes that impossible. The compensation is entropy: 13 Crockford base32
 * characters is 65 bits, which is strong enough on its own — the pepper is
 * belt-and-braces against a database leak, not the primary defence.
 */

/**
 * Crockford base32: no I, L, O or U. The first three are visually ambiguous
 * (mapped on input below); U is excluded so codes can't spell obscenities.
 * 32 divides 256 evenly, so `byte % 32` is uniform with no modulo bias.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const CODE_LENGTH = 13

/** Ambiguous characters a user might type, mapped to their intended digit. */
const CONFUSABLES: Record<string, string> = { I: '1', L: '1', O: '0' }

/**
 * Canonical form for hashing: what the user typed, with formatting and
 * predictable misreadings removed. Must be applied identically at mint time and
 * at redemption time, or codes will never match.
 */
export function normaliseCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .split('')
    .map((c) => CONFUSABLES[c] ?? c)
    .join('')
}

/** Human-readable grouping, e.g. `K7PQ-3M9X-RT2VW`. Purely cosmetic. */
export function formatCode(code: string): string {
  const c = normaliseCode(code)
  return [c.slice(0, 4), c.slice(4, 8), c.slice(8, 13)].filter(Boolean).join('-')
}

/** Mint a new code. Returns the formatted form — the only time it exists in plaintext. */
export function generateAccessCode(): string {
  const bytes = randomBytes(CODE_LENGTH)
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length]
  }
  return formatCode(code)
}

/** HMAC of the normalised code, as hex — the form `redeem_access_code` expects. */
export function hashAccessCode(code: string, pepper = process.env.ACCESS_CODE_PEPPER): string {
  if (!pepper) {
    throw new Error('ACCESS_CODE_PEPPER is not set; refusing to hash an access code')
  }
  return createHmac('sha256', pepper).update(normaliseCode(code)).digest('hex')
}

/** Cheap client-safe shape check, so obvious typos never reach the database. */
export function isPlausibleCode(input: string): boolean {
  const c = normaliseCode(input)
  return c.length === CODE_LENGTH && [...c].every((ch) => ALPHABET.includes(ch))
}
