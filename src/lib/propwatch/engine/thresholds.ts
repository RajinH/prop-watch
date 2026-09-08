// Shared market-heuristic thresholds used by both the insights rules
// (generateInsights.ts) and the decision engine (lib/propwatch/decision/).
// Keeping them in one place prevents the two layers drifting apart.

/** Interest rate above which a loan is flagged as above-market (AU heuristic). */
export const RATE_FLAG_THRESHOLD = 0.07

/** Days ahead within which an approaching fixed-rate expiry is actionable. */
export const FIXED_EXPIRY_WINDOW_DAYS = 90

/** Weighted LVR at or above which leverage is considered high. */
export const HIGH_LVR_THRESHOLD = 0.8

/** Gross yield below which the portfolio is considered low-yielding. */
export const TARGET_GROSS_YIELD = 0.035
