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

// Resource limits for strategy analysis
export type ResourceLimits = {
	crystals: number
	crystalsUnlimited: boolean
	scrolls: number
	scrollsUnlimited: boolean
	valks10: number
	valks10Unlimited: boolean
	valks50: number
	valks50Unlimited: boolean
	valks100: number
	valks100Unlimited: boolean
}

// Distribution data types for visualization
export type HistogramBucket = {
	min: number // Lower bound (silver)
	max: number // Upper bound (silver)
	count: number // Number of simulations in bucket
	cumulative: number // Cumulative count for CDF
	percentage: number // Percentage of total
	cumulativePercentage: number // Cumulative percentage for CDF
}

export type DistributionData = {
	buckets: HistogramBucket[]
	percentiles: {
		p10: number
		p25: number
		p50: number
		p75: number
		p90: number
		p95: number
	}
	stats: {
		min: number
		max: number
		mean: number
	}
	totalCount: number
}

/**
 * Generate histogram buckets from sorted silver values
 */
function generateDistribution(
	silverResults: Float64Array,
	sortedIndices: number[],
	numBuckets: number = 30,
): DistributionData {
	const count = sortedIndices.length
	if (count === 0) {
		return {
			buckets: [],
			percentiles: { p10: 0, p25: 0, p50: 0, p75: 0, p90: 0, p95: 0 },
			stats: { min: 0, max: 0, mean: 0 },
			totalCount: 0,
		}
	}

	const minVal = silverResults[sortedIndices[0]]
	const maxVal = silverResults[sortedIndices[count - 1]]

	// Calculate mean
	let sum = 0
	for (const idx of sortedIndices) {
		sum += silverResults[idx]
	}
	const mean = sum / count

	// Handle edge case where all values are the same
	const range = maxVal - minVal
	const bucketWidth = range === 0 ? 1 : range / numBuckets

	// Initialize buckets
	const bucketCounts = new Array(numBuckets).fill(0)

	// Fill buckets
	for (const idx of sortedIndices) {
		const value = silverResults[idx]
		let bucketIdx = Math.floor((value - minVal) / bucketWidth)
		// Ensure the max value goes into the last bucket
		if (bucketIdx >= numBuckets) bucketIdx = numBuckets - 1
		bucketCounts[bucketIdx]++
	}

	// Build bucket objects with cumulative data
	let cumulative = 0
	const buckets: HistogramBucket[] = bucketCounts.map((c, i) => {
		cumulative += c
		return {
			min: minVal + i * bucketWidth,
			max: minVal + (i + 1) * bucketWidth,
			count: c,
			cumulative,
			percentage: (c / count) * 100,
			cumulativePercentage: (cumulative / count) * 100,
		}
	})

	// Calculate percentiles
	const p10Idx = Math.min(Math.floor(count * 0.1), count - 1)
	const p25Idx = Math.min(Math.floor(count * 0.25), count - 1)
	const p50Idx = Math.min(Math.floor(count * 0.5), count - 1)
	const p75Idx = Math.min(Math.floor(count * 0.75), count - 1)
	const p90Idx = Math.min(Math.floor(count * 0.9), count - 1)
	const p95Idx = Math.min(Math.floor(count * 0.95), count - 1)

	return {
		buckets,
		percentiles: {
			p10: silverResults[sortedIndices[p10Idx]],
			p25: silverResults[sortedIndices[p25Idx]],
			p50: silverResults[sortedIndices[p50Idx]],
			p75: silverResults[sortedIndices[p75Idx]],
			p90: silverResults[sortedIndices[p90Idx]],
			p95: silverResults[sortedIndices[p95Idx]],
		},
		stats: { min: minVal, max: maxVal, mean },
		totalCount: count,
	}
}

// Request types
export type StrategyRequest =
	| {
			type: 'restoration'
			id: string
			config: SimulationConfig
			prices: MarketPrices
			numSimulations: number
			resourceLimits: ResourceLimits
	  }
	| {
			type: 'hepta-okta'
			id: string
			config: SimulationConfig
			prices: MarketPrices
			numSimulations: number
			resourceLimits: ResourceLimits
	  }

// Response types
export type RestorationResult = {
	restorationFrom: number
	label: string
	successRate: number // % of simulations that reached target
	p50: { crystals: number; scrolls: number; silver: number; valks10: number; valks50: number; valks100: number }
	p90: { crystals: number; scrolls: number; silver: number; valks10: number; valks50: number; valks100: number }
	worst: { crystals: number; scrolls: number; silver: number; valks10: number; valks50: number; valks100: number }
	distribution: DistributionData // Distribution of successful runs
	failedDistribution?: DistributionData // Distribution of failed runs (when resource-limited)
}

