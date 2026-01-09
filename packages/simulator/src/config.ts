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

/** Restoration scroll success rate (50% chance to prevent downgrade) */
export const RESTORATION_SUCCESS_RATE = 0.5

/** Restoration scrolls per attempt */
export const RESTORATION_PER_ATTEMPT = 200

/** Restoration market bundle size (200K scrolls per bundle) */
export const RESTORATION_MARKET_BUNDLE_SIZE = 200_000

/** Hepta/Okta sub-enhancement success rate (6% per attempt) */
export const HEPTA_OKTA_SUCCESS_RATE = 0.06

/** Hepta sub-enhancements needed for VII→VIII */
export const HEPTA_SUB_ENHANCEMENTS = 5

/** Okta sub-enhancements needed for VIII→IX */
export const OKTA_SUB_ENHANCEMENTS = 10

/** Hepta/Okta anvil pity (17 failures = guaranteed success) */
export const HEPTA_OKTA_ANVIL_PITY = 17

/** Exquisite Black Crystals per Hepta/Okta attempt */
export const HEPTA_OKTA_CRYSTALS_PER_ATTEMPT = 15

/** Exquisite Black Crystal crafting recipe */
export const EXQUISITE_BLACK_CRYSTAL_RECIPE = {
	restorationScrolls: 1050,
	valks100: 2,
	pristineBlackCrystal: 30,
}

/** Valks multipliers (multiplicative, not additive) */
export const VALKS_MULTIPLIER_10 = 1.1 // +10% = x1.1
export const VALKS_MULTIPLIER_50 = 1.5 // +50% = x1.5
export const VALKS_MULTIPLIER_100 = 2.0 // +100% = x2.0

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
export const DEFAULT_PRICES = {
	crystalPrice: 34_650_000, // 34.65M per pristine black crystal
	restorationBundlePrice: 1_000_000_000_000, // 1T for 200K scrolls
	valks10Price: 0, // Not on market
	valks50Price: 0, // Not on market
	valks100Price: 0, // Not on market
}

/** Pre-computed rate caches for performance */
export const RATE_CACHE = Object.fromEntries(
	Object.entries(ENHANCEMENT_RATES).map(([level, rate]) => [Number(level), rate]),
)

// Single Valks buffs
export const RATE_CACHE_VALKS_10 = Object.fromEntries(
	Object.entries(ENHANCEMENT_RATES).map(([level, rate]) => [
		Number(level),
		Math.min(1.0, rate * VALKS_MULTIPLIER_10),
	]),
)

export const RATE_CACHE_VALKS_50 = Object.fromEntries(
	Object.entries(ENHANCEMENT_RATES).map(([level, rate]) => [
		Number(level),
		Math.min(1.0, rate * VALKS_MULTIPLIER_50),
	]),
)

export const RATE_CACHE_VALKS_100 = Object.fromEntries(
	Object.entries(ENHANCEMENT_RATES).map(([level, rate]) => [
		Number(level),
		Math.min(1.0, rate * VALKS_MULTIPLIER_100),
	]),
)

// Stacked Valks buffs (multiplicative stacking)
export const RATE_CACHE_VALKS_10_50 = Object.fromEntries(
	Object.entries(ENHANCEMENT_RATES).map(([level, rate]) => [
		Number(level),
		Math.min(1.0, rate * VALKS_MULTIPLIER_10 * VALKS_MULTIPLIER_50),
	]),
)

export const RATE_CACHE_VALKS_10_100 = Object.fromEntries(
	Object.entries(ENHANCEMENT_RATES).map(([level, rate]) => [
		Number(level),
		Math.min(1.0, rate * VALKS_MULTIPLIER_10 * VALKS_MULTIPLIER_100),
	]),
)

export const RATE_CACHE_VALKS_50_100 = Object.fromEntries(
	Object.entries(ENHANCEMENT_RATES).map(([level, rate]) => [
		Number(level),
		Math.min(1.0, rate * VALKS_MULTIPLIER_50 * VALKS_MULTIPLIER_100),
	]),
)

export const RATE_CACHE_VALKS_ALL = Object.fromEntries(
	Object.entries(ENHANCEMENT_RATES).map(([level, rate]) => [
		Number(level),
		Math.min(1.0, rate * VALKS_MULTIPLIER_10 * VALKS_MULTIPLIER_50 * VALKS_MULTIPLIER_100),
	]),
)

/** UI and simulation runner constants */
export const UI_CONSTANTS = {
	/** Ring buffer size for step history */
	STEP_BUFFER_SIZE: 1000,
	/** Maximum saved simulation runs */
	MAX_SAVED_RUNS: 50,
	/** Number of steps to process per chunk in instant mode */
	INSTANT_CHUNK_SIZE: 1000,
	/** Progress reporting interval (every N simulations) */
	PROGRESS_REPORT_INTERVAL: 500,
	/** Average enhancement animation time in seconds (for time estimation) */
	AVG_ANIMATION_TIME: 0.75,
}
