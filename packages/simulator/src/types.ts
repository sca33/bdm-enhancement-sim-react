/** When to use restoration scrolls */
export type RestorationStrategy = 'never' | 'always' | 'above_threshold' | 'cost_efficient'

/** When to use Advice of Valks */
export type ValksStrategy = 'never' | 'small_only' | 'large_only' | 'large_high' | 'optimal'

/** Valks type identifier */
export type ValksType = 'small' | 'large' | '100' | null

/** Configuration for auto-enhancement behavior */
export interface EnhancementStrategy {
	restoration: RestorationStrategy
	restorationThreshold: number // Only use restoration above this level
	valks: ValksStrategy
	valksLargeThreshold: number // Use large valks starting at this level
	useProtection: boolean // Use W/Ogier blessing
}

/** Result of a single enhancement attempt */
export interface AttemptResult {
	success: boolean
	startingLevel: number
	endingLevel: number
	anvilTriggered: boolean
	restorationAttempted: boolean
	restorationSuccess: boolean
	valksUsed: ValksType
	materialsCost: Record<string, number>
}

/** Result of a full simulation run (0 -> target) */
export interface SimulationResult {
	targetLevel: number
	totalAttempts: number
	successes: number
	failures: number
	anvilTriggers: number
	restorationAttempts: number
	restorationSuccesses: number
	levelDrops: number
	materialsUsed: Record<string, number>
	silverCost: number
	attemptHistory: AttemptResult[]
}

/** Tracks current state of gear being enhanced */
export interface GearState {
	awakeningLevel: number
	anvilEnergy: Record<number, number>
}

/** Statistics from Monte Carlo simulation */
export interface PercentileStats {
	average: number
	p50: number
	p90: number
	p99: number
	worst: number
}

/** Monte Carlo simulation results */
export interface MonteCarloResult {
	numSimulations: number
	targetLevel: number
	strategy: {
		restoration: RestorationStrategy
		valks: ValksStrategy
	}
	attempts: PercentileStats
	silverCost: PercentileStats
	pristineBlackCrystals: PercentileStats
	restorationScrolls: PercentileStats
	levelDrops: PercentileStats
	anvilTriggers: Omit<PercentileStats, 'worst'>
}

/** Market prices configuration */
export interface MarketPrices {
	pristineBlackCrystal: number
	restorationScroll: number
	valksAdvice10: number
	valksAdvice50: number
	valksAdvice100: number
}

/** Default enhancement strategy */
export const DEFAULT_STRATEGY: EnhancementStrategy = {
	restoration: 'always',
	restorationThreshold: 3,
	valks: 'never',
	valksLargeThreshold: 6,
	useProtection: false,
}

/** Create a fresh gear state */
export function createGearState(level = 0): GearState {
	return {
		awakeningLevel: level,
		anvilEnergy: {},
	}
}

/** Clone a gear state */
export function cloneGearState(state: GearState): GearState {
	return {
		awakeningLevel: state.awakeningLevel,
		anvilEnergy: { ...state.anvilEnergy },
	}
}