export type HeptaOktaResult = {
	useHepta: boolean
	useOkta: boolean
	label: string
	successRate: number
	p50: { crystals: number; scrolls: number; silver: number; exquisite: number; valks10: number; valks50: number; valks100: number }
	p90: { crystals: number; scrolls: number; silver: number; exquisite: number; valks10: number; valks50: number; valks100: number }
	worst: { crystals: number; scrolls: number; silver: number; exquisite: number; valks10: number; valks50: number; valks100: number }
	distribution: DistributionData
	failedDistribution?: DistributionData
}

export type StrategyResponse =
	| { type: 'progress'; id: string; progress: number }
	| { type: 'restoration-complete'; id: string; results: RestorationResult[] }
	| { type: 'hepta-okta-complete'; id: string; results: HeptaOktaResult[] }
	| { type: 'error'; id: string; error: string }

/**
 * Run restoration strategy analysis.
 * Tests different restoration starting levels and returns percentile costs.
 * Supports resource limits to calculate success rates.
 */
function runRestorationStrategy(
	config: SimulationConfig,
	prices: MarketPrices,
	numSims: number,
	id: string,
	resourceLimits: ResourceLimits,
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

	// Check if any limits are set
	const hasLimits =
		!resourceLimits.crystalsUnlimited ||
		!resourceLimits.scrollsUnlimited ||
		!resourceLimits.valks10Unlimited ||
		!resourceLimits.valks50Unlimited ||
		!resourceLimits.valks100Unlimited

	for (const restFrom of restorationOptions) {
		// Pre-allocate typed arrays for performance
		const silverResults = new Float64Array(numSims)
		const crystalResults = new Uint32Array(numSims)
		const scrollResults = new Uint32Array(numSims)
		const valks10Results = new Uint32Array(numSims)
		const valks50Results = new Uint32Array(numSims)
		const valks100Results = new Uint32Array(numSims)
		const successResults = new Uint8Array(numSims)

		// Create fresh config for this strategy - completely isolated
		// Use Valks from config since they're free (price=0) and reflect realistic gameplay
		const simConfig: SimulationConfig = {
			...config,
			startLevel: config.startLevel, // Respect the startLevel from config
			startHepta: 0,
			startOkta: 0,
			restorationFrom: restFrom,
			useHepta: false,
			useOkta: false,
			prices,
		}

		// Build limits object for simulation
		const limits = hasLimits
			? {
					crystals: resourceLimits.crystalsUnlimited ? undefined : resourceLimits.crystals,
					scrolls: resourceLimits.scrollsUnlimited ? undefined : resourceLimits.scrolls,
					valks10: resourceLimits.valks10Unlimited ? undefined : resourceLimits.valks10,
					valks50: resourceLimits.valks50Unlimited ? undefined : resourceLimits.valks50,
					valks100: resourceLimits.valks100Unlimited ? undefined : resourceLimits.valks100,
				}
			: undefined

		// Run simulations
		for (let i = 0; i < numSims; i++) {
			const engine = new AwakeningEngine(simConfig)

			if (limits) {
				const [crystals, scrolls, silver, , valks10, valks50, valks100, success] =
					engine.runFastWithLimits(limits)
				silverResults[i] = silver
				crystalResults[i] = crystals
				scrollResults[i] = scrolls
				valks10Results[i] = valks10
				valks50Results[i] = valks50
				valks100Results[i] = valks100
				successResults[i] = success
			} else {
				const [crystals, scrolls, silver, , valks10, valks50, valks100] = engine.runFast()
				silverResults[i] = silver
				crystalResults[i] = crystals
				scrollResults[i] = scrolls
				valks10Results[i] = valks10
				valks50Results[i] = valks50
				valks100Results[i] = valks100
				successResults[i] = 1 // Always successful with unlimited resources
			}

			completed++
			if (completed % UI_CONSTANTS.PROGRESS_REPORT_INTERVAL === 0) {
				self.postMessage({
					type: 'progress',
					id,
					progress: (completed / totalRuns) * 100,
				} satisfies StrategyResponse)
			}
		}

		// Calculate success rate
		let successCount = 0
		for (let i = 0; i < numSims; i++) {
			successCount += successResults[i]
		}
		const successRate = (successCount / numSims) * 100

		// Sort indices by silver for percentile calculation (only successful runs)
		const successfulIndices: number[] = []
		const failedIndices: number[] = []
		for (let i = 0; i < numSims; i++) {
			if (successResults[i] === 1) {
				successfulIndices.push(i)
			} else {
				failedIndices.push(i)
			}
		}
		successfulIndices.sort((a, b) => silverResults[a] - silverResults[b])
		failedIndices.sort((a, b) => silverResults[a] - silverResults[b])

		// If no successful runs, use all runs sorted by silver
		const indices =
			successfulIndices.length > 0
				? successfulIndices
				: Array.from({ length: numSims }, (_, i) => i).sort(
						(a, b) => silverResults[a] - silverResults[b],
					)

		// Calculate percentile indices with bounds check
		const numSuccessful = indices.length
		const p50Idx = Math.min(Math.floor(numSuccessful * 0.5), numSuccessful - 1)
		const p90Idx = Math.min(Math.floor(numSuccessful * 0.9), numSuccessful - 1)
		const worstIdx = numSuccessful - 1

		// Generate distribution data
		const distribution = generateDistribution(silverResults, successfulIndices)
		const failedDistribution =
			failedIndices.length > 0 ? generateDistribution(silverResults, failedIndices) : undefined

		results.push({
			restorationFrom: restFrom,
			label: `+${ROMAN_NUMERALS[restFrom]}`,
			successRate,
			p50: {
				crystals: crystalResults[indices[p50Idx]],
				scrolls: scrollResults[indices[p50Idx]],
				silver: silverResults[indices[p50Idx]],
				valks10: valks10Results[indices[p50Idx]],
				valks50: valks50Results[indices[p50Idx]],
				valks100: valks100Results[indices[p50Idx]],
			},
			p90: {
				crystals: crystalResults[indices[p90Idx]],
				scrolls: scrollResults[indices[p90Idx]],
				silver: silverResults[indices[p90Idx]],
				valks10: valks10Results[indices[p90Idx]],
				valks50: valks50Results[indices[p90Idx]],
				valks100: valks100Results[indices[p90Idx]],
			},
			worst: {
				crystals: crystalResults[indices[worstIdx]],
				scrolls: scrollResults[indices[worstIdx]],
				silver: silverResults[indices[worstIdx]],
				valks10: valks10Results[indices[worstIdx]],
				valks50: valks50Results[indices[worstIdx]],
				valks100: valks100Results[indices[worstIdx]],
			},
			distribution,
			failedDistribution,
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
	resourceLimits: ResourceLimits,
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

	// Check if any limits are set
	const hasLimits =
		!resourceLimits.crystalsUnlimited ||
		!resourceLimits.scrollsUnlimited ||
		!resourceLimits.valks10Unlimited ||
		!resourceLimits.valks50Unlimited ||
		!resourceLimits.valks100Unlimited

	for (const { useHepta, useOkta, label } of strategies) {
		// Pre-allocate typed arrays for performance
		const silverResults = new Float64Array(numSims)
		const crystalResults = new Uint32Array(numSims)
		const scrollResults = new Uint32Array(numSims)
		const exquisiteResults = new Uint32Array(numSims)
		const valks10Results = new Uint32Array(numSims)
		const valks50Results = new Uint32Array(numSims)
		const valks100Results = new Uint32Array(numSims)
		const successResults = new Uint8Array(numSims)

		// Create fresh config for this strategy - completely isolated
		// Use Valks from config since they're free (price=0) and reflect realistic gameplay
		// NOTE: startLevel fixed at 0 for standardized hepta/okta cost comparison
		// (unlike restoration strategy which respects user's starting level)
		const simConfig: SimulationConfig = {
			...config,
			startLevel: 0,
			startHepta: 0,
			startOkta: 0,
			restorationFrom: 6, // Fixed at VI for hepta/okta comparison
			useHepta,
			useOkta,
			prices,
		}

		// Build limits object for simulation
		const limits = hasLimits
			? {
					crystals: resourceLimits.crystalsUnlimited ? undefined : resourceLimits.crystals,
					scrolls: resourceLimits.scrollsUnlimited ? undefined : resourceLimits.scrolls,
					valks10: resourceLimits.valks10Unlimited ? undefined : resourceLimits.valks10,
					valks50: resourceLimits.valks50Unlimited ? undefined : resourceLimits.valks50,
					valks100: resourceLimits.valks100Unlimited ? undefined : resourceLimits.valks100,
				}
			: undefined

		// Run simulations
		for (let i = 0; i < numSims; i++) {
			const engine = new AwakeningEngine(simConfig)

			if (limits) {
				const [crystals, scrolls, silver, exquisite, valks10, valks50, valks100, success] =
					engine.runFastWithLimits(limits)
				silverResults[i] = silver
				crystalResults[i] = crystals
				scrollResults[i] = scrolls
				exquisiteResults[i] = exquisite
				valks10Results[i] = valks10
				valks50Results[i] = valks50
				valks100Results[i] = valks100
				successResults[i] = success
			} else {
				const [crystals, scrolls, silver, exquisite, valks10, valks50, valks100] = engine.runFast()
				silverResults[i] = silver
				crystalResults[i] = crystals
				scrollResults[i] = scrolls
				exquisiteResults[i] = exquisite
				valks10Results[i] = valks10
				valks50Results[i] = valks50
				valks100Results[i] = valks100
				successResults[i] = 1
			}

			completed++
			if (completed % UI_CONSTANTS.PROGRESS_REPORT_INTERVAL === 0) {
				self.postMessage({
					type: 'progress',
					id,
					progress: (completed / totalRuns) * 100,
				} satisfies StrategyResponse)
			}
		}

		// Calculate success rate
		let successCount = 0
		for (let i = 0; i < numSims; i++) {
			successCount += successResults[i]
		}
		const successRate = (successCount / numSims) * 100

		// Sort indices by silver for percentile calculation (only successful runs)
		const successfulIndices: number[] = []
		const failedIndices: number[] = []
		for (let i = 0; i < numSims; i++) {
			if (successResults[i] === 1) {
				successfulIndices.push(i)
			} else {
				failedIndices.push(i)
			}
		}
		successfulIndices.sort((a, b) => silverResults[a] - silverResults[b])
		failedIndices.sort((a, b) => silverResults[a] - silverResults[b])

		const indices =
			successfulIndices.length > 0
				? successfulIndices
				: Array.from({ length: numSims }, (_, i) => i).sort(
						(a, b) => silverResults[a] - silverResults[b],
					)

		// Calculate percentile indices with bounds check
		const numSuccessful = indices.length
		const p50Idx = Math.min(Math.floor(numSuccessful * 0.5), numSuccessful - 1)
		const p90Idx = Math.min(Math.floor(numSuccessful * 0.9), numSuccessful - 1)
		const worstIdx = numSuccessful - 1

		// Generate distribution data
		const distribution = generateDistribution(silverResults, successfulIndices)
		const failedDistribution =
			failedIndices.length > 0 ? generateDistribution(silverResults, failedIndices) : undefined

		results.push({
			useHepta,
			useOkta,
			label,
			successRate,
			p50: {
				crystals: crystalResults[indices[p50Idx]],
				scrolls: scrollResults[indices[p50Idx]],
				silver: silverResults[indices[p50Idx]],
				exquisite: exquisiteResults[indices[p50Idx]],
				valks10: valks10Results[indices[p50Idx]],
				valks50: valks50Results[indices[p50Idx]],
				valks100: valks100Results[indices[p50Idx]],
			},
			p90: {
				crystals: crystalResults[indices[p90Idx]],
				scrolls: scrollResults[indices[p90Idx]],
				silver: silverResults[indices[p90Idx]],
				exquisite: exquisiteResults[indices[p90Idx]],
				valks10: valks10Results[indices[p90Idx]],
				valks50: valks50Results[indices[p90Idx]],
				valks100: valks100Results[indices[p90Idx]],
			},
			worst: {
				crystals: crystalResults[indices[worstIdx]],
				scrolls: scrollResults[indices[worstIdx]],
				silver: silverResults[indices[worstIdx]],
				exquisite: exquisiteResults[indices[worstIdx]],
				valks10: valks10Results[indices[worstIdx]],
				valks50: valks50Results[indices[worstIdx]],
				valks100: valks100Results[indices[worstIdx]],
			},
			distribution,
			failedDistribution,
		})
	}

	return results
}

// Message handler
self.onmessage = (event: MessageEvent<StrategyRequest>) => {
	const { type, id, config, prices, numSimulations, resourceLimits } = event.data

	try {
		if (type === 'restoration') {
			const results = runRestorationStrategy(config, prices, numSimulations, id, resourceLimits)
			self.postMessage({
				type: 'restoration-complete',
				id,
				results,
			} satisfies StrategyResponse)
		} else if (type === 'hepta-okta') {
			const results = runHeptaOktaStrategy(config, prices, numSimulations, id, resourceLimits)
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
