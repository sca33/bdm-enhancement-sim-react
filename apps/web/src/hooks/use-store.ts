import {
	type MarketPrices,
	type SimulationConfig,
	type SimulationResult,
	type StepResult,
	AwakeningEngine,
	DEFAULT_CONFIG,
	DEFAULT_PRICES,
	ROMAN_NUMERALS,
} from '@bdm-sim/simulator'
import LZString from 'lz-string'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Page = 'home' | 'awakening-config' | 'simulation' | 'restoration-strategy' | 'hepta-okta-strategy'

export type SimulationSpeed = 'instant' | 'fast' | 'regular'

// Saved simulation run
export interface SavedRun {
	id: string
	timestamp: number
	targetLevel: number
	silver: number
	attempts: number
	pinned: boolean
	// Compressed step history
	stepsCompressed: string
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

const SAVED_RUNS_KEY = 'bdm-sim-saved-runs'
const MAX_SAVED_RUNS = 50

function loadSavedRuns(): SavedRun[] {
	try {
		const data = localStorage.getItem(SAVED_RUNS_KEY)
		if (data) {
			return JSON.parse(data)
		}
	} catch (e) {
		console.error('Failed to load saved runs:', e)
	}
	return []
}

function persistSavedRuns(runs: SavedRun[]) {
	try {
		localStorage.setItem(SAVED_RUNS_KEY, JSON.stringify(runs))
	} catch (e) {
		console.error('Failed to save runs:', e)
	}
}

interface AppState {
	// Navigation
	currentPage: Page
	setPage: (page: Page) => void

	// Market prices (persisted)
	prices: MarketPrices
	setPrice: <K extends keyof MarketPrices>(key: K, value: number) => void

	// Simulation config
	config: SimulationConfig
	setConfig: (partial: Partial<SimulationConfig>) => void
	resetConfig: () => void

	// Simulation speed
	speed: SimulationSpeed
	setSpeed: (speed: SimulationSpeed) => void

	// Number of Monte Carlo simulations
	numSimulations: number
	setNumSimulations: (num: number) => void

	// Simulation state
	isRunning: boolean
	isPaused: boolean
	currentLevel: number
	maxLevel: number
	attempts: number
	anvilEnergy: Record<number, number>
	levelSuccesses: Record<number, number>
	heptaProgress: number
	oktaProgress: number
	heptaPity: number
	oktaPity: number
	stats: {
		crystals: number
		scrolls: number
		silver: number
		exquisiteCrystals: number
		valks10Used: number
		valks50Used: number
		valks100Used: number
	}
	stepHistory: StepResult[]
	simulationResult: SimulationResult | null

	// Simulation actions
	startSimulation: () => void
	pauseSimulation: () => void
	resumeSimulation: () => void
	stopSimulation: () => void
	stepSimulation: () => StepResult | null

	// Strategy results
	restorationStrategyResults: Array<{
		restorationFrom: number
		label: string
		p50: { crystals: number; scrolls: number; silver: number }
		p90: { crystals: number; scrolls: number; silver: number }
		worst: { crystals: number; scrolls: number; silver: number }
	}>
	heptaOktaStrategyResults: Array<{
		useHepta: boolean
		useOkta: boolean
		label: string
		p50: { crystals: number; scrolls: number; silver: number; exquisite: number }
		p90: { crystals: number; scrolls: number; silver: number; exquisite: number }
		worst: { crystals: number; scrolls: number; silver: number; exquisite: number }
	}>
	strategyProgress: number
	runRestorationStrategy: () => Promise<void>
	runHeptaOktaStrategy: () => Promise<void>

	// Engine instance
	_engine: AwakeningEngine | null

