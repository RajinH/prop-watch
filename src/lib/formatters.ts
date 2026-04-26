export function formatCurrency(value: number): string {
  return `$${Math.abs(value).toLocaleString('en-AU', { maximumFractionDigits: 0 })} AUD`
}

export function formatCurrencyShort(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) {
    return `$${(abs / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  }
  if (abs >= 1_000) {
    return `$${(abs / 1_000).toFixed(0)}k`
  }
  return `$${abs.toFixed(0)}`
}

export function formatCashflow(value: number): string {
  const sign = value >= 0 ? '+' : '-'
  return `${sign}$${Math.abs(value).toLocaleString('en-AU', { maximumFractionDigits: 0 })}/mo`
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

export function formatLVR(lvr: number): string {
  return `${lvr.toFixed(1)}% LVR`
}
