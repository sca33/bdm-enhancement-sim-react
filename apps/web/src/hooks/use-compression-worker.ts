import { useCallback, useEffect, useRef } from 'react'
import type { CompressionRequest, CompressionResponse } from '../workers/compression.worker'

type PendingRequest = {
	resolve: (value: string) => void
	reject: (error: Error) => void
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
				for (const [id, pending] of pendingRef.current) {
					pending.reject(new Error('Worker error'))
					pendingRef.current.delete(id)
				}
			}
		} catch (e) {
			console.warn('Web Workers not supported, falling back to sync compression')
		}

		return () => {
			workerRef.current?.terminate()
		}
	}, [])

	const compress = useCallback((data: string): Promise<string> => {
		return new Promise((resolve, reject) => {
			if (!workerRef.current) {
				// Fallback to sync if worker not available
				try {
					const LZString = require('lz-string')
					resolve(LZString.compressToUTF16(data))
				} catch (e) {
					reject(e)
				}
				return
			}

			const id = crypto.randomUUID()
			pendingRef.current.set(id, { resolve, reject })
			workerRef.current.postMessage({ type: 'compress', id, data } satisfies CompressionRequest)
		})
	}, [])

	const decompress = useCallback((data: string): Promise<string> => {
		return new Promise((resolve, reject) => {
			if (!workerRef.current) {
				// Fallback to sync if worker not available
				try {
					const LZString = require('lz-string')
					resolve(LZString.decompressFromUTF16(data) || '')
				} catch (e) {
					reject(e)
				}
				return
			}

			const id = crypto.randomUUID()
			pendingRef.current.set(id, { resolve, reject })
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
				globalPending.delete(id)
				if (error) {
					pending.reject(new Error(error))
				} else {
					pending.resolve(data)
				}
			}
		}
	} catch (e) {
		console.warn('Web Workers not supported')
	}

	return globalWorker
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
		globalPending.set(id, { resolve, reject })
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
		globalPending.set(id, { resolve, reject })
		worker.postMessage({ type: 'decompress', id, data } satisfies CompressionRequest)
	})
}
