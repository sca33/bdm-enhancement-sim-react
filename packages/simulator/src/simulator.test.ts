/**
 * Unit tests for the AwakeningEngine simulation.
 */
import { describe, expect, it } from 'vitest'
import {
	ANVIL_THRESHOLDS,
	ENHANCEMENT_RATES,
	HEPTA_OKTA_ANVIL_PITY,
	HEPTA_OKTA_SUCCESS_RATE,
	HEPTA_SUB_ENHANCEMENTS,
	OKTA_SUB_ENHANCEMENTS,
	RATE_CACHE,
	RATE_CACHE_VALKS_10,
	RATE_CACHE_VALKS_100,
	RATE_CACHE_VALKS_50,
	VALKS_MULTIPLIER_10,
	VALKS_MULTIPLIER_100,
	VALKS_MULTIPLIER_50,
} from './config'
import { AwakeningEngine } from './simulator'
import { DEFAULT_CONFIG, type SimulationConfig } from './types'

describe('AwakeningEngine', () => {
	const baseConfig: SimulationConfig = {
		...DEFAULT_CONFIG,
		startLevel: 0,
		targetLevel: 5,
		restorationFrom: 0,
		useHepta: false,
		useOkta: false,
	}

	describe('initialization', () => {
		it('creates engine with default config', () => {
			const engine = new AwakeningEngine(baseConfig)
			expect(engine.getLevel()).toBe(0)
			expect(engine.isComplete()).toBe(false)
		})

		it('starts at the configured start level', () => {
			const config = { ...baseConfig, startLevel: 3 }
			const engine = new AwakeningEngine(config)
			expect(engine.getLevel()).toBe(3)
		})

		it('is complete when start equals target', () => {
			const config = { ...baseConfig, startLevel: 5, targetLevel: 5 }
			const engine = new AwakeningEngine(config)
			expect(engine.isComplete()).toBe(true)
		})
	})

	describe('seeded RNG', () => {
		it('produces consistent results with same seed', () => {
			const config = { ...baseConfig, targetLevel: 3 }

			const engine1 = new AwakeningEngine(config, 12345)
			const result1 = engine1.runFast()

			const engine2 = new AwakeningEngine(config, 12345)
			const result2 = engine2.runFast()

			expect(result1).toEqual(result2)
		})

		it('produces different results with different seeds', () => {
			const config = { ...baseConfig, targetLevel: 5 }

			const engine1 = new AwakeningEngine(config, 12345)
			const result1 = engine1.runFast()

			const engine2 = new AwakeningEngine(config, 54321)
			const result2 = engine2.runFast()

			// Very unlikely to be equal with different seeds
			expect(result1[0]).not.toBe(result2[0])
		})
	})

	describe('anvil pity system', () => {
		it('triggers guaranteed success after threshold failures at same level', () => {
			// Test that anvil triggers after exactly threshold failures
			// Use level III which has threshold of 2 failures
			expect(ANVIL_THRESHOLDS[3]).toBe(2)

			// Track anvil triggers
			let anvilTriggerCount = 0
			let nonAnvilSuccessCount = 0

			for (let seed = 0; seed < 500; seed++) {
				const config: SimulationConfig = {
					...baseConfig,
					startLevel: 2,
					targetLevel: 3,
					restorationFrom: 3, // Prevent downgrade so we stay at level 2
				}

				const engine = new AwakeningEngine(config, seed)
				const result = engine.runFullSimulation(true)

				// Find the final successful step
				const successStep = (result.steps || []).find((s) => s.success && s.endingLevel === 3)
				if (successStep?.anvilTriggered) {
					anvilTriggerCount++
				} else if (successStep) {
					nonAnvilSuccessCount++
				}
			}

			// Should have both anvil and non-anvil successes
			expect(anvilTriggerCount).toBeGreaterThan(0)
			expect(nonAnvilSuccessCount).toBeGreaterThan(0)
		})

		it('tracks anvil energy correctly', () => {
			const config: SimulationConfig = {
				...baseConfig,
				startLevel: 4,
				targetLevel: 5,
				restorationFrom: 0,
			}

			// Find a seed that causes failures before success
			let foundFailureSeed = -1
			for (let seed = 0; seed < 1000; seed++) {
				const engine = new AwakeningEngine(config, seed)
				const step = engine.step()
				if (!step.success) {
					foundFailureSeed = seed
					break
				}
			}

			if (foundFailureSeed >= 0) {
				const engine = new AwakeningEngine(config, foundFailureSeed)
				engine.step() // First failure
				const energy = engine.getAnvilEnergy()
				expect(energy[5]).toBe(1)
			}
		})
	})

	describe('rate calculations', () => {
		it('has correct base enhancement rates', () => {
			expect(ENHANCEMENT_RATES[1]).toBe(0.7) // 70%
			expect(ENHANCEMENT_RATES[5]).toBe(0.1) // 10%
			expect(ENHANCEMENT_RATES[10]).toBe(0.005) // 0.5%
		})

		it('calculates Valks +10% rates correctly', () => {
			for (const [level, rate] of Object.entries(ENHANCEMENT_RATES)) {
				const expected = Math.min(1.0, rate * VALKS_MULTIPLIER_10)
				expect(RATE_CACHE_VALKS_10[Number(level)]).toBeCloseTo(expected)
			}
		})

		it('calculates Valks +50% rates correctly', () => {
			for (const [level, rate] of Object.entries(ENHANCEMENT_RATES)) {
				const expected = Math.min(1.0, rate * VALKS_MULTIPLIER_50)
				expect(RATE_CACHE_VALKS_50[Number(level)]).toBeCloseTo(expected)
			}
		})

		it('calculates Valks +100% rates correctly', () => {
			for (const [level, rate] of Object.entries(ENHANCEMENT_RATES)) {
				const expected = Math.min(1.0, rate * VALKS_MULTIPLIER_100)
				expect(RATE_CACHE_VALKS_100[Number(level)]).toBeCloseTo(expected)
			}
		})

		it('caps rates at 100%', () => {
			// Level I with +100% Valks would be 140%, should cap at 100%
			expect(RATE_CACHE_VALKS_100[1]).toBe(1.0)
			expect(RATE_CACHE_VALKS_100[2]).toBe(1.0) // 120% capped
		})
	})

	describe('restoration scrolls', () => {
		it('does not downgrade when restoration succeeds', () => {
			const config: SimulationConfig = {
				...baseConfig,
				startLevel: 5,
				targetLevel: 6,
				restorationFrom: 5,
			}

			let restorationSaveCount = 0
			let restorationFailCount = 0

			// Run many simulations to test restoration
			for (let seed = 0; seed < 500; seed++) {
				const engine = new AwakeningEngine(config, seed)
				const result = engine.runFullSimulation(true)

				for (const step of result.steps || []) {
					if (step.restorationAttempted) {
						if (step.restorationSuccess) {
							restorationSaveCount++
							// Should stay at same level on save
							expect(step.endingLevel).toBe(step.startingLevel)
						} else {
							restorationFailCount++
							// Should downgrade on fail
							expect(step.endingLevel).toBe(step.startingLevel - 1)
						}
					}
				}
			}

			// Verify we tested both outcomes
			expect(restorationSaveCount).toBeGreaterThan(0)
			expect(restorationFailCount).toBeGreaterThan(0)

			// Should be roughly 50/50 (within statistical bounds)
			const total = restorationSaveCount + restorationFailCount
			const ratio = restorationSaveCount / total
			expect(ratio).toBeGreaterThan(0.4)
			expect(ratio).toBeLessThan(0.6)
		})

		it('tracks scroll usage correctly', () => {
			const config: SimulationConfig = {
				...baseConfig,
				startLevel: 5,
				targetLevel: 6,
				restorationFrom: 5,
			}

			const engine = new AwakeningEngine(config, 42)
			const result = engine.runFullSimulation(true)

			// Count restoration attempts from steps
			const restorationAttempts = (result.steps || []).filter((s) => s.restorationAttempted).length

			// Each restoration attempt uses 200 scrolls
			expect(result.scrolls).toBe(restorationAttempts * 200)
		})
	})

	describe('Hepta path (VII → VIII)', () => {
		it('requires 5 sub-enhancements to complete', () => {
			expect(HEPTA_SUB_ENHANCEMENTS).toBe(5)
		})

		it('completes Hepta path and advances to level 8', () => {
			const config: SimulationConfig = {
				...baseConfig,
				startLevel: 7,
				targetLevel: 8,
				useHepta: true,
				restorationFrom: 0,
			}

			const engine = new AwakeningEngine(config, 12345)
			const result = engine.runFullSimulation(true)

			expect(result.finalLevel).toBe(8)

			// Should have Hepta steps
			const heptaSteps = (result.steps || []).filter((s) => s.isHeptaOkta && s.pathName === 'Hepta')
			expect(heptaSteps.length).toBeGreaterThan(0)

			// Should have a path complete step
			const completeStep = heptaSteps.find((s) => s.pathComplete)
			expect(completeStep).toBeDefined()
		})

		it('uses exquisite crystals for Hepta attempts', () => {
			const config: SimulationConfig = {
				...baseConfig,
				startLevel: 7,
				targetLevel: 8,
				useHepta: true,
				restorationFrom: 0,
			}

			const engine = new AwakeningEngine(config, 42)
			const result = engine.runFullSimulation()

			// Should have used exquisite crystals (15 per attempt)
			expect(result.exquisiteCrystals).toBeGreaterThan(0)
			expect(result.exquisiteCrystals % 15).toBe(0)
		})

		it('respects Hepta anvil pity at 17 failures', () => {
			expect(HEPTA_OKTA_ANVIL_PITY).toBe(17)

			const config: SimulationConfig = {
				...baseConfig,
				startLevel: 7,
				targetLevel: 8,
				useHepta: true,
				restorationFrom: 0,
			}

			// Each sub-enhancement needs at most 18 attempts (17 failures + 1 pity success)
			// 5 sub-enhancements = max 90 attempts
			for (let seed = 0; seed < 50; seed++) {
				const engine = new AwakeningEngine(config, seed)
				const result = engine.runFullSimulation()
				expect(result.attempts).toBeLessThanOrEqual(5 * (HEPTA_OKTA_ANVIL_PITY + 1))
			}
		})
	})

	describe('Okta path (VIII → IX)', () => {
		it('requires 10 sub-enhancements to complete', () => {
			expect(OKTA_SUB_ENHANCEMENTS).toBe(10)
		})

		it('completes Okta path and advances to level 9', () => {
			const config: SimulationConfig = {
				...baseConfig,
				startLevel: 8,
				targetLevel: 9,
				useOkta: true,
				restorationFrom: 0,
			}

			const engine = new AwakeningEngine(config, 12345)
			const result = engine.runFullSimulation(true)

			expect(result.finalLevel).toBe(9)

			// Should have Okta steps
			const oktaSteps = (result.steps || []).filter((s) => s.isHeptaOkta && s.pathName === 'Okta')
			expect(oktaSteps.length).toBeGreaterThan(0)
		})
	})

	describe('Valks usage', () => {
		it('tracks Valks +10% usage', () => {
			const config: SimulationConfig = {
				...baseConfig,
				startLevel: 0,
				targetLevel: 3,
				valks10From: 1,
				valks50From: 0,
				valks100From: 0,
				restorationFrom: 0,
			}

			const engine = new AwakeningEngine(config, 42)
			const result = engine.runFullSimulation()

			// Should have used Valks +10%
			expect(result.valks10Used).toBeGreaterThan(0)
			expect(result.valks50Used).toBe(0)
			expect(result.valks100Used).toBe(0)
		})

		it('stacks multiple Valks buffs', () => {
			const config: SimulationConfig = {
				...baseConfig,
				startLevel: 4,
				targetLevel: 5,
				valks10From: 1,
				valks50From: 3,
				valks100From: 5,
				restorationFrom: 0,
			}

			const engine = new AwakeningEngine(config, 42)
			const result = engine.runFullSimulation(true)

			// Level 5 enhancement should use all three Valks (stacked)
			expect(result.valks10Used).toBeGreaterThan(0)
			expect(result.valks50Used).toBeGreaterThan(0)
			expect(result.valks100Used).toBeGreaterThan(0)

			// Verify from steps - should show stacked Valks
			const steps = result.steps || []
			for (const step of steps) {
				if (step.startingLevel === 4) {
					expect(step.valksUsed).toBe('10+50+100')
				}
			}
		})

		it('stacks two Valks when only two are active', () => {
			const config: SimulationConfig = {
				...baseConfig,
				startLevel: 4,
				targetLevel: 5,
				valks10From: 1,
				valks50From: 5,
				valks100From: 0,
				restorationFrom: 0,
			}

			const engine = new AwakeningEngine(config, 42)
			const result = engine.runFullSimulation(true)

			// Level 5 should use +10% and +50%
			expect(result.valks10Used).toBeGreaterThan(0)
			expect(result.valks50Used).toBeGreaterThan(0)
			expect(result.valks100Used).toBe(0)

			// Verify from steps
			const steps = result.steps || []
			for (const step of steps) {
				if (step.startingLevel === 4) {
					expect(step.valksUsed).toBe('10+50')
				}
			}
		})
	})

	describe('resource tracking', () => {
		it('counts crystals correctly', () => {
			const config: SimulationConfig = {
				...baseConfig,
				startLevel: 0,
				targetLevel: 3,
				restorationFrom: 0,
				useHepta: false,
				useOkta: false,
			}

			const engine = new AwakeningEngine(config, 42)
			const result = engine.runFullSimulation(true)

			// Count non-Hepta/Okta attempts from steps
			const normalAttempts = (result.steps || []).filter((s) => !s.isHeptaOkta).length

			expect(result.crystals).toBe(normalAttempts)
		})

		it('calculates silver cost correctly', () => {
			const config: SimulationConfig = {
				...baseConfig,
				startLevel: 0,
				targetLevel: 2,
				restorationFrom: 0,
				valks10From: 0,
				valks50From: 0,
				valks100From: 0,
			}

			const engine = new AwakeningEngine(config, 42)
			const result = engine.runFullSimulation()

			// Silver should be crystals * crystal price
			const expectedSilver = result.crystals * config.prices.crystalPrice
			expect(result.silver).toBe(expectedSilver)
		})
	})

	describe('runFast', () => {
		it('returns same resource counts as runFullSimulation', () => {
			const config: SimulationConfig = {
				...baseConfig,
				startLevel: 0,
				targetLevel: 6,
				restorationFrom: 4,
			}

			const engine1 = new AwakeningEngine(config, 99999)
			const fullResult = engine1.runFullSimulation()

			const engine2 = new AwakeningEngine(config, 99999)
			const fastResult = engine2.runFast()

			expect(fastResult[0]).toBe(fullResult.crystals)
			expect(fastResult[1]).toBe(fullResult.scrolls)
			expect(fastResult[2]).toBe(fullResult.silver)
			expect(fastResult[3]).toBe(fullResult.exquisiteCrystals)
		})
	})

	describe('reset', () => {
		it('resets all state to initial values', () => {
			const config: SimulationConfig = {
				...baseConfig,
				startLevel: 0,
				targetLevel: 5,
			}

			const engine = new AwakeningEngine(config, 42)
			engine.runFullSimulation()

			// After running, engine should be complete
			expect(engine.isComplete()).toBe(true)
			expect(engine.getLevel()).toBe(5)

			// Reset
			engine.reset()

			expect(engine.isComplete()).toBe(false)
			expect(engine.getLevel()).toBe(0)
			expect(engine.getStats().crystals).toBe(0)
			expect(engine.getStats().attempts).toBe(0)
		})
	})

	describe('strategy finder simulation', () => {
		/**
		 * These tests validate the strategy finder simulation behavior.
		 * The strategy finder was broken when DEFAULT_CONFIG with valks enabled
		 * was used instead of disabling valks for fair comparison.
		 */

		it('valks settings significantly affect total costs', () => {
			// This test verifies that valks settings matter for cost calculations
			// With valks disabled (as strategy finder should use), costs are higher
			const configNoValks: SimulationConfig = {
				...DEFAULT_CONFIG,
				startLevel: 0,
				targetLevel: 9,
				restorationFrom: 6,
				useHepta: false,
				useOkta: false,
				valks10From: 0,
				valks50From: 0,
				valks100From: 0,
			}

			const configWithValks: SimulationConfig = {
				...DEFAULT_CONFIG,
				startLevel: 0,
				targetLevel: 9,
				restorationFrom: 6,
				useHepta: false,
				useOkta: false,
				valks10From: 1,
				valks50From: 3,
				valks100From: 5,
			}

			// Run multiple simulations with same seeds to compare
			let noValksTotalSilver = 0
			let withValksTotalSilver = 0
			const numSims = 100

			for (let seed = 0; seed < numSims; seed++) {
				const engineNoValks = new AwakeningEngine(configNoValks, seed)
				const [, , silverNoValks] = engineNoValks.runFast()
				noValksTotalSilver += silverNoValks

				const engineWithValks = new AwakeningEngine(configWithValks, seed)
				const [, , silverWithValks] = engineWithValks.runFast()
				withValksTotalSilver += silverWithValks
			}

			// Without valks should cost MORE than with valks
			// (valks boost success rates at no additional cost in default prices)
			expect(noValksTotalSilver).toBeGreaterThan(withValksTotalSilver)

			// The difference should be significant (roughly 1.5x-2x more without valks)
			const ratio = noValksTotalSilver / withValksTotalSilver
			expect(ratio).toBeGreaterThan(1.3)
		})

		it('restoration from +VI to +IX costs significantly more without valks', () => {
			// This test validates that without valks (as strategy finder should use),
			// costs are significantly higher than with valks enabled
			const configNoValks: SimulationConfig = {
				...DEFAULT_CONFIG,
				startLevel: 0,
				targetLevel: 9,
				restorationFrom: 6,
				useHepta: false,
				useOkta: false,
				valks10From: 0,
				valks50From: 0,
				valks100From: 0,
			}

			const configWithValks: SimulationConfig = {
				...DEFAULT_CONFIG,
				startLevel: 0,
				targetLevel: 9,
				restorationFrom: 6,
				useHepta: false,
				useOkta: false,
				valks10From: 1,
				valks50From: 3,
				valks100From: 5,
			}

			const noValksSilver: number[] = []
			const withValksSilver: number[] = []
			const numSims = 200

			for (let seed = 0; seed < numSims; seed++) {
				const engineNoValks = new AwakeningEngine(configNoValks, seed)
				const [, , silver1] = engineNoValks.runFast()
				noValksSilver.push(silver1)

				const engineWithValks = new AwakeningEngine(configWithValks, seed)
				const [, , silver2] = engineWithValks.runFast()
				withValksSilver.push(silver2)
			}

			// Sort to get medians
			noValksSilver.sort((a, b) => a - b)
			withValksSilver.sort((a, b) => a - b)

			const noValksMedian = noValksSilver[Math.floor(numSims * 0.5)]
			const withValksMedian = withValksSilver[Math.floor(numSims * 0.5)]

			// Without valks should cost significantly more (roughly 1.5x-2x)
			// This is the core bug that was fixed - the old implementation accidentally
			// used valks which reduced costs by about half
			expect(noValksMedian).toBeGreaterThan(withValksMedian * 1.3)

			// Verify both are positive and reasonable
			expect(noValksMedian).toBeGreaterThan(0)
			expect(withValksMedian).toBeGreaterThan(0)
		})

		it('valks10From=0 disables Valks +10%', () => {
			const config: SimulationConfig = {
				...DEFAULT_CONFIG,
				startLevel: 0,
				targetLevel: 3,
				valks10From: 0, // Disabled
				valks50From: 0,
				valks100From: 0,
				restorationFrom: 0,
			}

			const engine = new AwakeningEngine(config, 42)
			const result = engine.runFullSimulation(true)

			// No valks should be used when valks*From is 0
			expect(result.valks10Used).toBe(0)
			expect(result.valks50Used).toBe(0)
			expect(result.valks100Used).toBe(0)

			// Check that no step reports valks usage
			for (const step of result.steps || []) {
				expect(step.valksUsed).toBeNull()
			}
		})

		it('different restoration levels produce different costs', () => {
			// Test that restoration from different levels produces meaningful cost differences
			const numSims = 100
			const results: Record<number, number[]> = {}

			for (const restFrom of [4, 5, 6, 7]) {
				const config: SimulationConfig = {
					...DEFAULT_CONFIG,
					startLevel: 0,
					targetLevel: 9,
					restorationFrom: restFrom,
					useHepta: false,
					useOkta: false,
					valks10From: 0,
					valks50From: 0,
					valks100From: 0,
				}

				results[restFrom] = []
				for (let seed = 0; seed < numSims; seed++) {
					const engine = new AwakeningEngine(config, seed)
					const [, , silver] = engine.runFast()
					results[restFrom].push(silver)
				}
			}

			// Calculate medians
			const medians: Record<number, number> = {}
			for (const [level, silverArr] of Object.entries(results)) {
				const sorted = silverArr.slice().sort((a, b) => a - b)
				medians[Number(level)] = sorted[Math.floor(numSims * 0.5)]
			}

			// Each level should produce different median costs
			const medianValues = Object.values(medians)
			const uniqueMedians = new Set(medianValues)
			expect(uniqueMedians.size).toBe(4)
		})

		it('percentile calculation produces ordered results', () => {
			const config: SimulationConfig = {
				...DEFAULT_CONFIG,
				startLevel: 0,
				targetLevel: 9,
				restorationFrom: 6,
				useHepta: false,
				useOkta: false,
				valks10From: 0,
				valks50From: 0,
				valks100From: 0,
			}

			const silverResults: number[] = []
			const numSims = 200

			for (let seed = 0; seed < numSims; seed++) {
				const engine = new AwakeningEngine(config, seed)
				const [, , silver] = engine.runFast()
				silverResults.push(silver)
			}

			// Sort and get percentiles
			silverResults.sort((a, b) => a - b)
			const p50 = silverResults[Math.floor(numSims * 0.5)]
			const p90 = silverResults[Math.floor(numSims * 0.9)]
			const worst = silverResults[numSims - 1]

			// P50 < P90 < worst
			expect(p50).toBeLessThan(p90)
			expect(p90).toBeLessThan(worst)
		})

		it('simulation is deterministic with seed', () => {
			const config: SimulationConfig = {
				...DEFAULT_CONFIG,
				startLevel: 0,
				targetLevel: 9,
				restorationFrom: 6,
				useHepta: false,
				useOkta: false,
				valks10From: 0,
				valks50From: 0,
				valks100From: 0,
			}

			// Same seed should produce identical results
			for (let seed = 0; seed < 10; seed++) {
				const engine1 = new AwakeningEngine(config, seed)
				const [c1, s1, si1, e1] = engine1.runFast()

				const engine2 = new AwakeningEngine(config, seed)
				const [c2, s2, si2, e2] = engine2.runFast()

				expect(c1).toBe(c2)
				expect(s1).toBe(s2)
				expect(si1).toBe(si2)
				expect(e1).toBe(e2)
			}
		})

		it('restoration scrolls are consumed only on failures', () => {
			const config: SimulationConfig = {
				...DEFAULT_CONFIG,
				startLevel: 5,
				targetLevel: 6,
				restorationFrom: 5,
				useHepta: false,
				useOkta: false,
				valks10From: 0,
				valks50From: 0,
				valks100From: 0,
			}

			const engine = new AwakeningEngine(config, 42)
			const result = engine.runFullSimulation(true)

			// Count failures where restoration was attempted
			let restorationAttempts = 0
			for (const step of result.steps || []) {
				if (step.restorationAttempted) {
					restorationAttempts++
				}
			}

			// Each restoration attempt uses 200 scrolls
			expect(result.scrolls).toBe(restorationAttempts * 200)
		})
	})

	describe('statistical validation', () => {
		it('produces expected success rate for level I (~70%)', () => {
			const config: SimulationConfig = {
				...baseConfig,
				startLevel: 0,
				targetLevel: 1,
				restorationFrom: 0,
				valks10From: 0,
				valks50From: 0,
				valks100From: 0,
			}

			let successes = 0
			const trials = 1000

			for (let i = 0; i < trials; i++) {
				const engine = new AwakeningEngine(config, i)
				const step = engine.step()
				if (step.success) successes++
			}

			const rate = successes / trials
			// Should be close to 70% (within 5% margin for statistical variance)
			expect(rate).toBeGreaterThan(0.65)
			expect(rate).toBeLessThan(0.75)
		})

		it('produces expected Hepta/Okta success rate (~6%)', () => {
			expect(HEPTA_OKTA_SUCCESS_RATE).toBe(0.06)

			const config: SimulationConfig = {
				...baseConfig,
				startLevel: 7,
				targetLevel: 8,
				useHepta: true,
				restorationFrom: 0,
			}

			let successes = 0
			let attempts = 0

			// Run many simulations and count sub-enhancement successes
			for (let seed = 0; seed < 200; seed++) {
				const engine = new AwakeningEngine(config, seed)
				const result = engine.runFullSimulation(true)

				for (const step of result.steps || []) {
					if (step.isHeptaOkta && !step.anvilTriggered) {
						attempts++
						if (step.success) successes++
					}
				}
			}

			if (attempts > 100) {
				const rate = successes / attempts
				// Should be close to 6% (within 3% margin)
				expect(rate).toBeGreaterThan(0.03)
				expect(rate).toBeLessThan(0.09)
			}
		})
	})
})
