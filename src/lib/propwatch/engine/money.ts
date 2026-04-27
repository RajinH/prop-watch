export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function safeDiv(numerator: number, denominator: number): number | null {
  return denominator !== 0 ? numerator / denominator : null
}

export function formatMoney(n: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(n)
}
