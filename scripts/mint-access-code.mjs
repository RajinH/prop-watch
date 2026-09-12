#!/usr/bin/env node
/**
 * Mint access codes.
 *
 *   node scripts/mint-access-code.mjs --label="beta cohort 1" --days=90 --uses=25
 *   node scripts/mint-access-code.mjs --label="founder" --days=forever --count=5
 *
 * Prints each code once — they are stored only as an HMAC, so a lost code
 * cannot be recovered, only revoked and reissued.
 *
 * Inserts directly when SUPABASE_SECRET_KEY is set; otherwise prints the SQL so
 * you can run it against whichever database you meant.
 */
import { readFileSync } from 'node:fs'
import { createHmac, randomBytes } from 'node:crypto'

// Mirrors src/lib/propwatch/access/codes.ts. Kept in sync by hand: this script
// is not bundled, so it can't import from src/ without a build step.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const CODE_LENGTH = 13

function loadEnv(file = '.env.local') {
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
    }
  } catch {
    /* no .env.local — rely on the ambient environment */
  }
}

function generate() {
  const bytes = randomBytes(CODE_LENGTH)
  let c = ''
  for (let i = 0; i < CODE_LENGTH; i++) c += ALPHABET[bytes[i] % ALPHABET.length]
  return [c.slice(0, 4), c.slice(4, 8), c.slice(8, 13)].join('-')
}

const normalise = (s) =>
  s.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/[IL]/g, '1').replace(/O/g, '0')

const hash = (code, pepper) =>
  createHmac('sha256', pepper).update(normalise(code)).digest('hex')

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

loadEnv()

const pepper = process.env.ACCESS_CODE_PEPPER
if (!pepper) {
  console.error('ACCESS_CODE_PEPPER is not set. Add it to .env.local first.')
  process.exit(1)
}

const label = arg('label')
if (!label) {
  console.error('Usage: --label="beta cohort 1" [--days=90|forever] [--uses=1] [--count=1] [--expires=2026-12-31]')
  process.exit(1)
}

const daysArg = arg('days', 'forever')
const grantDays = daysArg === 'forever' ? null : Number(daysArg)
const uses = Number(arg('uses', '1'))
const count = Number(arg('count', '1'))
const expires = arg('expires', null)

if (grantDays !== null && (!Number.isInteger(grantDays) || grantDays <= 0)) {
  console.error(`--days must be a positive integer or "forever", got: ${daysArg}`)
  process.exit(1)
}
if (!Number.isInteger(uses) || uses <= 0) {
  console.error(`--uses must be a positive integer, got: ${uses}`)
  process.exit(1)
}

const minted = Array.from({ length: count }, () => {
  const code = generate()
  return { code, code_hash: hash(code, pepper), label, grant_days: grantDays, uses_remaining: uses, expires_at: expires }
})

console.log(`\nMinted ${count} code(s) — "${label}"`)
console.log(`  grants: ${grantDays === null ? 'forever' : `${grantDays} days`}`)
console.log(`  uses each: ${uses}${expires ? `, expires ${expires}` : ''}`)
console.log('\n  ' + minted.map((m) => m.code).join('\n  ') + '\n')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY

if (url && secret) {
  const { createClient } = await import('@supabase/supabase-js')
  const db = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { error } = await db.from('access_codes').insert(
    minted.map(({ code, ...row }) => ({ ...row, code_hash: `\\x${row.code_hash}` }))
  )
  if (error) {
    console.error('Insert failed:', error.message)
    process.exit(1)
  }
  console.log(`Inserted into ${new URL(url).host}. Store the codes above now — they cannot be recovered.\n`)
} else {
  console.log('SUPABASE_SECRET_KEY not set, so nothing was inserted. Run this SQL yourself:\n')
  for (const m of minted) {
    console.log(
      `insert into public.access_codes (code_hash, label, grant_days, uses_remaining, expires_at) values ` +
        `(decode('${m.code_hash}','hex'), '${label.replace(/'/g, "''")}', ${grantDays ?? 'null'}, ${uses}, ${expires ? `'${expires}'` : 'null'});`
    )
  }
  console.log('')
}
