import { DEFAULT_PRICES, RESTORATION_MARKET_BUNDLE_SIZE, RESTORATION_PER_ATTEMPT } from './config'

/** Market prices configuration */
export interface MarketPrices {
	crystalPrice: number
	restorationBundlePrice: number
	valks10Price: number
	valks50Price: number
	valks100Price: number
}

/** Calculate restoration attempt cost from bundle price */
export function getRestorationAttemptCost(bundlePrice: number): number {
	if (bundlePrice === 0) return 0
	return Math.floor((RESTORATION_PER_ATTEMPT * bundlePrice) / RESTORATION_MARKET_BUNDLE_SIZE)
}

/** Simulation configuration */
export interface SimulationConfig {
	startLevel: number
	targetLevel: number
	restorationFrom: number // 0 = never use
	useHepta: boolean
	useOkta: boolean
	startHepta: number // Starting Hepta progress (0-4)
	startOkta: number // Starting Okta progress (0-9)
	valks10From: number // 0 = never use
	valks50From: number // 0 = never use
	valks100From: number // 0 = never use
	prices: MarketPrices
}

/** Default simulation configuration */
export const DEFAULT_CONFIG: SimulationConfig = {
	startLevel: 0,
	targetLevel: 9,
	restorationFrom: 6,
	useHepta: false,
	useOkta: false,
	startHepta: 0,
	startOkta: 0,
	valks10From: 1,
	valks50From: 3,
	valks100From: 5,
	prices: { ...DEFAULT_PRICES },
}

/** Result of a single enhancement step */
export interface StepResult {
	success: boolean
	anvilTriggered: boolean
	startingLevel: number
	endingLevel: number
	valksUsed: string | null
	restorationAttempted: boolean
	restorationSuccess: boolean
	// For Hepta/Okta
	isHeptaOkta: boolean
	subProgress: number
	subPity: number
	pathComplete: boolean
	pathName: string
}

/**
 * Compact log entry for efficient storage (~32 bytes vs ~170 bytes).
 * Uses short property names to reduce memory and JSON size.
 */
export interface CompactLogEntry {
	/** success */
	s: boolean
	/** anvilTriggered */
	a: boolean
	/** startingLevel */
	sl: number
	/** endingLevel */
	el: number
	/** valksUsed */
	v: string | null
	/** restorationAttempted */
	ra: boolean
	/** restorationSuccess */
	rs: boolean
	/** isHeptaOkta */
	ho: boolean
	/** subProgress */
	sp: number
	/** pathComplete */
	pc: boolean
	/** pathName */
	pn: string
}

/** Convert StepResult to CompactLogEntry */
export function compactifyStep(step: StepResult): CompactLogEntry {
	return {
		s: step.success,
		a: step.anvilTriggered,
		sl: step.startingLevel,
		el: step.endingLevel,
		v: step.valksUsed,
		ra: step.restorationAttempted,
		rs: step.restorationSuccess,
		ho: step.isHeptaOkta,
		sp: step.subProgress,
		pc: step.pathComplete,
		pn: step.pathName,
	}
}

/** Convert CompactLogEntry back to StepResult for display */
export function expandStep(entry: CompactLogEntry): StepResult {
	return {
		success: entry.s,
		anvilTriggered: entry.a,
		startingLevel: entry.sl,
		endingLevel: entry.el,
		valksUsed: entry.v,
		restorationAttempted: entry.ra,
		restorationSuccess: entry.rs,
		isHeptaOkta: entry.ho,
		subProgress: entry.sp,
		subPity: 0, // Not stored in compact format
		pathComplete: entry.pc,
		pathName: entry.pn,
	}
}

/**
 * Statistics snapshot for historical analysis without full logs.
 * Captured periodically (e.g., every 1000 attempts).
 */
export interface StatsSnapshot {
	attemptNumber: number
	timestamp: number
	level: number
	stats: {
		crystals: number
		scrolls: number
		silver: number
		exquisiteCrystals: number
		valks10Used: number
		valks50Used: number
		valks100Used: number
	}
	levelSuccesses: Record<number, number>
	anvilEnergy: Record<number, number>
}

/** Result of a complete simulation run */
export interface SimulationResult {
	crystals: number
	scrolls: number
	silver: number
	exquisiteCrystals: number
	attempts: number
	finalLevel: number
	anvilEnergy: Record<number, number>
	valks10Used: number
	valks50Used: number
	valks100Used: number
	// Step history for UI display
	steps?: StepResult[]
}

/** Monte Carlo statistics */
export interface PercentileStats {
	average: number
	p50: number
	p90: number
	p99: number
	worst: number
}

/** Restoration strategy analysis result */
export interface RestorationStrategyResult {
	restorationFrom: number
	label: string
	p50: { crystals: number; scrolls: number; silver: number }
	p90: { crystals: number; scrolls: number; silver: number }
	worst: { crystals: number; scrolls: number; silver: number }
}

/** Hepta/Okta strategy analysis result */
export interface HeptaOktaStrategyResult {
	useHepta: boolean
	useOkta: boolean
	label: string
	p50: { crystals: number; scrolls: number; silver: number; exquisite: number }
	p90: { crystals: number; scrolls: number; silver: number; exquisite: number }
	worst: { crystals: number; scrolls: number; silver: number; exquisite: number }
}

/** Item type module info */
export interface ModuleInfo {
	id: string
	name: string
	description: string
	implemented: boolean
}

/** Available item type modules */
export const MODULES: ModuleInfo[] = [
	{
		id: 'awakening',
		name: 'Awakening (Armor/Weapons)',
		description: 'Simulate awakening enhancement from +0 to +X with restoration scrolls and Valks',
		implemented: true,
	},
	{
		id: 'accessories',
		name: 'Accessories',
		description: 'Rings, necklaces, earrings, belts enhancement',
		implemented: false,
	},
	{
		id: 'relics',
		name: 'Relics',
		description: 'Relic enhancement simulation',
		implemented: false,
	},
	{
		id: 'totems',
		name: 'Totems',
		description: 'Totem enhancement simulation',
		implemented: false,
	},
	{
		id: 'runes',
		name: 'Runes',
		description: 'Rune enhancement simulation',
		implemented: false,
	},
]
