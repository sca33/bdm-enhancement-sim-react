/**
 * Core enhancement simulation logic with Monte Carlo support.
 */

import {
	ANVIL_THRESHOLDS,
	DEFAULT_PRICES,
	ENHANCEMENT_RATES,
	MATERIAL_COSTS,
	RESTORATION_SCROLL_COSTS,
	RESTORATION_SUCCESS_RATE,
	VALKS_MULTIPLIERS,
} from './config'
import type {
	AttemptResult,
	EnhancementStrategy,
	GearState,
	MonteCarloResult,
	PercentileStats,
	SimulationResult,
	ValksType,
} from './types'
import { cloneGearState, createGearState } from './types'

/** Seeded random number generator (Mulberry32) */
function createRng(seed: number) {
	let state = seed
	return () => {
		state |= 0
		state = (state + 0x6d2b79f5) | 0
		let t = Math.imul(state ^ (state >>> 15), 1 | state)
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

export class AwakeningSimulator {
	private rng: () => number
	private prices: Record<string, number>

	constructor(seed?: number, prices?: Record<string, number>) {
		this.rng = seed !== undefined ? createRng(seed) : Math.random
		this.prices = prices ?? DEFAULT_PRICES
	}

	/** Update market prices */
	setPrices(prices: Record<string, number>): void {
		this.prices = { ...DEFAULT_PRICES, ...prices }
	}

	/** Get success rate including any bonuses (multiplicative) */
	private getSuccessRate(targetLevel: number, valks: ValksType): number {
		const baseRate = ENHANCEMENT_RATES[targetLevel] ?? 0.01

		if (valks === 'small') {
			return Math.min(1.0, baseRate * VALKS_MULTIPLIERS[10])
		}
		if (valks === 'large') {
			return Math.min(1.0, baseRate * VALKS_MULTIPLIERS[50])
		}
		if (valks === '100') {
			return Math.min(1.0, baseRate * VALKS_MULTIPLIERS[100])
		}

		return baseRate
	}

	/** Determine if restoration should be used based on strategy */
	private shouldUseRestoration(currentLevel: number, strategy: EnhancementStrategy): boolean {
		switch (strategy.restoration) {
			case 'never':
				return false
			case 'always':
				return true
			case 'above_threshold':
				return currentLevel >= strategy.restorationThreshold
			case 'cost_efficient':
				return currentLevel >= 4
		}
	}

	/** Determine which Valks to use based on strategy */
	private getValksType(targetLevel: number, strategy: EnhancementStrategy): ValksType {
		switch (strategy.valks) {
			case 'never':
				return null
			case 'small_only':
				return 'small'
			case 'large_only':
				return 'large'
			case 'large_high':
				return targetLevel >= strategy.valksLargeThreshold ? 'large' : null
			case 'optimal':
				if (targetLevel >= 7) return 'large'
				if (targetLevel >= 4) return 'small'
				return null
		}
	}

	/** Perform a single enhancement attempt */
	attemptEnhancement(gear: GearState, strategy: EnhancementStrategy): AttemptResult {
		const targetLevel = gear.awakeningLevel + 1

		if (targetLevel > 10) {
			throw new Error('Already at max awakening level (X)')
		}

		const valksType = this.getValksType(targetLevel, strategy)
		const successRate = this.getSuccessRate(targetLevel, valksType)

		// Check anvil pity
		const currentEnergy = gear.anvilEnergy[targetLevel] ?? 0
		const maxEnergy = ANVIL_THRESHOLDS[targetLevel] ?? 999
		const anvilTriggered = maxEnergy > 0 && currentEnergy >= maxEnergy

		// Calculate material costs
		const materialsCost: Record<string, number> = {
			pristine_black_crystal: MATERIAL_COSTS[targetLevel] ?? 1,
		}
		if (valksType === 'small') {
			materialsCost.valks_advice_10 = 1
		} else if (valksType === 'large') {
			materialsCost.valks_advice_50 = 1
		} else if (valksType === '100') {
			materialsCost.valks_advice_100 = 1
		}

		const startingLevel = gear.awakeningLevel

		// Anvil guaranteed success
		if (anvilTriggered) {
			gear.awakeningLevel = targetLevel
			gear.anvilEnergy[targetLevel] = 0
			return {
				success: true,
				startingLevel,
				endingLevel: targetLevel,
				anvilTriggered: true,
				restorationAttempted: false,
				restorationSuccess: false,
				valksUsed: valksType,
				materialsCost,
			}
		}

		// Roll for success
		const roll = this.rng()
		const success = roll < successRate

		if (success) {
			gear.awakeningLevel = targetLevel
			gear.anvilEnergy[targetLevel] = 0
			return {
				success: true,
				startingLevel,
				endingLevel: targetLevel,
				anvilTriggered: false,
				restorationAttempted: false,
				restorationSuccess: false,
				valksUsed: valksType,
				materialsCost,
			}
		}

		// Failed - accumulate energy
		gear.anvilEnergy[targetLevel] = (gear.anvilEnergy[targetLevel] ?? 0) + 1

		// Handle downgrade
		let restorationAttempted = false
		let restorationSuccess = false
		let endingLevel = gear.awakeningLevel

		if (gear.awakeningLevel > 0) {
			const useRestoration = this.shouldUseRestoration(gear.awakeningLevel, strategy)

			if (useRestoration) {
				restorationAttempted = true
				materialsCost.restoration_scroll = RESTORATION_SCROLL_COSTS[gear.awakeningLevel] ?? 200
				restorationSuccess = this.rng() < RESTORATION_SUCCESS_RATE

				if (!restorationSuccess) {
					gear.awakeningLevel -= 1
					endingLevel = gear.awakeningLevel
				}
			} else {
				gear.awakeningLevel -= 1
				endingLevel = gear.awakeningLevel
			}
		}

		return {
			success: false,
			startingLevel,
			endingLevel,
			anvilTriggered: false,
			restorationAttempted,
			restorationSuccess,
			valksUsed: valksType,
			materialsCost,
		}
	}

	/** Run simulation until target level is reached */
	simulateToTarget(
		targetLevel: number,
		strategy: EnhancementStrategy,
		startingState?: GearState,
		maxAttempts = 100_000,
		recordHistory = false
	): SimulationResult {
		const gear = startingState ? cloneGearState(startingState) : createGearState()

		const result: SimulationResult = {
			targetLevel,
			totalAttempts: 0,
			successes: 0,
			failures: 0,
			anvilTriggers: 0,
			restorationAttempts: 0,
			restorationSuccesses: 0,
			levelDrops: 0,
			materialsUsed: {},
			silverCost: 0,
			attemptHistory: [],
		}

		while (gear.awakeningLevel < targetLevel && result.totalAttempts < maxAttempts) {
			const attempt = this.attemptEnhancement(gear, strategy)
			result.totalAttempts++

			if (recordHistory) {
				result.attemptHistory.push(attempt)
			}

			if (attempt.success) {
				result.successes++
			} else {
				result.failures++
			}

			if (attempt.anvilTriggered) {
				result.anvilTriggers++
			}

			if (attempt.restorationAttempted) {
				result.restorationAttempts++
				if (attempt.restorationSuccess) {
					result.restorationSuccesses++
				} else {
					result.levelDrops++
				}
			} else if (!attempt.success && attempt.startingLevel > 0) {
				result.levelDrops++
			}

			// Accumulate materials
			for (const [mat, amount] of Object.entries(attempt.materialsCost)) {
				result.materialsUsed[mat] = (result.materialsUsed[mat] ?? 0) + amount
			}
		}

		// Calculate silver cost
		for (const [mat, amount] of Object.entries(result.materialsUsed)) {
			result.silverCost += (this.prices[mat] ?? 0) * amount
		}

		return result
	}

	/** Run multiple simulations and return statistics */
	runMonteCarlo(
		targetLevel: number,
		strategy: EnhancementStrategy,
		numSimulations = 10_000,
		startingState?: GearState,
		onProgress?: (completed: number, total: number) => void
	): MonteCarloResult {
		const results: SimulationResult[] = []

		for (let i = 0; i < numSimulations; i++) {
			const result = this.simulateToTarget(targetLevel, strategy, startingState)
			results.push(result)

			if (onProgress && i % 100 === 0) {
				onProgress(i, numSimulations)
			}
		}

		if (onProgress) {
			onProgress(numSimulations, numSimulations)
		}

		// Sort arrays for percentile calculations
		const attempts = results.map((r) => r.totalAttempts).sort((a, b) => a - b)
		const silverCosts = results.map((r) => r.silverCost).sort((a, b) => a - b)
		const crystals = results
			.map((r) => r.materialsUsed.pristine_black_crystal ?? 0)
			.sort((a, b) => a - b)
		const scrolls = results
			.map((r) => r.materialsUsed.restoration_scroll ?? 0)
			.sort((a, b) => a - b)
		const levelDrops = results.map((r) => r.levelDrops).sort((a, b) => a - b)
		const anvilTriggers = results.map((r) => r.anvilTriggers).sort((a, b) => a - b)

		return {
			numSimulations,
			targetLevel,
			strategy: {
				restoration: strategy.restoration,
				valks: strategy.valks,
			},
			attempts: calcPercentiles(attempts),
			silverCost: calcPercentiles(silverCosts),
			pristineBlackCrystals: calcPercentiles(crystals),
			restorationScrolls: calcPercentiles(scrolls),
			levelDrops: calcPercentiles(levelDrops),
			anvilTriggers: {
				average: average(anvilTriggers),
				p50: percentile(anvilTriggers, 0.5),
				p90: percentile(anvilTriggers, 0.9),
				p99: percentile(anvilTriggers, 0.99),
			},
		}
	}
}

function percentile(sorted: number[], p: number): number {
	const idx = Math.floor(sorted.length * p)
	return sorted[Math.min(idx, sorted.length - 1)] ?? 0
}

function average(arr: number[]): number {
	return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
}

function calcPercentiles(sorted: number[]): PercentileStats {
	return {
		average: average(sorted),
		p50: percentile(sorted, 0.5),
		p90: percentile(sorted, 0.9),
		p99: percentile(sorted, 0.99),
		worst: sorted[sorted.length - 1] ?? 0,
	}
}
