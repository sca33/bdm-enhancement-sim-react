/**
 * A fixed-size circular buffer that overwrites oldest entries when full.
 * Provides O(1) insertions and O(n) ordered retrieval.
 */
export class RingBuffer<T> {
	private buffer: T[]
	private head = 0
	private count = 0
	private readonly capacity: number

	constructor(capacity: number) {
		if (capacity <= 0) {
			throw new Error('RingBuffer capacity must be positive')
		}
		this.capacity = capacity
		this.buffer = new Array(capacity)
	}

	/**
	 * Add an item to the buffer. O(1) operation.
	 * If buffer is full, overwrites the oldest entry.
	 */
	push(item: T): void {
		this.buffer[this.head] = item
		this.head = (this.head + 1) % this.capacity
		if (this.count < this.capacity) {
			this.count++
		}
	}

	/**
	 * Get all items in insertion order (oldest to newest).
	 * Returns a new array - safe to mutate.
	 */
	toArray(): T[] {
		if (this.count === 0) {
			return []
		}
		if (this.count < this.capacity) {
			return this.buffer.slice(0, this.count)
		}
		// Buffer is full - reorder from oldest to newest
		return [...this.buffer.slice(this.head), ...this.buffer.slice(0, this.head)]
	}

	/**
	 * Get the last N items (most recent).
	 */
	getLast(n: number): T[] {
		const arr = this.toArray()
		return arr.slice(-Math.min(n, arr.length))
	}

	/**
	 * Get item at logical index (0 = oldest).
	 */
	get(index: number): T | undefined {
		if (index < 0 || index >= this.count) {
			return undefined
		}
		if (this.count < this.capacity) {
			return this.buffer[index]
		}
		// Buffer is full - calculate actual index
		const actualIndex = (this.head + index) % this.capacity
		return this.buffer[actualIndex]
	}

	get length(): number {
		return this.count
	}

	get maxCapacity(): number {
		return this.capacity
	}

	get isFull(): boolean {
		return this.count === this.capacity
	}

	/**
	 * Reset the buffer without reallocating.
	 */
	clear(): void {
		this.head = 0
		this.count = 0
	}

	/**
	 * Create a new RingBuffer with the same contents.
	 */
	clone(): RingBuffer<T> {
		const newBuffer = new RingBuffer<T>(this.capacity)
		for (const item of this.toArray()) {
			newBuffer.push(item)
		}
		return newBuffer
	}

	/**
	 * Serialize to JSON-compatible format for persistence.
	 */
	toJSON(): { items: T[]; capacity: number } {
		return {
			items: this.toArray(),
			capacity: this.capacity,
		}
	}

	/**
	 * Create a RingBuffer from serialized data.
	 */
	static fromJSON<T>(data: { items: T[]; capacity: number }): RingBuffer<T> {
		const buffer = new RingBuffer<T>(data.capacity)
		for (const item of data.items) {
			buffer.push(item)
		}
		return buffer
	}
}
