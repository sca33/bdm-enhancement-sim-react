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
	RESTORATION_MARKET_BUNDLE_SIZE,
	RESTORATION_PER_ATTEMPT,
	RESTORATION_SUCCESS_RATE,
	VALKS_MULTIPLIER_10,
	VALKS_MULTIPLIER_50,
	VALKS_MULTIPLIER_100,
} from './config'
import type { ExquisiteRecipe, SimulationConfig, SimulationResult, StepResult } from './types'
import { DEFAULT_GAME_SETTINGS, getRestorationAttemptCost } from './types'

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
	private readonly enhancementCost: number

	// Cached game settings for performance
	private readonly enhancementRates: Record<number, number>
	private readonly anvilThresholds: Record<number, number>
	private readonly heptaSubEnhancements: number
	private readonly oktaSubEnhancements: number
	private readonly heptaOktaSuccessRate: number
	private readonly heptaOktaAnvilPity: number
	private readonly heptaOktaCrystalsPerAttempt: number
	private readonly exquisiteRecipe: ExquisiteRecipe

	// Pre-computed rate caches with valks
	private readonly rateCache: Record<number, number>
	private readonly rateCacheValks10: Record<number, number>
	private readonly rateCacheValks50: Record<number, number>
	private readonly rateCacheValks100: Record<number, number>

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

		// Cache game settings (use custom or defaults)
		const gs = config.gameSettings ?? DEFAULT_GAME_SETTINGS
		this.enhancementRates = gs.enhancementRates
		this.anvilThresholds = gs.anvilThresholds
		this.heptaSubEnhancements = gs.heptaSubEnhancements
		this.oktaSubEnhancements = gs.oktaSubEnhancements
		this.heptaOktaSuccessRate = gs.heptaOktaSuccessRate
		this.heptaOktaAnvilPity = gs.heptaOktaAnvilPity
		this.heptaOktaCrystalsPerAttempt = gs.heptaOktaCrystalsPerAttempt
		this.exquisiteRecipe = gs.exquisiteRecipe

		// Build rate caches from game settings
		this.rateCache = { ...this.enhancementRates }
		this.rateCacheValks10 = Object.fromEntries(
			Object.entries(this.enhancementRates).map(([level, rate]) => [
				Number(level),
				Math.min(1.0, rate * VALKS_MULTIPLIER_10),
			]),
		)
		this.rateCacheValks50 = Object.fromEntries(
			Object.entries(this.enhancementRates).map(([level, rate]) => [
				Number(level),
				Math.min(1.0, rate * VALKS_MULTIPLIER_50),
			]),
		)
		this.rateCacheValks100 = Object.fromEntries(
			Object.entries(this.enhancementRates).map(([level, rate]) => [
				Number(level),
				Math.min(1.0, rate * VALKS_MULTIPLIER_100),
			]),
		)

		// Pre-compute exquisite crystal cost using custom recipe
		this.exquisiteCost =
			Math.floor(
				(this.exquisiteRecipe.restorationScrolls * prices.restorationBundlePrice) /
					RESTORATION_MARKET_BUNDLE_SIZE,
			) +
			this.exquisiteRecipe.valks100 * prices.valks100Price +
			this.exquisiteRecipe.pristineBlackCrystal * prices.crystalPrice

		// Base enhancement cost per attempt
		this.enhancementCost = gs.enhancementCostPerAttempt

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
			this.heptaProgress < this.heptaSubEnhancements
		)
	}

	private shouldUseOkta(): boolean {
		return (
			(this.useOkta || this.oktaProgress > 0) &&
			this.level === 8 &&
			this.oktaProgress < this.oktaSubEnhancements
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
		const maxProgress = isOkta ? this.oktaSubEnhancements : this.heptaSubEnhancements

		// Cost tracking
		this.exquisiteCrystals += this.heptaOktaCrystalsPerAttempt
		this.silver += this.exquisiteCost * this.heptaOktaCrystalsPerAttempt
		this.attempts++

		// Check anvil pity
		const anvilTriggered = currentPity >= this.heptaOktaAnvilPity

		if (anvilTriggered || this.rng() < this.heptaOktaSuccessRate) {
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

		// Determine valks type - priority based (only ONE type per attempt)
		// Priority: 100 > 50 > 10 (use highest available)
		let valksType: string | null = null
		let baseRate: number

		if (this.valks100From > 0 && nextLevel >= this.valks100From) {
			valksType = '100'
			baseRate = this.rateCacheValks100[nextLevel] ?? 0.01
		} else if (this.valks50From > 0 && nextLevel >= this.valks50From) {
			valksType = '50'
			baseRate = this.rateCacheValks50[nextLevel] ?? 0.01
		} else if (this.valks10From > 0 && nextLevel >= this.valks10From) {
			valksType = '10'
			baseRate = this.rateCacheValks10[nextLevel] ?? 0.01
		} else {
			baseRate = this.rateCache[nextLevel] ?? 0.01
		}

		// Check anvil pity
		const currentEnergy = this.anvilEnergy[nextLevel] ?? 0
		const maxEnergy = this.anvilThresholds[nextLevel] ?? 999
		const anvilTriggered = currentEnergy >= maxEnergy && maxEnergy > 0

		// Resource tracking
		this.attempts++
		this.crystals++
		this.silver += this.crystalPrice + this.enhancementCost

		// Track Valks used (only ONE type per attempt)
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

	/** Fast simulation returning minimal tuple (crystals, scrolls, silver, exquisite, valks10, valks50, valks100) */
	runFast(): [number, number, number, number, number, number, number] {
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
		const enhancementCost = this.enhancementCost

		// Cache game settings locally
		const heptaSubEnhancements = this.heptaSubEnhancements
		const oktaSubEnhancements = this.oktaSubEnhancements
		const heptaOktaSuccessRate = this.heptaOktaSuccessRate
		const heptaOktaAnvilPity = this.heptaOktaAnvilPity
		const rateCache = this.rateCache
		const rateCacheValks10 = this.rateCacheValks10
		const rateCacheValks50 = this.rateCacheValks50
		const rateCacheValks100 = this.rateCacheValks100
		const anvilThresholds = this.anvilThresholds

		let crystals = 0
		let scrolls = 0
		let silver = 0
		let exquisiteCrystals = 0
		let valks10Used = 0
		let valks50Used = 0
		let valks100Used = 0

		let heptaProgress = this.heptaProgress
		let oktaProgress = this.oktaProgress
		let heptaPity = 0
		let oktaPity = 0

		while (level < targetLevel) {
			// Check Hepta path
			if ((useHepta || heptaProgress > 0) && level === 7 && heptaProgress < heptaSubEnhancements) {
				exquisiteCrystals += this.heptaOktaCrystalsPerAttempt
				silver += exquisiteCost * this.heptaOktaCrystalsPerAttempt

				if (heptaPity >= heptaOktaAnvilPity || rng() < heptaOktaSuccessRate) {
					heptaProgress++
					heptaPity = 0
					if (heptaProgress >= heptaSubEnhancements) {
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
			if ((useOkta || oktaProgress > 0) && level === 8 && oktaProgress < oktaSubEnhancements) {
				exquisiteCrystals += this.heptaOktaCrystalsPerAttempt
				silver += exquisiteCost * this.heptaOktaCrystalsPerAttempt

				if (oktaPity >= heptaOktaAnvilPity || rng() < heptaOktaSuccessRate) {
					oktaProgress++
					oktaPity = 0
					if (oktaProgress >= oktaSubEnhancements) {
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

			// Determine valks type - priority based (only ONE type per attempt)
			// Priority: 100 > 50 > 10 (use highest available)
			let baseRate: number
			if (valks100From > 0 && nextLevel >= valks100From) {
				baseRate = rateCacheValks100[nextLevel] ?? 0.01
				silver += valks100Price
				valks100Used++
			} else if (valks50From > 0 && nextLevel >= valks50From) {
				baseRate = rateCacheValks50[nextLevel] ?? 0.01
				silver += valks50Price
				valks50Used++
			} else if (valks10From > 0 && nextLevel >= valks10From) {
				baseRate = rateCacheValks10[nextLevel] ?? 0.01
				silver += valks10Price
				valks10Used++
			} else {
				baseRate = rateCache[nextLevel] ?? 0.01
			}

			crystals++
			silver += crystalPrice + enhancementCost

			// Check anvil pity
			const currentEnergy = anvilEnergy[nextLevel] ?? 0
			const maxEnergy = anvilThresholds[nextLevel] ?? 999
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

		return [crystals, scrolls, silver, exquisiteCrystals, valks10Used, valks50Used, valks100Used]
	}

	/**
	 * Fast simulation with resource limits.
	 * Returns [crystals, scrolls, silver, exquisite, valks10, valks50, valks100, success]
	 * where success is 1 if target reached, 0 if resources exhausted
	 */
	runFastWithLimits(limits: {
		crystals?: number
		scrolls?: number
		valks10?: number
		valks50?: number
		valks100?: number
	}): [number, number, number, number, number, number, number, number] {
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
		const enhancementCost = this.enhancementCost

		// Cache game settings locally
		const heptaSubEnhancements = this.heptaSubEnhancements
		const oktaSubEnhancements = this.oktaSubEnhancements
		const heptaOktaSuccessRate = this.heptaOktaSuccessRate
		const heptaOktaAnvilPity = this.heptaOktaAnvilPity
		const rateCache = this.rateCache
		const rateCacheValks10 = this.rateCacheValks10
		const rateCacheValks50 = this.rateCacheValks50
		const rateCacheValks100 = this.rateCacheValks100
		const anvilThresholds = this.anvilThresholds

		// Resource limits (undefined = unlimited)
		const maxCrystals = limits.crystals
		const maxScrolls = limits.scrolls
		const maxValks10 = limits.valks10
		const maxValks50 = limits.valks50
		const maxValks100 = limits.valks100

		let crystals = 0
		let scrolls = 0
		let silver = 0
		let exquisiteCrystals = 0
		let valks10Used = 0
		let valks50Used = 0
		let valks100Used = 0

		let heptaProgress = this.heptaProgress
		let oktaProgress = this.oktaProgress
		let heptaPity = 0
		let oktaPity = 0

		while (level < targetLevel) {
			// Check Hepta path
			if ((useHepta || heptaProgress > 0) && level === 7 && heptaProgress < heptaSubEnhancements) {
				exquisiteCrystals += this.heptaOktaCrystalsPerAttempt
				silver += exquisiteCost * this.heptaOktaCrystalsPerAttempt

				if (heptaPity >= heptaOktaAnvilPity || rng() < heptaOktaSuccessRate) {
					heptaProgress++
					heptaPity = 0
					if (heptaProgress >= heptaSubEnhancements) {
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
			if ((useOkta || oktaProgress > 0) && level === 8 && oktaProgress < oktaSubEnhancements) {
				exquisiteCrystals += this.heptaOktaCrystalsPerAttempt
				silver += exquisiteCost * this.heptaOktaCrystalsPerAttempt

				if (oktaPity >= heptaOktaAnvilPity || rng() < heptaOktaSuccessRate) {
					oktaProgress++
					oktaPity = 0
					if (oktaProgress >= oktaSubEnhancements) {
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

			// Check crystal limit before attempting
			if (maxCrystals !== undefined && crystals >= maxCrystals) {
				return [
					crystals,
					scrolls,
					silver,
					exquisiteCrystals,
					valks10Used,
					valks50Used,
					valks100Used,
					0,
				]
			}

			// Determine valks type - priority based (only ONE type per attempt)
			// Priority: 100 > 50 > 10 (use highest available)
			// Also check if we have enough valks
			let baseRate: number
			let canUseValks100 = valks100From > 0 && nextLevel >= valks100From
			let canUseValks50 = valks50From > 0 && nextLevel >= valks50From
			let canUseValks10 = valks10From > 0 && nextLevel >= valks10From

			// Check valks limits
			if (canUseValks100 && maxValks100 !== undefined && valks100Used >= maxValks100) {
				canUseValks100 = false
			}
			if (canUseValks50 && maxValks50 !== undefined && valks50Used >= maxValks50) {
				canUseValks50 = false
			}
			if (canUseValks10 && maxValks10 !== undefined && valks10Used >= maxValks10) {
				canUseValks10 = false
			}

			if (canUseValks100) {
				baseRate = rateCacheValks100[nextLevel] ?? 0.01
				silver += valks100Price
				valks100Used++
			} else if (canUseValks50) {
				baseRate = rateCacheValks50[nextLevel] ?? 0.01
				silver += valks50Price
				valks50Used++
			} else if (canUseValks10) {
				baseRate = rateCacheValks10[nextLevel] ?? 0.01
				silver += valks10Price
				valks10Used++
			} else {
				baseRate = rateCache[nextLevel] ?? 0.01
			}

			crystals++
			silver += crystalPrice + enhancementCost

			// Check anvil pity
			const currentEnergy = anvilEnergy[nextLevel] ?? 0
			const maxEnergy = anvilThresholds[nextLevel] ?? 999
			const anvilTriggered = currentEnergy >= maxEnergy && maxEnergy > 0

			if (anvilTriggered || rng() < baseRate) {
				level = nextLevel
				anvilEnergy[nextLevel] = 0
			} else {
				anvilEnergy[nextLevel] = currentEnergy + 1
				if (level > 0 && restorationFrom > 0 && level >= restorationFrom) {
					// Check scroll limit before using restoration
					if (maxScrolls !== undefined && scrolls + RESTORATION_PER_ATTEMPT > maxScrolls) {
						// Can't use restoration, must downgrade
						level--
					} else {
						scrolls += RESTORATION_PER_ATTEMPT
						silver += restorationCost
						if (rng() >= RESTORATION_SUCCESS_RATE) {
							level--
						}
					}
				} else if (level > 0) {
					level--
				}
			}
		}

		return [crystals, scrolls, silver, exquisiteCrystals, valks10Used, valks50Used, valks100Used, 1]
	}
}
