import type { MarketPrices, SimulationConfig } from '@bdm-sim/simulator'
import { useCallback, useEffect, useRef, useState } from 'react'
import type {
	HeptaOktaResult,
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
	) => Promise<RestorationResult[]>
	restorationProgress: number
	isRestorationRunning: boolean

	// Hepta/Okta strategy
	runHeptaOktaStrategy: (
		config: SimulationConfig,
		prices: MarketPrices,
		numSimulations: number,
	) => Promise<HeptaOktaResult[]>
	heptaOktaProgress: number
	isHeptaOktaRunning: boolean
}

type PendingRequest<T> = {
	resolve: (value: T) => void
	reject: (error: Error) => void
}

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
					const pending = pendingRef.current.get(`restoration-${response.id}`)
					if (pending) {
						pendingRef.current.delete(`restoration-${response.id}`)
						setIsRestorationRunning(false)
						setRestorationProgress(100)
						;(pending as PendingRequest<RestorationResult[]>).resolve(response.results)
					}
					return
				}

				if (response.type === 'hepta-okta-complete') {
					const pending = pendingRef.current.get(`hepta-okta-${response.id}`)
					if (pending) {
						pendingRef.current.delete(`hepta-okta-${response.id}`)
						setIsHeptaOktaRunning(false)
						setHeptaOktaProgress(100)
						;(pending as PendingRequest<HeptaOktaResult[]>).resolve(response.results)
					}
					return
				}

				if (response.type === 'error') {
					// Try both pending types
					const restorationPending = pendingRef.current.get(`restoration-${response.id}`)
					const heptaOktaPending = pendingRef.current.get(`hepta-okta-${response.id}`)

					if (restorationPending) {
						pendingRef.current.delete(`restoration-${response.id}`)
						setIsRestorationRunning(false)
						restorationPending.reject(new Error(response.error))
					}
					if (heptaOktaPending) {
						pendingRef.current.delete(`hepta-okta-${response.id}`)
						setIsHeptaOktaRunning(false)
						heptaOktaPending.reject(new Error(response.error))
					}
				}
			}

			workerRef.current.onerror = (error) => {
				console.error('Strategy worker error:', error)
				// Reject all pending requests
				for (const [key, pending] of pendingRef.current) {
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
			// Reject all pending requests before terminating
			for (const [, pending] of pendingRef.current) {
				pending.reject(new Error('Worker terminated'))
			}
			pendingRef.current.clear()
			workerRef.current?.terminate()
			workerRef.current = null
		}
	}, [])

	const runRestorationStrategy = useCallback(
		(
			config: SimulationConfig,
			prices: MarketPrices,
			numSimulations: number,
		): Promise<RestorationResult[]> => {
			return new Promise((resolve, reject) => {
				if (!workerRef.current) {
					reject(new Error('Worker not available'))
					return
				}

				const id = crypto.randomUUID()
				setRestorationProgress(0)
				setIsRestorationRunning(true)

				pendingRef.current.set(`restoration-${id}`, {
					resolve: resolve as (value: unknown) => void,
					reject,
				})

				workerRef.current.postMessage({
					type: 'restoration',
					id,
					config,
					prices,
					numSimulations,
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
		): Promise<HeptaOktaResult[]> => {
			return new Promise((resolve, reject) => {
				if (!workerRef.current) {
					reject(new Error('Worker not available'))
					return
				}

				const id = crypto.randomUUID()
				setHeptaOktaProgress(0)
				setIsHeptaOktaRunning(true)

				pendingRef.current.set(`hepta-okta-${id}`, {
					resolve: resolve as (value: unknown) => void,
					reject,
				})

				workerRef.current.postMessage({
					type: 'hepta-okta',
					id,
					config,
					prices,
					numSimulations,
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
