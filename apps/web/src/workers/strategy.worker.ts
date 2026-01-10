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

// Survival curve data point for visualizing success probability at different budget levels
export type SurvivalCurvePoint = {
	silver: number
	successProbability: number
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

/**
 * Generate survival curve data showing probability of success at different budget levels.
 * Uses pre-sorted indices for efficiency.
 */
function generateSurvivalCurve(
	silverResults: Float64Array,
	successResults: Uint8Array,
	sortedIndices: number[], // Pre-sorted by silver cost
	numPoints: number = 50,
): SurvivalCurvePoint[] {
	const numSims = sortedIndices.length
	if (numSims === 0) return []

	const minSilver = silverResults[sortedIndices[0]]
	const maxSilver = silverResults[sortedIndices[numSims - 1]]

	// Handle edge case where all values are the same
	if (minSilver === maxSilver) {
		let successCount = 0
		for (let i = 0; i < numSims; i++) {
			successCount += successResults[i]
		}
		return [{ silver: minSilver, successProbability: (successCount / numSims) * 100 }]
	}

	const step = (maxSilver - minSilver) / (numPoints - 1)
	const curve: SurvivalCurvePoint[] = []

	// Build cumulative success count using sorted order (O(n) instead of O(n*numPoints))
	let cumulativeSuccess = 0
	let sortedIdx = 0

	for (let i = 0; i < numPoints; i++) {
		const budgetLevel = minSilver + step * i

		// Advance through sorted indices until we pass the budget level
		while (sortedIdx < numSims && silverResults[sortedIndices[sortedIdx]] <= budgetLevel) {
			cumulativeSuccess += successResults[sortedIndices[sortedIdx]]
			sortedIdx++
		}

		curve.push({
			silver: budgetLevel,
			successProbability: (cumulativeSuccess / numSims) * 100,
		})
	}

	return curve
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
	p50: {
		crystals: number
		scrolls: number
		silver: number
		valks10: number
		valks50: number
		valks100: number
	}
	p90: {
		crystals: number
		scrolls: number
		silver: number
		valks10: number
		valks50: number
		valks100: number
	}
	worst: {
		crystals: number
		scrolls: number
		silver: number
		valks10: number
		valks50: number
		valks100: number
	}
	distribution: DistributionData // Distribution of successful runs
	failedDistribution?: DistributionData // Distribution of failed runs (when resource-limited)
	// Risk-adjusted metrics for limited resources
	expectedCostPerSuccess: number // Mean all runs / success rate - true expected spending
	expectedAttempts: number // 1 / (success rate / 100) - expected number of tries
	meanCostAllRuns: number // Mean silver across ALL runs (successful + failed)
	meanCostSuccessful: number // Mean silver of successful runs only
	survivalCurve?: SurvivalCurvePoint[] // Success probability at different budget levels
}

export type HeptaOktaResult = {
	useHepta: boolean
	useOkta: boolean
	label: string
	successRate: number
	p50: {
		crystals: number
		scrolls: number
		silver: number
		exquisite: number
		valks10: number
		valks50: number
		valks100: number
	}
	p90: {
		crystals: number
		scrolls: number
		silver: number
		exquisite: number
		valks10: number
		valks50: number
		valks100: number
	}
	worst: {
		crystals: number
		scrolls: number
		silver: number
		exquisite: number
		valks10: number
		valks50: number
		valks100: number
	}
	distribution: DistributionData
	failedDistribution?: DistributionData
	// Risk-adjusted metrics for limited resources
	expectedCostPerSuccess: number
	expectedAttempts: number
	meanCostAllRuns: number
	meanCostSuccessful: number
	survivalCurve?: SurvivalCurvePoint[]
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

		// Calculate mean of ALL runs (successful + failed) for risk-adjusted metrics
		let totalSilver = 0
		for (let i = 0; i < numSims; i++) {
			totalSilver += silverResults[i]
		}
		const meanCostAllRuns = totalSilver / numSims

		// Sort ALL indices by silver once - used for percentiles, distribution, and survival curve
		const allIndices = Array.from({ length: numSims }, (_, i) => i).sort(
			(a, b) => silverResults[a] - silverResults[b],
		)

		// Separate successful and failed indices (need sorting only for failed distribution)
		const failedIndices: number[] = []
		let successSilver = 0
		for (let i = 0; i < numSims; i++) {
			if (successResults[i] === 1) {
				successSilver += silverResults[i]
			} else {
				failedIndices.push(i)
			}
		}
		const meanCostSuccessful = successCount > 0 ? successSilver / successCount : 0

		// Only sort failed indices if we need the failed distribution
		if (failedIndices.length > 0) {
			failedIndices.sort((a, b) => silverResults[a] - silverResults[b])
		}

		// Expected cost per success = total expected spending / probability of success
		const expectedCostPerSuccess =
			successRate > 0 ? meanCostAllRuns / (successRate / 100) : Number.POSITIVE_INFINITY

		// Expected number of attempts to succeed
		const expectedAttempts = successRate > 0 ? 100 / successRate : Number.POSITIVE_INFINITY

		// Calculate percentile indices using ALL runs
		const p50Idx = Math.min(Math.floor(numSims * 0.5), numSims - 1)
		const p90Idx = Math.min(Math.floor(numSims * 0.9), numSims - 1)
		const worstIdx = numSims - 1

		// Generate survival curve using pre-sorted indices (only when success < 100%)
		const survivalCurve =
			successRate < 100
				? generateSurvivalCurve(silverResults, successResults, allIndices)
				: undefined

		// Generate unified distribution data (all runs together)
		const distribution = generateDistribution(silverResults, allIndices)
		const failedDistribution =
			failedIndices.length > 0 ? generateDistribution(silverResults, failedIndices) : undefined

		results.push({
			restorationFrom: restFrom,
			label: `+${ROMAN_NUMERALS[restFrom]}`,
			successRate,
			p50: {
				crystals: crystalResults[allIndices[p50Idx]],
				scrolls: scrollResults[allIndices[p50Idx]],
				silver: silverResults[allIndices[p50Idx]],
				valks10: valks10Results[allIndices[p50Idx]],
				valks50: valks50Results[allIndices[p50Idx]],
				valks100: valks100Results[allIndices[p50Idx]],
			},
			p90: {
				crystals: crystalResults[allIndices[p90Idx]],
				scrolls: scrollResults[allIndices[p90Idx]],
				silver: silverResults[allIndices[p90Idx]],
				valks10: valks10Results[allIndices[p90Idx]],
				valks50: valks50Results[allIndices[p90Idx]],
				valks100: valks100Results[allIndices[p90Idx]],
			},
			worst: {
				crystals: crystalResults[allIndices[worstIdx]],
				scrolls: scrollResults[allIndices[worstIdx]],
				silver: silverResults[allIndices[worstIdx]],
				valks10: valks10Results[allIndices[worstIdx]],
				valks50: valks50Results[allIndices[worstIdx]],
				valks100: valks100Results[allIndices[worstIdx]],
			},
			distribution,
			failedDistribution,
			// Risk-adjusted metrics
			expectedCostPerSuccess,
			expectedAttempts,
			meanCostAllRuns,
			meanCostSuccessful,
			survivalCurve,
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

		// Calculate mean of ALL runs (successful + failed) for risk-adjusted metrics
		let totalSilver = 0
		for (let i = 0; i < numSims; i++) {
			totalSilver += silverResults[i]
		}
		const meanCostAllRuns = totalSilver / numSims

		// Sort ALL indices by silver once - used for percentiles, distribution, and survival curve
		const allIndices = Array.from({ length: numSims }, (_, i) => i).sort(
			(a, b) => silverResults[a] - silverResults[b],
		)

		// Separate failed indices and calculate mean of successful runs
		const failedIndices: number[] = []
		let successSilver = 0
		for (let i = 0; i < numSims; i++) {
			if (successResults[i] === 1) {
				successSilver += silverResults[i]
			} else {
				failedIndices.push(i)
			}
		}
		const meanCostSuccessful = successCount > 0 ? successSilver / successCount : 0

		// Only sort failed indices if we need the failed distribution
		if (failedIndices.length > 0) {
			failedIndices.sort((a, b) => silverResults[a] - silverResults[b])
		}

		// Expected cost per success = total expected spending / probability of success
		const expectedCostPerSuccess =
			successRate > 0 ? meanCostAllRuns / (successRate / 100) : Number.POSITIVE_INFINITY

		// Expected number of attempts to succeed
		const expectedAttempts = successRate > 0 ? 100 / successRate : Number.POSITIVE_INFINITY

		// Calculate percentile indices using ALL runs
		const p50Idx = Math.min(Math.floor(numSims * 0.5), numSims - 1)
		const p90Idx = Math.min(Math.floor(numSims * 0.9), numSims - 1)
		const worstIdx = numSims - 1

		// Generate survival curve using pre-sorted indices (only when success < 100%)
		const survivalCurve =
			successRate < 100
				? generateSurvivalCurve(silverResults, successResults, allIndices)
				: undefined

		// Generate unified distribution data (all runs together)
		const distribution = generateDistribution(silverResults, allIndices)
		const failedDistribution =
			failedIndices.length > 0 ? generateDistribution(silverResults, failedIndices) : undefined

		results.push({
			useHepta,
			useOkta,
			label,
			successRate,
			p50: {
				crystals: crystalResults[allIndices[p50Idx]],
				scrolls: scrollResults[allIndices[p50Idx]],
				silver: silverResults[allIndices[p50Idx]],
				exquisite: exquisiteResults[allIndices[p50Idx]],
				valks10: valks10Results[allIndices[p50Idx]],
				valks50: valks50Results[allIndices[p50Idx]],
				valks100: valks100Results[allIndices[p50Idx]],
			},
			p90: {
				crystals: crystalResults[allIndices[p90Idx]],
				scrolls: scrollResults[allIndices[p90Idx]],
				silver: silverResults[allIndices[p90Idx]],
				exquisite: exquisiteResults[allIndices[p90Idx]],
				valks10: valks10Results[allIndices[p90Idx]],
				valks50: valks50Results[allIndices[p90Idx]],
				valks100: valks100Results[allIndices[p90Idx]],
			},
			worst: {
				crystals: crystalResults[allIndices[worstIdx]],
				scrolls: scrollResults[allIndices[worstIdx]],
				silver: silverResults[allIndices[worstIdx]],
				exquisite: exquisiteResults[allIndices[worstIdx]],
				valks10: valks10Results[allIndices[worstIdx]],
				valks50: valks50Results[allIndices[worstIdx]],
				valks100: valks100Results[allIndices[worstIdx]],
			},
			distribution,
			failedDistribution,
			// Risk-adjusted metrics
			expectedCostPerSuccess,
			expectedAttempts,
			meanCostAllRuns,
			meanCostSuccessful,
			survivalCurve,
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
