// Core simulator
export { AwakeningEngine } from './simulator'

// Types
export type {
	HeptaOktaStrategyResult,
	MarketPrices,
	ModuleInfo,
	PercentileStats,
	RestorationStrategyResult,
	SimulationConfig,
	SimulationResult,
	StepResult,
} from './types'

// Type utilities
export { DEFAULT_CONFIG, getRestorationAttemptCost, MODULES } from './types'

// Configuration
export {
	ANVIL_THRESHOLDS,
	DEFAULT_PRICES,
	ENHANCEMENT_RATES,
	EXQUISITE_BLACK_CRYSTAL_RECIPE,
	HEPTA_OKTA_ANVIL_PITY,
	HEPTA_OKTA_CRYSTALS_PER_ATTEMPT,
	HEPTA_OKTA_SUCCESS_RATE,
	HEPTA_SUB_ENHANCEMENTS,
	OKTA_SUB_ENHANCEMENTS,
	RATE_CACHE,
	RATE_CACHE_VALKS_10,
	RATE_CACHE_VALKS_100,
	RATE_CACHE_VALKS_50,
	RESTORATION_MARKET_BUNDLE_SIZE,
	RESTORATION_PER_ATTEMPT,
	RESTORATION_SUCCESS_RATE,
	ROMAN_NUMERALS,
	VALKS_MULTIPLIER_10,
	VALKS_MULTIPLIER_100,
	VALKS_MULTIPLIER_50,
} from './config'
