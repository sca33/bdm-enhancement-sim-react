import { useCallback, useEffect, useRef } from 'react'
import type { CompressionRequest, CompressionResponse } from '../workers/compression.worker'

/** Timeout for compression/decompression requests (30 seconds) */
const REQUEST_TIMEOUT_MS = 30_000

type PendingRequest = {
	resolve: (value: string) => void
	reject: (error: Error) => void
	timeoutId: ReturnType<typeof setTimeout>
}

/**
 * Hook for non-blocking LZ-String compression using a Web Worker.
 * Falls back to synchronous compression if workers are not supported.
 */
export function useCompressionWorker() {
	const workerRef = useRef<Worker | null>(null)
	const pendingRef = useRef<Map<string, PendingRequest>>(new Map())

	useEffect(() => {
		// Create worker on mount
		try {
			workerRef.current = new Worker(new URL('../workers/compression.worker.ts', import.meta.url), {
				type: 'module',
			})

			workerRef.current.onmessage = (event: MessageEvent<CompressionResponse>) => {
				const { id, data, error } = event.data
				const pending = pendingRef.current.get(id)
				if (pending) {
					clearTimeout(pending.timeoutId)
					pendingRef.current.delete(id)
					if (error) {
						pending.reject(new Error(error))
					} else {
						pending.resolve(data)
					}
				}
			}

			workerRef.current.onerror = (error) => {
				console.error('Compression worker error:', error)
				// Reject all pending requests
				for (const [, pending] of pendingRef.current) {
					clearTimeout(pending.timeoutId)
					pending.reject(new Error('Worker error'))
				}
				pendingRef.current.clear()
			}
		} catch (e) {
			console.warn('Web Workers not supported, falling back to sync compression')
		}

		return () => {
			// Reject all pending requests before terminating
			for (const [, pending] of pendingRef.current) {
				clearTimeout(pending.timeoutId)
				pending.reject(new Error('Worker terminated'))
			}
			pendingRef.current.clear()
			workerRef.current?.terminate()
			workerRef.current = null
		}
	}, [])

	const compress = useCallback((data: string): Promise<string> => {
		return new Promise((resolve, reject) => {
			if (!workerRef.current) {
				// Fallback to sync if worker not available
				import('lz-string')
					.then((LZString) => resolve(LZString.compressToUTF16(data)))
					.catch(reject)
				return
			}

			const id = crypto.randomUUID()
			const timeoutId = setTimeout(() => {
				if (pendingRef.current.has(id)) {
					pendingRef.current.delete(id)
					reject(new Error('Compression timeout'))
				}
			}, REQUEST_TIMEOUT_MS)

			pendingRef.current.set(id, { resolve, reject, timeoutId })
			workerRef.current.postMessage({ type: 'compress', id, data } satisfies CompressionRequest)
		})
	}, [])

	const decompress = useCallback((data: string): Promise<string> => {
		return new Promise((resolve, reject) => {
			if (!workerRef.current) {
				// Fallback to sync if worker not available
				import('lz-string')
					.then((LZString) => resolve(LZString.decompressFromUTF16(data) || ''))
					.catch(reject)
				return
			}

			const id = crypto.randomUUID()
			const timeoutId = setTimeout(() => {
				if (pendingRef.current.has(id)) {
					pendingRef.current.delete(id)
					reject(new Error('Decompression timeout'))
				}
			}, REQUEST_TIMEOUT_MS)

			pendingRef.current.set(id, { resolve, reject, timeoutId })
			workerRef.current.postMessage({ type: 'decompress', id, data } satisfies CompressionRequest)
		})
	}, [])

	return { compress, decompress }
}

// Singleton worker instance for use outside React components
let globalWorker: Worker | null = null
const globalPending = new Map<string, PendingRequest>()

function getGlobalWorker(): Worker | null {
	if (globalWorker) return globalWorker

	try {
		globalWorker = new Worker(new URL('../workers/compression.worker.ts', import.meta.url), {
			type: 'module',
		})

		globalWorker.onmessage = (event: MessageEvent<CompressionResponse>) => {
			const { id, data, error } = event.data
			const pending = globalPending.get(id)
			if (pending) {
				clearTimeout(pending.timeoutId)
				globalPending.delete(id)
				if (error) {
					pending.reject(new Error(error))
				} else {
					pending.resolve(data)
				}
			}
		}

		globalWorker.onerror = (error) => {
			console.error('Global compression worker error:', error)
			// Reject all pending requests
			for (const [, pending] of globalPending) {
				clearTimeout(pending.timeoutId)
				pending.reject(new Error('Worker error'))
			}
			globalPending.clear()
		}
	} catch (e) {
		console.warn('Web Workers not supported')
	}

	return globalWorker
}

/**
 * Terminate the global worker instance.
 * Call this when the worker is no longer needed to free resources.
 */
export function terminateGlobalWorker(): void {
	if (globalWorker) {
		// Reject all pending requests
		for (const [, pending] of globalPending) {
			clearTimeout(pending.timeoutId)
			pending.reject(new Error('Worker terminated'))
		}
		globalPending.clear()
		globalWorker.terminate()
		globalWorker = null
	}
}

/**
 * Compress data using the global worker instance.
 * Can be used outside React components (e.g., in Zustand store).
 */
export async function compressAsync(data: string): Promise<string> {
	const worker = getGlobalWorker()
	if (!worker) {
		// Fallback to sync
		const LZString = await import('lz-string')
		return LZString.compressToUTF16(data)
	}

	return new Promise((resolve, reject) => {
		const id = crypto.randomUUID()
		const timeoutId = setTimeout(() => {
			if (globalPending.has(id)) {
				globalPending.delete(id)
				reject(new Error('Compression timeout'))
			}
		}, REQUEST_TIMEOUT_MS)

		globalPending.set(id, { resolve, reject, timeoutId })
		worker.postMessage({ type: 'compress', id, data } satisfies CompressionRequest)
	})
}

/**
 * Decompress data using the global worker instance.
 * Can be used outside React components (e.g., in Zustand store).
 */
export async function decompressAsync(data: string): Promise<string> {
	const worker = getGlobalWorker()
	if (!worker) {
		// Fallback to sync
		const LZString = await import('lz-string')
		return LZString.decompressFromUTF16(data) || ''
	}

	return new Promise((resolve, reject) => {
		const id = crypto.randomUUID()
		const timeoutId = setTimeout(() => {
			if (globalPending.has(id)) {
				globalPending.delete(id)
				reject(new Error('Decompression timeout'))
			}
		}, REQUEST_TIMEOUT_MS)

		globalPending.set(id, { resolve, reject, timeoutId })
		worker.postMessage({ type: 'decompress', id, data } satisfies CompressionRequest)
	})
}
