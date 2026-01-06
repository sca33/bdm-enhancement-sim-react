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
