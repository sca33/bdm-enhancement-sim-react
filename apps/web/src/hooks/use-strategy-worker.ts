import type { MarketPrices, SimulationConfig } from '@bdm-sim/simulator'
import { useCallback, useEffect, useRef, useState } from 'react'
import type {
	HeptaOktaResult,
	ResourceLimits,
	RestorationResult,
	StrategyRequest,
	StrategyResponse,
} from '../workers/strategy.worker'

interface UseStrategyWorkerReturn {
	// Restoration strategy
	runRestorationStrategy: (
		config: SimulationConfig,
		prices: MarketPrices,
		numSimulations: number,
		resourceLimits: ResourceLimits,
	) => Promise<RestorationResult[]>
	restorationProgress: number
	isRestorationRunning: boolean

	// Hepta/Okta strategy
	runHeptaOktaStrategy: (
		config: SimulationConfig,
		prices: MarketPrices,
		numSimulations: number,
		resourceLimits: ResourceLimits,
	) => Promise<HeptaOktaResult[]>
	heptaOktaProgress: number
	isHeptaOktaRunning: boolean
}

type PendingRequest<T> = {
	resolve: (value: T) => void
	reject: (error: Error) => void
	timeoutId: ReturnType<typeof setTimeout>
}

/** Worker request timeout in milliseconds (60 seconds) */
const WORKER_TIMEOUT_MS = 60_000

/**
 * Hook for running strategy finder simulations in a web worker.
 * Provides complete isolation from the main thread and Zustand state.
 */
export function useStrategyWorker(): UseStrategyWorkerReturn {
	const workerRef = useRef<Worker | null>(null)
	const pendingRef = useRef<Map<string, PendingRequest<unknown>>>(new Map())

	const [restorationProgress, setRestorationProgress] = useState(0)
	const [isRestorationRunning, setIsRestorationRunning] = useState(false)
	const [heptaOktaProgress, setHeptaOktaProgress] = useState(0)
	const [isHeptaOktaRunning, setIsHeptaOktaRunning] = useState(false)

	/** Clean up a pending request by key */
	const cleanupPending = useCallback((key: string) => {
		const pending = pendingRef.current.get(key)
		if (pending) {
			clearTimeout(pending.timeoutId)
			pendingRef.current.delete(key)
		}
	}, [])

	useEffect(() => {
		// Create worker on mount
		try {
			workerRef.current = new Worker(new URL('../workers/strategy.worker.ts', import.meta.url), {
				type: 'module',
			})

			workerRef.current.onmessage = (event: MessageEvent<StrategyResponse>) => {
				const response = event.data

				if (response.type === 'progress') {
					// Update progress based on which strategy is running
					if (pendingRef.current.has(`restoration-${response.id}`)) {
						setRestorationProgress(response.progress)
					} else if (pendingRef.current.has(`hepta-okta-${response.id}`)) {
						setHeptaOktaProgress(response.progress)
					}
					return
				}

				if (response.type === 'restoration-complete') {
					const key = `restoration-${response.id}`
					const pending = pendingRef.current.get(key)
					if (pending) {
						cleanupPending(key)
						setIsRestorationRunning(false)
						setRestorationProgress(100)
						;(pending as PendingRequest<RestorationResult[]>).resolve(response.results)
					}
					return
				}

				if (response.type === 'hepta-okta-complete') {
					const key = `hepta-okta-${response.id}`
					const pending = pendingRef.current.get(key)
					if (pending) {
						cleanupPending(key)
						setIsHeptaOktaRunning(false)
						setHeptaOktaProgress(100)
						;(pending as PendingRequest<HeptaOktaResult[]>).resolve(response.results)
					}
					return
				}

				if (response.type === 'error') {
					// Only one request type should be pending per ID
					const restorationKey = `restoration-${response.id}`
					const heptaOktaKey = `hepta-okta-${response.id}`
					const restorationPending = pendingRef.current.get(restorationKey)
					const heptaOktaPending = pendingRef.current.get(heptaOktaKey)

					if (restorationPending) {
						cleanupPending(restorationKey)
						setIsRestorationRunning(false)
						restorationPending.reject(new Error(response.error))
					} else if (heptaOktaPending) {
						cleanupPending(heptaOktaKey)
						setIsHeptaOktaRunning(false)
						heptaOktaPending.reject(new Error(response.error))
					}
				}
			}

			workerRef.current.onerror = (error) => {
				console.error('Strategy worker error:', error)
				// Reject all pending requests
				for (const [key, pending] of pendingRef.current) {
					clearTimeout(pending.timeoutId)
					pending.reject(new Error('Worker error'))
					pendingRef.current.delete(key)
				}
				setIsRestorationRunning(false)
				setIsHeptaOktaRunning(false)
			}
		} catch (e) {
			console.error('Failed to create strategy worker:', e)
		}

		return () => {
			// Clear all timeouts and reject pending requests before terminating
			for (const [, pending] of pendingRef.current) {
				clearTimeout(pending.timeoutId)
				pending.reject(new Error('Worker terminated'))
			}
			pendingRef.current.clear()
			workerRef.current?.terminate()
			workerRef.current = null
		}
	}, [cleanupPending])

	const runRestorationStrategy = useCallback(
		(
			config: SimulationConfig,
			prices: MarketPrices,
			numSimulations: number,
			resourceLimits: ResourceLimits,
		): Promise<RestorationResult[]> => {
			return new Promise((resolve, reject) => {
				if (!workerRef.current) {
					reject(new Error('Worker not available'))
					return
				}

				const id = crypto.randomUUID()
				const key = `restoration-${id}`
				setRestorationProgress(0)
				setIsRestorationRunning(true)

				// Set up timeout
				const timeoutId = setTimeout(() => {
					if (pendingRef.current.has(key)) {
						pendingRef.current.delete(key)
						setIsRestorationRunning(false)
						reject(new Error('Worker request timed out'))
					}
				}, WORKER_TIMEOUT_MS)

				pendingRef.current.set(key, {
					resolve: resolve as (value: unknown) => void,
					reject,
					timeoutId,
				})

				workerRef.current.postMessage({
					type: 'restoration',
					id,
					config,
					prices,
					numSimulations,
					resourceLimits,
				} satisfies StrategyRequest)
			})
		},
		[],
	)

	const runHeptaOktaStrategy = useCallback(
		(
			config: SimulationConfig,
			prices: MarketPrices,
			numSimulations: number,
			resourceLimits: ResourceLimits,
		): Promise<HeptaOktaResult[]> => {
			return new Promise((resolve, reject) => {
				if (!workerRef.current) {
					reject(new Error('Worker not available'))
					return
				}

				const id = crypto.randomUUID()
				const key = `hepta-okta-${id}`
				setHeptaOktaProgress(0)
				setIsHeptaOktaRunning(true)

				// Set up timeout
				const timeoutId = setTimeout(() => {
					if (pendingRef.current.has(key)) {
						pendingRef.current.delete(key)
						setIsHeptaOktaRunning(false)
						reject(new Error('Worker request timed out'))
					}
				}, WORKER_TIMEOUT_MS)

				pendingRef.current.set(key, {
					resolve: resolve as (value: unknown) => void,
					reject,
					timeoutId,
				})

				workerRef.current.postMessage({
					type: 'hepta-okta',
					id,
					config,
					prices,
					numSimulations,
					resourceLimits,
				} satisfies StrategyRequest)
			})
		},
		[],
	)

	return {
		runRestorationStrategy,
		restorationProgress,
		isRestorationRunning,
		runHeptaOktaStrategy,
		heptaOktaProgress,
		isHeptaOktaRunning,
	}
}
