import {
	AwakeningEngine,
	DEFAULT_CONFIG,
	DEFAULT_PRICES,
	type MarketPrices,
	type SimulationConfig,
	type SimulationResult,
	type StepResult,
	UI_CONSTANTS,
} from '@bdm-sim/simulator'
import LZString from 'lz-string'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Page =
	| 'home'
	| 'awakening-config'
	| 'simulation'
	| 'restoration-strategy'
	| 'hepta-okta-strategy'

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
const { STEP_BUFFER_SIZE, MAX_SAVED_RUNS } = UI_CONSTANTS
const CURRENT_BUILD_VERSION = typeof __BUILD_VERSION__ !== 'undefined' ? __BUILD_VERSION__ : 'dev'

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
	// Time tracking for statistics
	simulationStartTime: number | null
	simulationElapsedTime: number
	stats: {
		crystals: number
		scrolls: number
		silver: number
		exquisiteCrystals: number
		valks10Used: number
		valks50Used: number
		valks100Used: number
	}
	// Ring buffer for step history - O(1) writes instead of O(n) array spread
	_stepBuffer: StepResult[]
	_stepBufferIndex: number
	_stepBufferCount: number
	// Getter to retrieve steps in correct order
	getStepHistory: () => StepResult[]
	simulationResult: SimulationResult | null

	// Simulation actions
	startSimulation: () => void
	pauseSimulation: () => void
	resumeSimulation: () => void
	stopSimulation: () => void
	stepSimulation: () => StepResult | null

	// Strategy results (set from worker via hooks)
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
	setRestorationStrategyResults: (results: AppState['restorationStrategyResults']) => void
	setHeptaOktaStrategyResults: (results: AppState['heptaOktaStrategyResults']) => void

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

					// Validate and clamp values
					newConfig.startLevel = Math.max(0, Math.min(10, newConfig.startLevel))
					newConfig.targetLevel = Math.max(1, Math.min(10, newConfig.targetLevel))

					// Ensure startLevel < targetLevel
					if (newConfig.startLevel >= newConfig.targetLevel) {
						newConfig.startLevel = Math.max(0, newConfig.targetLevel - 1)
					}

					// Clamp restoration level to valid range (0 = disabled, or between 4 and targetLevel)
					if (newConfig.restorationFrom > 0) {
						newConfig.restorationFrom = Math.max(4, Math.min(newConfig.targetLevel, newConfig.restorationFrom))
					}

					// Clamp Valks levels (0 = disabled, or between 1 and 10)
					if (newConfig.valks10From > 0) {
						newConfig.valks10From = Math.max(1, Math.min(10, newConfig.valks10From))
					}
					if (newConfig.valks50From > 0) {
						newConfig.valks50From = Math.max(1, Math.min(10, newConfig.valks50From))
					}
					if (newConfig.valks100From > 0) {
						newConfig.valks100From = Math.max(1, Math.min(10, newConfig.valks100From))
					}

					// Clamp Hepta/Okta progress
					newConfig.startHepta = Math.max(0, Math.min(4, newConfig.startHepta))
					newConfig.startOkta = Math.max(0, Math.min(9, newConfig.startOkta))

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
			speed: 'instant',
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
			simulationStartTime: null,
			simulationElapsedTime: 0,
			stats: {
				crystals: 0,
				scrolls: 0,
				silver: 0,
				exquisiteCrystals: 0,
				valks10Used: 0,
				valks50Used: 0,
				valks100Used: 0,
			},
			// Ring buffer for step history
			_stepBuffer: [],
			_stepBufferIndex: 0,
			_stepBufferCount: 0,
			// Getter returns steps in correct chronological order
			getStepHistory: () => {
				const { _stepBuffer, _stepBufferIndex, _stepBufferCount } = get()
				if (_stepBufferCount === 0) return []
				if (_stepBufferCount < STEP_BUFFER_SIZE) {
					// Buffer not full yet - return items in order
					return _stepBuffer.slice(0, _stepBufferCount)
				}
				// Buffer is full - reconstruct correct order from ring buffer
				const start = _stepBufferIndex % STEP_BUFFER_SIZE
				return [..._stepBuffer.slice(start), ..._stepBuffer.slice(0, start)]
			},
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
					simulationStartTime: Date.now(),
					simulationElapsedTime: 0,
					stats: {
						crystals: 0,
						scrolls: 0,
						silver: 0,
						exquisiteCrystals: 0,
						valks10Used: 0,
						valks50Used: 0,
						valks100Used: 0,
					},
					// Reset ring buffer
					_stepBuffer: new Array(STEP_BUFFER_SIZE),
					_stepBufferIndex: 0,
					_stepBufferCount: 0,
					simulationResult: null,
					_engine: engine,
				})
			},

			pauseSimulation: () =>
				set((state) => ({
					isPaused: true,
					simulationElapsedTime:
						state.simulationElapsedTime +
						(state.simulationStartTime ? (Date.now() - state.simulationStartTime) / 1000 : 0),
					simulationStartTime: null,
				})),
			resumeSimulation: () => set({ isPaused: false, simulationStartTime: Date.now() }),
			stopSimulation: () =>
				set((state) => ({
					isRunning: false,
					isPaused: false,
					simulationElapsedTime:
						state.simulationElapsedTime +
						(state.simulationStartTime ? (Date.now() - state.simulationStartTime) / 1000 : 0),
					simulationStartTime: null,
					_engine: null,
				})),

			stepSimulation: () => {
				const state = get()
				const engine = state._engine
				if (!engine) {
					set({ isRunning: false, simulationResult: null })
					return null
				}
				if (engine.isComplete()) {
					set({ isRunning: false, simulationResult: engine.runFullSimulation() })
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

				// Ring buffer O(1) write - mutate in place for performance
				// (Zustand handles this correctly without requiring immutable updates for internal state)
				const writeIdx = state._stepBufferIndex % STEP_BUFFER_SIZE
				state._stepBuffer[writeIdx] = step

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
					// Don't replace buffer - it's mutated in place
					_stepBufferIndex: state._stepBufferIndex + 1,
					_stepBufferCount: Math.min(state._stepBufferCount + 1, STEP_BUFFER_SIZE),
				})

				if (engine.isComplete()) {
					set({ isRunning: false })
					// Auto-save completed run
					get().saveCurrentRun()
				}

				return step
			},

			// Strategy results (set from worker via hooks)
			restorationStrategyResults: [],
			heptaOktaStrategyResults: [],
			setRestorationStrategyResults: (results) => set({ restorationStrategyResults: results }),
			setHeptaOktaStrategyResults: (results) => set({ heptaOktaStrategyResults: results }),

			_engine: null,

			// Saved runs
			savedRuns: loadSavedRuns(),

			saveCurrentRun: () => {
				const state = get()
				const stepHistory = state.getStepHistory()
				if (stepHistory.length === 0) return

				const run: SavedRun = {
					id: crypto.randomUUID(),
					timestamp: Date.now(),
					targetLevel: state.config.targetLevel,
					silver: state.stats.silver,
					attempts: state.attempts,
					pinned: false,
					stepsCompressed: LZString.compressToUTF16(JSON.stringify(stepHistory)),
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
						LZString.decompressFromUTF16(run.stepsCompressed) || '[]',
					) as StepResult[]

					// Load steps into ring buffer (only keep last STEP_BUFFER_SIZE items)
					const stepsToLoad = steps.slice(-STEP_BUFFER_SIZE)
					const newBuffer = new Array(STEP_BUFFER_SIZE)
					for (let i = 0; i < stepsToLoad.length; i++) {
						newBuffer[i] = stepsToLoad[i]
					}

					set({
						isRunning: false,
						isPaused: false,
						currentLevel: run.targetLevel,
						maxLevel: run.targetLevel,
						attempts: run.attempts,
						anvilEnergy: run.anvilEnergy,
						levelSuccesses: run.levelSuccesses,
						stats: run.stats,
						_stepBuffer: newBuffer,
						_stepBufferIndex: stepsToLoad.length,
						_stepBufferCount: stepsToLoad.length,
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
				const newRuns = state.savedRuns.map((r) => (r.id === id ? { ...r, pinned: !r.pinned } : r))
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
				buildVersion: CURRENT_BUILD_VERSION,
			}),
			// Merge persisted state with defaults to handle schema changes
			merge: (persistedState, currentState) => {
				const persisted = persistedState as Partial<AppState> & { buildVersion?: string }

				// Check if build version changed - if so, reset to defaults
				if (persisted.buildVersion && persisted.buildVersion !== CURRENT_BUILD_VERSION) {
					console.log(
						`[Store] Build version changed: ${persisted.buildVersion} → ${CURRENT_BUILD_VERSION}. Resetting to defaults.`,
					)
					return {
						...currentState,
						prices: { ...DEFAULT_PRICES },
						config: { ...DEFAULT_CONFIG },
					}
				}

				return {
					...currentState,
					prices: { ...DEFAULT_PRICES, ...persisted.prices },
					config: { ...DEFAULT_CONFIG, ...persisted.config },
					numSimulations: persisted.numSimulations ?? currentState.numSimulations,
				}
			},
		},
	),
)
