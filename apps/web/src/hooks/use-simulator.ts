import {
	type EnhancementStrategy,
	type GearState,
	type MonteCarloResult,
	type RestorationStrategy,
	type SimulationResult,
	type ValksStrategy,
	AwakeningSimulator,
	DEFAULT_PRICES,
	DEFAULT_STRATEGY,
	createGearState,
} from '@bdm-sim/simulator'
import { create } from 'zustand'

interface SimulatorState {
	// Configuration
	targetLevel: number
	strategy: EnhancementStrategy
	prices: Record<string, number>

	// Simulation state
	isRunning: boolean
	isPaused: boolean
	progress: number
	currentResult: SimulationResult | null
	monteCarloResult: MonteCarloResult | null
	gearState: GearState

	// Actions
	setTargetLevel: (level: number) => void
	setStrategy: (strategy: Partial<EnhancementStrategy>) => void
	setRestoration: (restoration: RestorationStrategy) => void
	setValks: (valks: ValksStrategy) => void
	setPrice: (material: string, price: number) => void
	runSimulation: () => Promise<void>
	runMonteCarlo: (numSimulations: number) => Promise<void>
	stopSimulation: () => void
	reset: () => void
}

export const useSimulator = create<SimulatorState>((set, get) => ({
	// Initial state
	targetLevel: 5,
	strategy: { ...DEFAULT_STRATEGY },
	prices: { ...DEFAULT_PRICES },
	isRunning: false,
	isPaused: false,
	progress: 0,
	currentResult: null,
	monteCarloResult: null,
	gearState: createGearState(),

	// Actions
	setTargetLevel: (level) => set({ targetLevel: level }),

	setStrategy: (partial) =>
		set((state) => ({
			strategy: { ...state.strategy, ...partial },
		})),

	setRestoration: (restoration) =>
		set((state) => ({
			strategy: { ...state.strategy, restoration },
		})),

	setValks: (valks) =>
		set((state) => ({
			strategy: { ...state.strategy, valks },
		})),

	setPrice: (material, price) =>
		set((state) => ({
			prices: { ...state.prices, [material]: price },
		})),

	runSimulation: async () => {
		const { targetLevel, strategy, prices } = get()

		set({ isRunning: true, progress: 0, currentResult: null })

		// Run in a microtask to not block UI
		await new Promise((resolve) => setTimeout(resolve, 0))

		const simulator = new AwakeningSimulator(undefined, prices)
		const result = simulator.simulateToTarget(targetLevel, strategy, undefined, 100_000, true)

		set({
			isRunning: false,
			progress: 100,
			currentResult: result,
			gearState: createGearState(targetLevel),
		})
	},

	runMonteCarlo: async (numSimulations) => {
		const { targetLevel, strategy, prices } = get()

		set({ isRunning: true, progress: 0, monteCarloResult: null })

		const simulator = new AwakeningSimulator(undefined, prices)

		// Run Monte Carlo in chunks to not block UI
		const chunkSize = 100
		const results: SimulationResult[] = []

		for (let i = 0; i < numSimulations; i += chunkSize) {
			// Check if stopped
			if (!get().isRunning) break

			// Run chunk
			const end = Math.min(i + chunkSize, numSimulations)
			for (let j = i; j < end; j++) {
				const result = simulator.simulateToTarget(targetLevel, strategy)
				results.push(result)
			}

			// Update progress
			set({ progress: (end / numSimulations) * 100 })

			// Yield to UI
			await new Promise((resolve) => setTimeout(resolve, 0))
		}

		if (get().isRunning) {
			// Calculate statistics
			const mcResult = calculateStats(results, targetLevel, strategy)
			set({ monteCarloResult: mcResult, isRunning: false, progress: 100 })
		}
	},

	stopSimulation: () => set({ isRunning: false }),

	reset: () =>
		set({
			currentResult: null,
			monteCarloResult: null,
			gearState: createGearState(),
			progress: 0,
		}),
}))

// Helper to calculate Monte Carlo statistics
function calculateStats(
	results: SimulationResult[],
	targetLevel: number,
	strategy: EnhancementStrategy
): MonteCarloResult {
	const attempts = results.map((r) => r.totalAttempts).sort((a, b) => a - b)
	const silverCosts = results.map((r) => r.silverCost).sort((a, b) => a - b)
	const crystals = results
		.map((r) => r.materialsUsed.pristine_black_crystal ?? 0)
		.sort((a, b) => a - b)
	const scrolls = results.map((r) => r.materialsUsed.restoration_scroll ?? 0).sort((a, b) => a - b)
	const levelDrops = results.map((r) => r.levelDrops).sort((a, b) => a - b)
	const anvilTriggers = results.map((r) => r.anvilTriggers).sort((a, b) => a - b)

	const percentile = (arr: number[], p: number) => {
		const idx = Math.floor(arr.length * p)
		return arr[Math.min(idx, arr.length - 1)] ?? 0
	}

	const average = (arr: number[]) => (arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0)

	const calcPercentiles = (arr: number[]) => ({
		average: average(arr),
		p50: percentile(arr, 0.5),
		p90: percentile(arr, 0.9),
		p99: percentile(arr, 0.99),
		worst: arr[arr.length - 1] ?? 0,
	})

	return {
		numSimulations: results.length,
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
