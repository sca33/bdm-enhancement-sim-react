/**
 * Awakening enhancement simulation engine.
 *
 * Full port of the Python implementation with:
 * - Normal enhancement with anvil pity
 * - Hepta/Okta sub-enhancement paths
 * - Restoration scrolls
 * - Valks bonuses
 * - Resource tracking
 */

import {
	ANVIL_THRESHOLDS,
	EXQUISITE_BLACK_CRYSTAL_RECIPE,
	HEPTA_OKTA_ANVIL_PITY,
	HEPTA_OKTA_CRYSTALS_PER_ATTEMPT,
	HEPTA_OKTA_SUCCESS_RATE,
	HEPTA_SUB_ENHANCEMENTS,
	OKTA_SUB_ENHANCEMENTS,
	RATE_CACHE,
	RATE_CACHE_VALKS_10,
	RATE_CACHE_VALKS_50,
	RATE_CACHE_VALKS_100,
	RESTORATION_MARKET_BUNDLE_SIZE,
	RESTORATION_PER_ATTEMPT,
	RESTORATION_SUCCESS_RATE,
} from './config'
import type { SimulationConfig, SimulationResult, StepResult } from './types'
import { getRestorationAttemptCost } from './types'

/** Seeded random number generator (Mulberry32) */
function createRng(seed?: number) {
	if (seed === undefined) {
		return Math.random
	}
	let state = seed
	return () => {
		state |= 0
		state = (state + 0x6d2b79f5) | 0
		let t = Math.imul(state ^ (state >>> 15), 1 | state)
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

export class AwakeningEngine {
	private config: SimulationConfig
	private rng: () => number

	// State
	private level = 0
	private anvilEnergy: Record<number, number> = {}
	private crystals = 0
	private scrolls = 0
	private silver = 0
	private exquisiteCrystals = 0
	private valks10Used = 0
	private valks50Used = 0
	private valks100Used = 0
	private attempts = 0
	private heptaProgress = 0
	private oktaProgress = 0
	private heptaPity = 0
	private oktaPity = 0

	// Cached config values for performance
	private readonly targetLevel: number
	private readonly restorationFrom: number
	private readonly useHepta: boolean
	private readonly useOkta: boolean
	private readonly valks10From: number
	private readonly valks50From: number
	private readonly valks100From: number
	private readonly crystalPrice: number
	private readonly valks10Price: number
	private readonly valks50Price: number
	private readonly valks100Price: number
	private readonly restorationAttemptCost: number
	private readonly exquisiteCost: number

	constructor(config: SimulationConfig, seed?: number) {
		this.config = config
		this.rng = createRng(seed)

		// Cache config values
		this.targetLevel = config.targetLevel
		this.restorationFrom = config.restorationFrom
		this.useHepta = config.useHepta
		this.useOkta = config.useOkta
		this.valks10From = config.valks10From
		this.valks50From = config.valks50From
		this.valks100From = config.valks100From

		// Cache prices
		const prices = config.prices
		this.crystalPrice = prices.crystalPrice
		this.valks10Price = prices.valks10Price
		this.valks50Price = prices.valks50Price
		this.valks100Price = prices.valks100Price
		this.restorationAttemptCost = getRestorationAttemptCost(prices.restorationBundlePrice)

		// Pre-compute exquisite crystal cost
		this.exquisiteCost =
			Math.floor(
				(EXQUISITE_BLACK_CRYSTAL_RECIPE.restorationScrolls * prices.restorationBundlePrice) /
					RESTORATION_MARKET_BUNDLE_SIZE,
			) +
			EXQUISITE_BLACK_CRYSTAL_RECIPE.valks100 * prices.valks100Price +
			EXQUISITE_BLACK_CRYSTAL_RECIPE.pristineBlackCrystal * prices.crystalPrice

		this.reset()
	}

	reset(): void {
		this.level = this.config.startLevel
		this.anvilEnergy = {}
		this.crystals = 0
		this.scrolls = 0
		this.silver = 0
		this.exquisiteCrystals = 0
		this.valks10Used = 0
		this.valks50Used = 0
		this.valks100Used = 0
		this.attempts = 0
		this.heptaProgress = this.config.startHepta
		this.oktaProgress = this.config.startOkta
		this.heptaPity = 0
		this.oktaPity = 0
	}

	isComplete(): boolean {
		return this.level >= this.targetLevel
	}

	getLevel(): number {
		return this.level
	}

	getAnvilEnergy(): Record<number, number> {
		return { ...this.anvilEnergy }
	}

	getHeptaProgress(): number {
		return this.heptaProgress
	}

	getOktaProgress(): number {
		return this.oktaProgress
	}

	getHeptaPity(): number {
		return this.heptaPity
	}

	getOktaPity(): number {
		return this.oktaPity
	}

	getStats(): {
		crystals: number
		scrolls: number
		silver: number
		exquisiteCrystals: number
		valks10Used: number
		valks50Used: number
		valks100Used: number
		attempts: number
	} {
		return {
			crystals: this.crystals,
			scrolls: this.scrolls,
			silver: this.silver,
			exquisiteCrystals: this.exquisiteCrystals,
			valks10Used: this.valks10Used,
			valks50Used: this.valks50Used,
			valks100Used: this.valks100Used,
			attempts: this.attempts,
		}
	}

	private shouldUseHepta(): boolean {
		return (
			(this.useHepta || this.heptaProgress > 0) &&
			this.level === 7 &&
			this.heptaProgress < HEPTA_SUB_ENHANCEMENTS
		)
	}

	private shouldUseOkta(): boolean {
		return (
			(this.useOkta || this.oktaProgress > 0) &&
			this.level === 8 &&
			this.oktaProgress < OKTA_SUB_ENHANCEMENTS
		)
	}

	/** Perform a single enhancement step */
	step(): StepResult {
		if (this.isComplete()) {
			throw new Error('Simulation already complete')
		}

		if (this.shouldUseHepta()) {
			return this.performHeptaOktaStep(false)
		}
		if (this.shouldUseOkta()) {
			return this.performHeptaOktaStep(true)
		}

		return this.performEnhancementStep()
	}

	private performHeptaOktaStep(isOkta: boolean): StepResult {
		const pathName = isOkta ? 'Okta' : 'Hepta'
		const currentProgress = isOkta ? this.oktaProgress : this.heptaProgress
		const currentPity = isOkta ? this.oktaPity : this.heptaPity
		const maxProgress = isOkta ? OKTA_SUB_ENHANCEMENTS : HEPTA_SUB_ENHANCEMENTS

		// Cost tracking
		this.exquisiteCrystals += HEPTA_OKTA_CRYSTALS_PER_ATTEMPT
		this.silver += this.exquisiteCost * HEPTA_OKTA_CRYSTALS_PER_ATTEMPT
		this.attempts++

		// Check anvil pity
		const anvilTriggered = currentPity >= HEPTA_OKTA_ANVIL_PITY

		if (anvilTriggered || this.rng() < HEPTA_OKTA_SUCCESS_RATE) {
			// Success
			if (isOkta) {
				this.oktaProgress++
				this.oktaPity = 0
			} else {
				this.heptaProgress++
				this.heptaPity = 0
			}

			const newProgress = isOkta ? this.oktaProgress : this.heptaProgress
			const pathComplete = newProgress >= maxProgress

			if (pathComplete) {
				const targetLvl = isOkta ? 9 : 8
				this.level = targetLvl
				this.anvilEnergy[targetLvl] = 0
				if (isOkta) {
					this.oktaProgress = 0
					this.oktaPity = 0
				} else {
					this.heptaProgress = 0
					this.heptaPity = 0
				}
			}

			return {
				success: true,
				anvilTriggered,
				startingLevel: pathComplete ? (isOkta ? 8 : 7) : this.level,
				endingLevel: this.level,
				valksUsed: null,
				restorationAttempted: false,
				restorationSuccess: false,
				isHeptaOkta: true,
				subProgress: pathComplete ? 0 : newProgress,
				subPity: 0,
				pathComplete,
				pathName,
			}
		}

		// Failure - increment pity
		if (isOkta) {
			this.oktaPity++
		} else {
			this.heptaPity++
		}

		return {
			success: false,
			anvilTriggered: false,
			startingLevel: this.level,
			endingLevel: this.level,
			valksUsed: null,
			restorationAttempted: false,
			restorationSuccess: false,
			isHeptaOkta: true,
			subProgress: currentProgress,
			subPity: isOkta ? this.oktaPity : this.heptaPity,
			pathComplete: false,
			pathName,
		}
	}

	private performEnhancementStep(): StepResult {
		const startingLevel = this.level
		const nextLevel = this.level + 1

		// Determine valks and get rate
		let valksType: string | null = null
		let baseRate: number

		if (this.valks100From > 0 && nextLevel >= this.valks100From) {
			valksType = '100'
			baseRate = RATE_CACHE_VALKS_100[nextLevel] ?? 0.01
		} else if (this.valks50From > 0 && nextLevel >= this.valks50From) {
			valksType = '50'
			baseRate = RATE_CACHE_VALKS_50[nextLevel] ?? 0.01
		} else if (this.valks10From > 0 && nextLevel >= this.valks10From) {
			valksType = '10'
			baseRate = RATE_CACHE_VALKS_10[nextLevel] ?? 0.01
		} else {
			baseRate = RATE_CACHE[nextLevel] ?? 0.01
		}

		// Check anvil pity
		const currentEnergy = this.anvilEnergy[nextLevel] ?? 0
		const maxEnergy = ANVIL_THRESHOLDS[nextLevel] ?? 999
		const anvilTriggered = currentEnergy >= maxEnergy && maxEnergy > 0

		// Resource tracking
		this.attempts++
		this.crystals++
		this.silver += this.crystalPrice

		if (valksType === '10') {
			this.valks10Used++
			this.silver += this.valks10Price
		} else if (valksType === '50') {
			this.valks50Used++
			this.silver += this.valks50Price
		} else if (valksType === '100') {
			this.valks100Used++
			this.silver += this.valks100Price
		}

		if (anvilTriggered || this.rng() < baseRate) {
			// Success
			this.level = nextLevel
			this.anvilEnergy[nextLevel] = 0
			return {
				success: true,
				anvilTriggered,
				startingLevel,
				endingLevel: nextLevel,
				valksUsed: valksType,
				restorationAttempted: false,
				restorationSuccess: false,
				isHeptaOkta: false,
				subProgress: 0,
				subPity: 0,
				pathComplete: false,
				pathName: '',
			}
		}

		// Failure
		this.anvilEnergy[nextLevel] = currentEnergy + 1
		let restorationAttempted = false
		let restorationSuccess = false
		let endingLevel = this.level

		if (this.level > 0 && this.restorationFrom > 0 && this.level >= this.restorationFrom) {
			restorationAttempted = true
			this.scrolls += RESTORATION_PER_ATTEMPT
			this.silver += this.restorationAttemptCost

			if (this.rng() < RESTORATION_SUCCESS_RATE) {
				restorationSuccess = true
			} else {
				this.level--
				endingLevel = this.level
			}
		} else if (this.level > 0) {
			this.level--
			endingLevel = this.level
		}

		return {
			success: false,
			anvilTriggered: false,
			startingLevel,
			endingLevel,
			valksUsed: valksType,
			restorationAttempted,
			restorationSuccess,
			isHeptaOkta: false,
			subProgress: 0,
			subPity: 0,
			pathComplete: false,
			pathName: '',
		}
	}

	/** Run simulation to completion */
	runFullSimulation(recordSteps = false): SimulationResult {
		const steps: StepResult[] = []

		while (!this.isComplete()) {
			const step = this.step()
			if (recordSteps) {
				steps.push(step)
			}
		}

		return {
			crystals: this.crystals,
			scrolls: this.scrolls,
			silver: this.silver,
			exquisiteCrystals: this.exquisiteCrystals,
			attempts: this.attempts,
			finalLevel: this.level,
			anvilEnergy: { ...this.anvilEnergy },
			valks10Used: this.valks10Used,
			valks50Used: this.valks50Used,
			valks100Used: this.valks100Used,
			steps: recordSteps ? steps : undefined,
		}
	}

	/** Fast simulation returning minimal tuple (crystals, scrolls, silver, exquisite) */
	runFast(): [number, number, number, number] {
		// Local variable caching for maximum performance
		let level = this.level
		const targetLevel = this.targetLevel
		const anvilEnergy = this.anvilEnergy
		const rng = this.rng

		const restorationFrom = this.restorationFrom
		const useHepta = this.useHepta
		const useOkta = this.useOkta
		const valks100From = this.valks100From
		const valks50From = this.valks50From
		const valks10From = this.valks10From
		const crystalPrice = this.crystalPrice
		const valks10Price = this.valks10Price
		const valks50Price = this.valks50Price
		const valks100Price = this.valks100Price
		const restorationCost = this.restorationAttemptCost
		const exquisiteCost = this.exquisiteCost

		let crystals = 0
		let scrolls = 0
		let silver = 0
		let exquisiteCrystals = 0

		let heptaProgress = this.heptaProgress
		let oktaProgress = this.oktaProgress
		let heptaPity = 0
		let oktaPity = 0

		while (level < targetLevel) {
			// Check Hepta path
			if (
				(useHepta || heptaProgress > 0) &&
				level === 7 &&
				heptaProgress < HEPTA_SUB_ENHANCEMENTS
			) {
				exquisiteCrystals += HEPTA_OKTA_CRYSTALS_PER_ATTEMPT
				silver += exquisiteCost * HEPTA_OKTA_CRYSTALS_PER_ATTEMPT

				if (heptaPity >= HEPTA_OKTA_ANVIL_PITY || rng() < HEPTA_OKTA_SUCCESS_RATE) {
					heptaProgress++
					heptaPity = 0
					if (heptaProgress >= HEPTA_SUB_ENHANCEMENTS) {
						level = 8
						anvilEnergy[8] = 0
						heptaProgress = 0
					}
				} else {
					heptaPity++
				}
				continue
			}

			// Check Okta path
			if ((useOkta || oktaProgress > 0) && level === 8 && oktaProgress < OKTA_SUB_ENHANCEMENTS) {
				exquisiteCrystals += HEPTA_OKTA_CRYSTALS_PER_ATTEMPT
				silver += exquisiteCost * HEPTA_OKTA_CRYSTALS_PER_ATTEMPT

				if (oktaPity >= HEPTA_OKTA_ANVIL_PITY || rng() < HEPTA_OKTA_SUCCESS_RATE) {
					oktaProgress++
					oktaPity = 0
					if (oktaProgress >= OKTA_SUB_ENHANCEMENTS) {
						level = 9
						anvilEnergy[9] = 0
						oktaProgress = 0
					}
				} else {
					oktaPity++
				}
				continue
			}

			// Normal enhancement
			const nextLevel = level + 1

			// Get rate based on valks
			let baseRate: number
			if (valks100From > 0 && nextLevel >= valks100From) {
				baseRate = RATE_CACHE_VALKS_100[nextLevel] ?? 0.01
				silver += valks100Price
			} else if (valks50From > 0 && nextLevel >= valks50From) {
				baseRate = RATE_CACHE_VALKS_50[nextLevel] ?? 0.01
				silver += valks50Price
			} else if (valks10From > 0 && nextLevel >= valks10From) {
				baseRate = RATE_CACHE_VALKS_10[nextLevel] ?? 0.01
				silver += valks10Price
			} else {
				baseRate = RATE_CACHE[nextLevel] ?? 0.01
			}

			crystals++
			silver += crystalPrice

			// Check anvil pity
			const currentEnergy = anvilEnergy[nextLevel] ?? 0
			const maxEnergy = ANVIL_THRESHOLDS[nextLevel] ?? 999
			const anvilTriggered = currentEnergy >= maxEnergy && maxEnergy > 0

			if (anvilTriggered || rng() < baseRate) {
				level = nextLevel
				anvilEnergy[nextLevel] = 0
			} else {
				anvilEnergy[nextLevel] = currentEnergy + 1
				if (level > 0 && restorationFrom > 0 && level >= restorationFrom) {
					scrolls += RESTORATION_PER_ATTEMPT
					silver += restorationCost
					if (rng() >= RESTORATION_SUCCESS_RATE) {
						level--
					}
				} else if (level > 0) {
					level--
				}
			}
		}

		return [crystals, scrolls, silver, exquisiteCrystals]
	}
}
