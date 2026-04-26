import type { Portfolio, Property, OnboardingDraft, UserAccount } from '@/engine/types'

const PORTFOLIO_KEY = 'propwatch_portfolio'
const DRAFT_KEY = 'propwatch_onboarding_draft'
const USER_KEY = 'propwatch_user'
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
