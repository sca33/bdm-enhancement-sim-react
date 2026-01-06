// Core simulator
export { AwakeningSimulator } from './simulator'

// Types
export type {
	AttemptResult,
	EnhancementStrategy,
	GearState,
	MarketPrices,
	MonteCarloResult,
	PercentileStats,
	RestorationStrategy,
	SimulationResult,
	ValksStrategy,
	ValksType,
} from './types'

// Type utilities
export { cloneGearState, createGearState, DEFAULT_STRATEGY } from './types'

// Configuration
export {
	ANVIL_THRESHOLDS,
	DEFAULT_PRICES,
	ENHANCEMENT_RATES,
	HEPTA_OKTA_SUCCESS_RATE,
	MATERIAL_COSTS,
	RESTORATION_SCROLL_COSTS,
	RESTORATION_SUCCESS_RATE,
	ROMAN_NUMERALS,
	VALKS_MULTIPLIERS,
} from './config'