	// Saved simulation runs
	savedRuns: SavedRun[]
	saveCurrentRun: () => void
	loadRun: (id: string) => void
	deleteRun: (id: string) => void
	togglePinRun: (id: string) => void
	clearAllRuns: () => void
}

export const useStore = create<AppState>()(
	persist(
		(set, get) => ({
			// Navigation
			currentPage: 'home',
			setPage: (page) => set({ currentPage: page }),

			// Market prices
			prices: { ...DEFAULT_PRICES },
			setPrice: (key, value) =>
				set((state) => ({
					prices: { ...state.prices, [key]: value },
				})),

			// Simulation config
			config: { ...DEFAULT_CONFIG },
			setConfig: (partial) =>
				set((state) => {
					const newConfig = { ...state.config, ...partial }
					// Reset startHepta/startOkta when startLevel changes
					if ('startLevel' in partial) {
						if (newConfig.startLevel !== 7) {
							newConfig.startHepta = 0
						}
						if (newConfig.startLevel !== 8) {
							newConfig.startOkta = 0
						}
					}
					return { config: newConfig }
				}),
			resetConfig: () => set({ config: { ...DEFAULT_CONFIG } }),

			// Speed
			speed: 'fast',
			setSpeed: (speed) => set({ speed }),

			// Monte Carlo
			numSimulations: 1000,
			setNumSimulations: (num) => set({ numSimulations: Math.max(100, num) }),

			// Simulation state
			isRunning: false,
			isPaused: false,
			currentLevel: 0,
			maxLevel: 0,
			attempts: 0,
			anvilEnergy: {},
			levelSuccesses: {},
			heptaProgress: 0,
			oktaProgress: 0,
			heptaPity: 0,
			oktaPity: 0,
			stats: {
				crystals: 0,
				scrolls: 0,
				silver: 0,
				exquisiteCrystals: 0,
				valks10Used: 0,
				valks50Used: 0,
				valks100Used: 0,
			},
			stepHistory: [],
			simulationResult: null,

			// Simulation actions
			startSimulation: () => {
				const state = get()
				const configWithPrices: SimulationConfig = {
					...state.config,
					prices: state.prices,
				}
				const engine = new AwakeningEngine(configWithPrices)

				set({
					isRunning: true,
					isPaused: false,
					currentLevel: state.config.startLevel,
					maxLevel: state.config.startLevel,
					attempts: 0,
					anvilEnergy: {},
					levelSuccesses: {},
					heptaProgress: state.config.startHepta,
					oktaProgress: state.config.startOkta,
					heptaPity: 0,
					oktaPity: 0,
					stats: {
						crystals: 0,
						scrolls: 0,
						silver: 0,
						exquisiteCrystals: 0,
						valks10Used: 0,
						valks50Used: 0,
						valks100Used: 0,
					},
					stepHistory: [],
					simulationResult: null,
					_engine: engine,
				})
			},

			pauseSimulation: () => set({ isPaused: true }),
			resumeSimulation: () => set({ isPaused: false }),
			stopSimulation: () => set({ isRunning: false, isPaused: false, _engine: null }),

			stepSimulation: () => {
				const state = get()
				const engine = state._engine
				if (!engine || engine.isComplete()) {
					set({
						isRunning: false,
						simulationResult: engine?.runFullSimulation() ?? null,
					})
					return null
				}

				const step = engine.step()
				const level = engine.getLevel()
				const stats = engine.getStats()

				// Track successful enhancements per level
				// Count normal successes and Hepta/Okta path completions (VII→VIII or VIII→IX)
				let newLevelSuccesses = state.levelSuccesses
				if (step.success && (!step.isHeptaOkta || step.pathComplete)) {
					newLevelSuccesses = {
						...state.levelSuccesses,
						[step.endingLevel]: (state.levelSuccesses[step.endingLevel] ?? 0) + 1,
					}
				}

				set({
					currentLevel: level,
					maxLevel: Math.max(state.maxLevel, level),
					attempts: stats.attempts,
					anvilEnergy: engine.getAnvilEnergy(),
					levelSuccesses: newLevelSuccesses,
					heptaProgress: engine.getHeptaProgress(),
					oktaProgress: engine.getOktaProgress(),
					heptaPity: engine.getHeptaPity(),
					oktaPity: engine.getOktaPity(),
					stats: {
						crystals: stats.crystals,
						scrolls: stats.scrolls,
						silver: stats.silver,
						exquisiteCrystals: stats.exquisiteCrystals,
						valks10Used: stats.valks10Used,
						valks50Used: stats.valks50Used,
						valks100Used: stats.valks100Used,
					},
					stepHistory: [...state.stepHistory, step],
				})

				if (engine.isComplete()) {
					set({ isRunning: false })
					// Auto-save completed run
					get().saveCurrentRun()
				}

				return step
			},

			// Strategy results
			restorationStrategyResults: [],
			heptaOktaStrategyResults: [],
			strategyProgress: 0,

			runRestorationStrategy: async () => {
				const state = get()
				const numSims = state.numSimulations
				const targetLevel = state.config.targetLevel

				// Test restoration from IV to target-1
				const restorationOptions = []
				for (let i = 4; i < targetLevel; i++) {
					restorationOptions.push(i)
				}

				const results: AppState['restorationStrategyResults'] = []
				set({ strategyProgress: 0, restorationStrategyResults: [] })

				for (let idx = 0; idx < restorationOptions.length; idx++) {
					const restFrom = restorationOptions[idx]
					const simResults: Array<{ crystals: number; scrolls: number; silver: number }> = []

					const config: SimulationConfig = {
						...state.config,
						startLevel: 0, // Always start from 0 for strategy analysis
						startHepta: 0, // Reset sub-enhancement progress
						startOkta: 0,
						restorationFrom: restFrom,
						useHepta: false,
						useOkta: false,
						prices: state.prices,
					}

					for (let i = 0; i < numSims; i++) {
						const engine = new AwakeningEngine(config)
						const [crystals, scrolls, silver] = engine.runFast()
						simResults.push({ crystals, scrolls, silver })

						if (i % 50 === 0) {
							set({ strategyProgress: ((idx * numSims + i) / (restorationOptions.length * numSims)) * 100 })
							await new Promise((r) => setTimeout(r, 0))
						}
					}

					simResults.sort((a, b) => a.silver - b.silver)
					const p50Idx = Math.floor(numSims * 0.5)
					const p90Idx = Math.floor(numSims * 0.9)

					results.push({
						restorationFrom: restFrom,
						label: `+${ROMAN_NUMERALS[restFrom]}`,
						p50: simResults[p50Idx],
						p90: simResults[p90Idx],
						worst: simResults[numSims - 1],
					})

					set({ restorationStrategyResults: [...results] })
				}

				set({ strategyProgress: 100 })
			},

			runHeptaOktaStrategy: async () => {
				const state = get()
				const numSims = state.numSimulations

				const strategies = [
					{ useHepta: true, useOkta: true, label: 'Hepta+Okta' },
					{ useHepta: true, useOkta: false, label: 'Hepta only' },
					{ useHepta: false, useOkta: true, label: 'Okta only' },
					{ useHepta: false, useOkta: false, label: 'Normal' },
				]

				const results: AppState['heptaOktaStrategyResults'] = []
				set({ strategyProgress: 0, heptaOktaStrategyResults: [] })

				for (let idx = 0; idx < strategies.length; idx++) {
					const { useHepta, useOkta, label } = strategies[idx]
					const simResults: Array<{
						crystals: number
						scrolls: number
						silver: number
						exquisite: number
					}> = []

					const config: SimulationConfig = {
						...state.config,
						startLevel: 0, // Always start from 0 for strategy analysis
						startHepta: 0, // Reset sub-enhancement progress
						startOkta: 0,
						restorationFrom: 6, // Fixed at +VI
						useHepta,
						useOkta,
						prices: state.prices,
					}

					for (let i = 0; i < numSims; i++) {
						const engine = new AwakeningEngine(config)
						const [crystals, scrolls, silver, exquisite] = engine.runFast()
						simResults.push({ crystals, scrolls, silver, exquisite })

						if (i % 50 === 0) {
							set({ strategyProgress: ((idx * numSims + i) / (strategies.length * numSims)) * 100 })
							await new Promise((r) => setTimeout(r, 0))
						}
					}

					simResults.sort((a, b) => a.silver - b.silver)
					const p50Idx = Math.floor(numSims * 0.5)
					const p90Idx = Math.floor(numSims * 0.9)

					results.push({
						useHepta,
						useOkta,
						label,
						p50: simResults[p50Idx],
						p90: simResults[p90Idx],
						worst: simResults[numSims - 1],
					})

					set({ heptaOktaStrategyResults: [...results] })
				}

				set({ strategyProgress: 100 })
			},

			_engine: null,

			// Saved runs
			savedRuns: loadSavedRuns(),

			saveCurrentRun: () => {
				const state = get()
				if (state.stepHistory.length === 0) return

				const run: SavedRun = {
					id: crypto.randomUUID(),
					timestamp: Date.now(),
					targetLevel: state.config.targetLevel,
					silver: state.stats.silver,
					attempts: state.attempts,
					pinned: false,
					stepsCompressed: LZString.compressToUTF16(JSON.stringify(state.stepHistory)),
					stats: { ...state.stats },
					levelSuccesses: { ...state.levelSuccesses },
					anvilEnergy: { ...state.anvilEnergy },
				}

				// Add new run and handle overflow - keep pinned runs, remove oldest unpinned
				let newRuns = [run, ...state.savedRuns]
				if (newRuns.length > MAX_SAVED_RUNS) {
					const pinned = newRuns.filter((r) => r.pinned)
					const unpinned = newRuns.filter((r) => !r.pinned)
					// Keep all pinned + as many unpinned as fit
					const unpinnedToKeep = MAX_SAVED_RUNS - pinned.length
					newRuns = [...pinned, ...unpinned.slice(0, Math.max(0, unpinnedToKeep))]
					// Sort by timestamp descending (newest first)
					newRuns.sort((a, b) => b.timestamp - a.timestamp)
				}
				persistSavedRuns(newRuns)
				set({ savedRuns: newRuns })
			},

			loadRun: (id: string) => {
				const state = get()
				const run = state.savedRuns.find((r) => r.id === id)
				if (!run) return

				try {
					const steps = JSON.parse(
						LZString.decompressFromUTF16(run.stepsCompressed) || '[]'
					) as StepResult[]

					set({
						isRunning: false,
						isPaused: false,
						currentLevel: run.targetLevel,
						maxLevel: run.targetLevel,
						attempts: run.attempts,
						anvilEnergy: run.anvilEnergy,
						levelSuccesses: run.levelSuccesses,
						stats: run.stats,
						stepHistory: steps,
						simulationResult: null,
						_engine: null,
					})
				} catch (e) {
					console.error('Failed to load run:', e)
				}
			},

			deleteRun: (id: string) => {
				const state = get()
				const newRuns = state.savedRuns.filter((r) => r.id !== id)
				persistSavedRuns(newRuns)
				set({ savedRuns: newRuns })
			},

			togglePinRun: (id: string) => {
				const state = get()
				const newRuns = state.savedRuns.map((r) =>
					r.id === id ? { ...r, pinned: !r.pinned } : r
				)
				persistSavedRuns(newRuns)
				set({ savedRuns: newRuns })
			},

			clearAllRuns: () => {
				persistSavedRuns([])
				set({ savedRuns: [] })
			},
		}),
		{
			name: 'bdm-sim-storage',
			version: 2, // Increment when schema changes
			partialize: (state) => ({
				prices: state.prices,
				config: state.config,
				numSimulations: state.numSimulations,
			}),
			// Merge persisted state with defaults to handle schema changes
			merge: (persistedState, currentState) => {
				const persisted = persistedState as Partial<AppState>
				return {
					...currentState,
					prices: { ...DEFAULT_PRICES, ...persisted.prices },
					config: { ...DEFAULT_CONFIG, ...persisted.config },
					numSimulations: persisted.numSimulations ?? currentState.numSimulations,
				}
			},
		}
	)
)
