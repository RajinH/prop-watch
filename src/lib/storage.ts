import type { Portfolio, Property, OnboardingDraft, UserAccount } from '@/engine/types'

const PORTFOLIO_KEY = 'propwatch_portfolio'
const DRAFT_KEY = 'propwatch_onboarding_draft'
const USER_KEY = 'propwatch_user'
const DISPLAY_NAME_KEY = 'propwatch_display_name'
const ONBOARDING_COMPLETE_KEY = 'propwatch_onboarding_complete'
const CURRENT_VERSION = 1

function isClient(): boolean {
  return typeof window !== 'undefined'
}

export function loadPortfolio(): Portfolio | null {
  if (!isClient()) return null
  try {
    const raw = localStorage.getItem(PORTFOLIO_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Portfolio
  } catch {
    return null
  }
}

export function savePortfolio(portfolio: Portfolio): void {
  if (!isClient()) return
  try {
    localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(portfolio))
  } catch {
    // storage quota exceeded or private browsing
  }
}

export function addPropertyToPortfolio(property: Property): Portfolio {
  const existing = loadPortfolio()
  const portfolio: Portfolio = existing ?? { properties: [], version: CURRENT_VERSION }
  portfolio.properties.push(property)
  savePortfolio(portfolio)
  return portfolio
}

export function clearPortfolio(): void {
  if (!isClient()) return
  localStorage.removeItem(PORTFOLIO_KEY)
}

export function loadOnboardingDraft(): Partial<OnboardingDraft> | null {
  if (!isClient()) return null
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Partial<OnboardingDraft>
  } catch {
    return null
  }
}

export function saveOnboardingDraft(draft: Partial<OnboardingDraft>): void {
  if (!isClient()) return
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // noop
  }
}

export function clearOnboardingDraft(): void {
  if (!isClient()) return
  localStorage.removeItem(DRAFT_KEY)
}

export function saveUser(email: string): void {
  if (!isClient()) return
  try {
    const account: UserAccount = { email, createdAt: new Date().toISOString() }
    localStorage.setItem(USER_KEY, JSON.stringify(account))
  } catch {
    // noop
  }
}

export function loadUser(): UserAccount | null {
  if (!isClient()) return null
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    return JSON.parse(raw) as UserAccount
  } catch {
    return null
  }
}

export function saveDisplayName(name: string): void {
  if (!isClient()) return
  try {
    localStorage.setItem(DISPLAY_NAME_KEY, name)
  } catch {
    // noop
  }
}

export function loadDisplayName(): string | null {
  if (!isClient()) return null
  return localStorage.getItem(DISPLAY_NAME_KEY)
}

export function saveOnboardingComplete(): void {
  if (!isClient()) return
  try {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true')
  } catch {
    // noop
  }
}

export function hasCompletedOnboarding(): boolean {
  if (!isClient()) return false
  return localStorage.getItem(ONBOARDING_COMPLETE_KEY) === 'true'
}

// ─── HTAG cache ──────────────────────────────────────────────────────────────

const HTAG_ADDRESS_KEY_PREFIX = 'propwatch_htag_address_'
const HTAG_ESTIMATES_PREFIX = 'propwatch_htag_estimates_'
const HTAG_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export interface HtagAddressCache {
  address_key: string
  address_label: string
  cachedAt: string
}

export interface HtagEstimatesCache {
  price_estimate: number | null
  rent_estimate: number | null
  last_sold_price: number | null
  last_sold_date: string | null
  cachedAt: string
}

function normaliseAddress(address: string): string {
  return address.toLowerCase().replace(/\s+/g, ' ').trim()
}

export function loadHtagAddressKey(addressText: string): HtagAddressCache | null {
  if (!isClient()) return null
  try {
    const storageKey = HTAG_ADDRESS_KEY_PREFIX + normaliseAddress(addressText)
    const raw = localStorage.getItem(storageKey)
    if (!raw) return null
    const entry = JSON.parse(raw) as HtagAddressCache
    if (Date.now() - new Date(entry.cachedAt).getTime() > HTAG_TTL_MS) {
      localStorage.removeItem(storageKey)
      return null
    }
    return entry
  } catch {
    return null
  }
}

export function saveHtagAddressKey(
  addressText: string,
  entry: HtagAddressCache
): void {
  if (!isClient()) return
  try {
    localStorage.setItem(
      HTAG_ADDRESS_KEY_PREFIX + normaliseAddress(addressText),
      JSON.stringify(entry)
    )
  } catch {
    // storage quota exceeded or private browsing
  }
}

export function loadHtagEstimates(addressKey: string): HtagEstimatesCache | null {
  if (!isClient()) return null
  try {
    const storageKey = HTAG_ESTIMATES_PREFIX + addressKey
    const raw = localStorage.getItem(storageKey)
    if (!raw) return null
    const entry = JSON.parse(raw) as HtagEstimatesCache
    if (Date.now() - new Date(entry.cachedAt).getTime() > HTAG_TTL_MS) {
      localStorage.removeItem(storageKey)
      return null
    }
    return entry
  } catch {
    return null
  }
}

export function saveHtagEstimates(addressKey: string, entry: HtagEstimatesCache): void {
  if (!isClient()) return
  try {
    localStorage.setItem(HTAG_ESTIMATES_PREFIX + addressKey, JSON.stringify(entry))
  } catch {
    // noop
  }
}
