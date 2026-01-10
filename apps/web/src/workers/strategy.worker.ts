/**
 * Web Worker for strategy finder simulations.
 * Runs Monte Carlo simulations in complete isolation from the main thread.
 * This prevents any state interference with the UI simulation.
 */
import {
	AwakeningEngine,
	type MarketPrices,
	ROMAN_NUMERALS,
	type SimulationConfig,
	UI_CONSTANTS,
} from '@bdm-sim/simulator'

// Request types
export type StrategyRequest =
	| {
			type: 'restoration'
			id: string
			config: SimulationConfig
			prices: MarketPrices
			numSimulations: number
	  }
	| {
			type: 'hepta-okta'
			id: string
			config: SimulationConfig
			prices: MarketPrices
			numSimulations: number
	  }

// Response types
export type RestorationResult = {
	restorationFrom: number
	label: string
	p50: { crystals: number; scrolls: number; silver: number }
	p90: { crystals: number; scrolls: number; silver: number }
	worst: { crystals: number; scrolls: number; silver: number }
}

export type HeptaOktaResult = {
	useHepta: boolean
	useOkta: boolean
	label: string
	p50: { crystals: number; scrolls: number; silver: number; exquisite: number }
	p90: { crystals: number; scrolls: number; silver: number; exquisite: number }
	worst: { crystals: number; scrolls: number; silver: number; exquisite: number }
}

export type StrategyResponse =
	| { type: 'progress'; id: string; progress: number }
	| { type: 'restoration-complete'; id: string; results: RestorationResult[] }
	| { type: 'hepta-okta-complete'; id: string; results: HeptaOktaResult[] }
	| { type: 'error'; id: string; error: string }

/**
 * Run restoration strategy analysis.
 * Tests different restoration starting levels and returns percentile costs.
 */
function runRestorationStrategy(
	config: SimulationConfig,
	prices: MarketPrices,
	numSims: number,
	id: string,
): RestorationResult[] {
	const targetLevel = config.targetLevel
	const startLevel = config.startLevel

	// Test restoration from max(IV, startLevel+1) to target-1
	// Restoration only makes sense for levels above where we start
	const minRestoration = Math.max(4, startLevel + 1)
	const restorationOptions: number[] = []
	for (let i = minRestoration; i < targetLevel; i++) {
		restorationOptions.push(i)
	}

	const results: RestorationResult[] = []
	const totalRuns = restorationOptions.length * numSims
	let completed = 0

	for (const restFrom of restorationOptions) {
		// Pre-allocate typed arrays for performance
		const silverResults = new Float64Array(numSims)
		const crystalResults = new Uint32Array(numSims)
		const scrollResults = new Uint32Array(numSims)

		// Create fresh config for this strategy - completely isolated
		// IMPORTANT: Disable valks to get accurate restoration-only cost comparison
		// Valks have 0 price but boost success rates, which would skew results
		const simConfig: SimulationConfig = {
			...config,
			startLevel: config.startLevel, // Respect the startLevel from config
			startHepta: 0,
			startOkta: 0,
			restorationFrom: restFrom,
			useHepta: false,
			useOkta: false,
			valks10From: 0,
			valks50From: 0,
			valks100From: 0,
			prices,
		}

		// Run simulations
		for (let i = 0; i < numSims; i++) {
			const engine = new AwakeningEngine(simConfig)
			const [crystals, scrolls, silver] = engine.runFast()

			silverResults[i] = silver
			crystalResults[i] = crystals
			scrollResults[i] = scrolls

			completed++
			if (completed % UI_CONSTANTS.PROGRESS_REPORT_INTERVAL === 0) {
				self.postMessage({
					type: 'progress',
					id,
					progress: (completed / totalRuns) * 100,
				} satisfies StrategyResponse)
			}
		}

		// Sort indices by silver for percentile calculation
		const indices = Array.from({ length: numSims }, (_, i) => i)
		indices.sort((a, b) => silverResults[a] - silverResults[b])

		// Calculate percentile indices with bounds check
		const p50Idx = Math.min(Math.floor(numSims * 0.5), numSims - 1)
		const p90Idx = Math.min(Math.floor(numSims * 0.9), numSims - 1)
		const worstIdx = numSims - 1

		results.push({
			restorationFrom: restFrom,
			label: `+${ROMAN_NUMERALS[restFrom]}`,
			p50: {
				crystals: crystalResults[indices[p50Idx]],
				scrolls: scrollResults[indices[p50Idx]],
				silver: silverResults[indices[p50Idx]],
			},
			p90: {
				crystals: crystalResults[indices[p90Idx]],
				scrolls: scrollResults[indices[p90Idx]],
				silver: silverResults[indices[p90Idx]],
			},
			worst: {
				crystals: crystalResults[indices[worstIdx]],
				scrolls: scrollResults[indices[worstIdx]],
				silver: silverResults[indices[worstIdx]],
			},
		})
	}

	return results
}

