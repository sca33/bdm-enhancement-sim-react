/**
 * Web Worker for non-blocking LZ-String compression/decompression.
 * Prevents UI freezing when saving/loading large simulation runs.
 */
import LZString from 'lz-string'

export type CompressionRequest =
	| { type: 'compress'; id: string; data: string }
	| { type: 'decompress'; id: string; data: string }

export type CompressionResponse = {
	type: 'result'
	id: string
	data: string
	error?: string
}

self.onmessage = (event: MessageEvent<CompressionRequest>) => {
	const { type, id, data } = event.data

	try {
		let result: string
		if (type === 'compress') {
			result = LZString.compressToUTF16(data)
		} else {
			result = LZString.decompressFromUTF16(data) || ''
		}

		self.postMessage({ type: 'result', id, data: result } satisfies CompressionResponse)
	} catch (error) {
		self.postMessage({
			type: 'result',
			id,
			data: '',
			error: error instanceof Error ? error.message : String(error),
		} satisfies CompressionResponse)
	}
}
