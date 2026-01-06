/**
 * Awakening enhancement configuration and probability tables.
 *
 * Data sourced from:
 * - Official BDM Korea patch notes (Dec 30, 2025)
 * - Community research and player estimates
 */

/** Awakening enhancement success rates (I-X) */
export const ENHANCEMENT_RATES: Record<number, number> = {
	1: 0.7, // I - 70%
	2: 0.6, // II - 60%
	3: 0.4, // III - 40%
	4: 0.2, // IV - 20%
	5: 0.1, // V - 10%
	6: 0.07, // VI - 7%
	7: 0.05, // VII - 5%
	8: 0.03, // VIII - 3%
	9: 0.01, // IX - 1%
	10: 0.005, // X - 0.5%
}

/**
 * Ancient Anvil (고대의 모루) maximum energy thresholds.
 * When energy reaches this value, next enhancement is guaranteed success.
 */
export const ANVIL_THRESHOLDS: Record<number, number> = {
	1: 0, // I - no pity
	2: 0, // II - no pity
	3: 2, // III - guaranteed after 2 failures
	4: 3, // IV - guaranteed after 3 failures
	5: 5, // V - guaranteed after 5 failures
	6: 8, // VI - guaranteed after 8 failures
	7: 10, // VII - guaranteed after 10 failures
	8: 17, // VIII - guaranteed after 17 failures
	9: 50, // IX - guaranteed after 50 failures
	10: 100, // X - guaranteed after 100 failures
}

/** Material costs per awakening enhancement attempt */
export const MATERIAL_COSTS: Record<number, number> = {
	1: 1,
	2: 1,
	3: 1,
	4: 1,
	5: 1,
	6: 1,
	7: 1,
	8: 1,
	9: 1,
	10: 1,
}

/** Restoration scroll costs per awakening level */
export const RESTORATION_SCROLL_COSTS: Record<number, number> = {
	1: 200,
	2: 200,
	3: 200,
	4: 200,
	5: 200,
	6: 200,
	7: 200,
	8: 200,
	9: 200,
	10: 200,
}

/** Restoration scroll success rate (50% chance to prevent downgrade) */
export const RESTORATION_SUCCESS_RATE = 0.5

/** Hepta/Okta sub-enhancement success rate (6% per attempt) */
export const HEPTA_OKTA_SUCCESS_RATE = 0.06

/** Advice of Valks bonuses (MULTIPLICATIVE, not additive) */
export const VALKS_MULTIPLIERS = {
	10: 1.1, // +10% = x1.1
	50: 1.5, // +50% = x1.5
	100: 2.0, // +100% = x2.0
} as const

/** Arkram's Prophecy bonus (+10% flat) */
export const ARKRAM_PROPHECY_BONUS = 0.1

/** Level display names */
export const ROMAN_NUMERALS: Record<number, string> = {
	0: '0',
	1: 'I',
	2: 'II',
	3: 'III',
	4: 'IV',
	5: 'V',
	6: 'VI',
	7: 'VII',
	8: 'VIII',
	9: 'IX',
	10: 'X',
}

/** Default market prices in silver */
export const DEFAULT_PRICES: Record<string, number> = {
	pristine_black_crystal: 50_000_000, // 50M
	restoration_scroll: 100_000, // 100K per scroll (200 scrolls = 20M)
	valks_advice_10: 10_000_000, // 10M
	valks_advice_50: 50_000_000, // 50M
	valks_advice_100: 100_000_000, // 100M
}