/**
 * Run Hepta/Okta strategy analysis.
 * Compares different combinations of Hepta and Okta paths.
 */
function runHeptaOktaStrategy(
	config: SimulationConfig,
	prices: MarketPrices,
	numSims: number,
	id: string,
): HeptaOktaResult[] {
	const strategies = [
		{ useHepta: true, useOkta: true, label: 'Hepta+Okta' },
		{ useHepta: true, useOkta: false, label: 'Hepta only' },
		{ useHepta: false, useOkta: true, label: 'Okta only' },
		{ useHepta: false, useOkta: false, label: 'Normal' },
	]

	const results: HeptaOktaResult[] = []
	const totalRuns = strategies.length * numSims
	let completed = 0

	for (const { useHepta, useOkta, label } of strategies) {
		// Pre-allocate typed arrays for performance
		const silverResults = new Float64Array(numSims)
		const crystalResults = new Uint32Array(numSims)
		const scrollResults = new Uint32Array(numSims)
		const exquisiteResults = new Uint32Array(numSims)

		// Create fresh config for this strategy - completely isolated
		// IMPORTANT: Disable valks to get accurate hepta/okta cost comparison
		// Valks have 0 price but boost success rates, which would skew results
		const simConfig: SimulationConfig = {
			...config,
			startLevel: 0,
			startHepta: 0,
			startOkta: 0,
			restorationFrom: 6, // Fixed at VI for hepta/okta comparison
			useHepta,
			useOkta,
			valks10From: 0,
			valks50From: 0,
			valks100From: 0,
			prices,
		}

		// Run simulations
		for (let i = 0; i < numSims; i++) {
			const engine = new AwakeningEngine(simConfig)
			const [crystals, scrolls, silver, exquisite] = engine.runFast()

			silverResults[i] = silver
			crystalResults[i] = crystals
			scrollResults[i] = scrolls
			exquisiteResults[i] = exquisite

			completed++
			if (completed % UI_CONSTANTS.PROGRESS_REPORT_INTERVAL === 0) {
				self.postMessage({
					type: 'progress',
					id,
					progress: (completed / totalRuns) * 100,
				} satisfies StrategyResponse)
			}
		}

		// Sort indices by silver for percentile calculation
		const indices = Array.from({ length: numSims }, (_, i) => i)
		indices.sort((a, b) => silverResults[a] - silverResults[b])

		// Calculate percentile indices with bounds check
		const p50Idx = Math.min(Math.floor(numSims * 0.5), numSims - 1)
		const p90Idx = Math.min(Math.floor(numSims * 0.9), numSims - 1)
		const worstIdx = numSims - 1

		results.push({
			useHepta,
			useOkta,
			label,
			p50: {
				crystals: crystalResults[indices[p50Idx]],
				scrolls: scrollResults[indices[p50Idx]],
				silver: silverResults[indices[p50Idx]],
				exquisite: exquisiteResults[indices[p50Idx]],
			},
			p90: {
				crystals: crystalResults[indices[p90Idx]],
				scrolls: scrollResults[indices[p90Idx]],
				silver: silverResults[indices[p90Idx]],
				exquisite: exquisiteResults[indices[p90Idx]],
			},
			worst: {
				crystals: crystalResults[indices[worstIdx]],
				scrolls: scrollResults[indices[worstIdx]],
				silver: silverResults[indices[worstIdx]],
				exquisite: exquisiteResults[indices[worstIdx]],
			},
		})
	}

	return results
}

// Message handler
self.onmessage = (event: MessageEvent<StrategyRequest>) => {
	const { type, id, config, prices, numSimulations } = event.data

	try {
		if (type === 'restoration') {
			const results = runRestorationStrategy(config, prices, numSimulations, id)
			self.postMessage({
				type: 'restoration-complete',
				id,
				results,
			} satisfies StrategyResponse)
		} else if (type === 'hepta-okta') {
			const results = runHeptaOktaStrategy(config, prices, numSimulations, id)
			self.postMessage({
				type: 'hepta-okta-complete',
				id,
				results,
			} satisfies StrategyResponse)
		}
	} catch (error) {
		self.postMessage({
			type: 'error',
			id,
			error: error instanceof Error ? error.message : String(error),
		} satisfies StrategyResponse)
	}
}
