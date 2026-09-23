import { readFileSync } from 'node:fs'

/** Load .env.local into process.env without overriding what's already set. */
export function loadEnv(file = '.env.local') {
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
    }
  } catch {
    /* no .env.local — rely on the ambient environment */
  }
}

/** Read a --name=value flag from argv. */
export const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}
