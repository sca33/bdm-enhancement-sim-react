import type { SavedRun } from '../hooks/use-store'

const DB_NAME = 'bdm-sim-db'
const DB_VERSION = 1
const STORE_NAME = 'saved-runs'

/**
 * Open the IndexedDB database, creating object stores if needed.
 */
function openDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION)

		request.onerror = () => reject(request.error)
		request.onsuccess = () => resolve(request.result)

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result

			if (!db.objectStoreNames.contains(STORE_NAME)) {
				const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
				store.createIndex('timestamp', 'timestamp', { unique: false })
				store.createIndex('pinned', 'pinned', { unique: false })
			}
		}
	})
}

/**
 * Save a simulation run to IndexedDB.
 */
export async function saveRunToDB(run: SavedRun): Promise<void> {
	const db = await openDB()
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite')
		const store = tx.objectStore(STORE_NAME)
		const request = store.put(run)

		request.onerror = () => reject(request.error)
		request.onsuccess = () => resolve()

		tx.oncomplete = () => db.close()
	})
}

/**
 * Load all saved runs from IndexedDB, sorted by timestamp (newest first).
 */
export async function loadAllRunsFromDB(): Promise<SavedRun[]> {
	const db = await openDB()
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readonly')
		const store = tx.objectStore(STORE_NAME)
		const request = store.getAll()

		request.onerror = () => reject(request.error)
		request.onsuccess = () => {
			const runs = request.result as SavedRun[]
			// Sort by timestamp descending (newest first)
			runs.sort((a, b) => b.timestamp - a.timestamp)
			resolve(runs)
		}

		tx.oncomplete = () => db.close()
	})
}

/**
 * Load a single run by ID.
 */
export async function loadRunFromDB(id: string): Promise<SavedRun | undefined> {
	const db = await openDB()
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readonly')
		const store = tx.objectStore(STORE_NAME)
		const request = store.get(id)

		request.onerror = () => reject(request.error)
		request.onsuccess = () => resolve(request.result as SavedRun | undefined)

		tx.oncomplete = () => db.close()
	})
}

/**
 * Delete a run from IndexedDB.
 */
export async function deleteRunFromDB(id: string): Promise<void> {
	const db = await openDB()
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite')
		const store = tx.objectStore(STORE_NAME)
		const request = store.delete(id)

		request.onerror = () => reject(request.error)
		request.onsuccess = () => resolve()

		tx.oncomplete = () => db.close()
	})
}

/**
 * Update a run in IndexedDB (e.g., toggle pinned status).
 */
export async function updateRunInDB(run: SavedRun): Promise<void> {
	return saveRunToDB(run)
}

/**
 * Clear all runs from IndexedDB.
 */
export async function clearAllRunsFromDB(): Promise<void> {
	const db = await openDB()
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite')
		const store = tx.objectStore(STORE_NAME)
		const request = store.clear()

		request.onerror = () => reject(request.error)
		request.onsuccess = () => resolve()

		tx.oncomplete = () => db.close()
	})
}

/**
 * Get the count of saved runs.
 */
export async function getRunCount(): Promise<number> {
	const db = await openDB()
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readonly')
		const store = tx.objectStore(STORE_NAME)
		const request = store.count()

		request.onerror = () => reject(request.error)
		request.onsuccess = () => resolve(request.result)

		tx.oncomplete = () => db.close()
	})
}

/**
 * Check if IndexedDB is available.
 */
export function isIndexedDBAvailable(): boolean {
	try {
		return typeof indexedDB !== 'undefined'
	} catch {
		return false
	}
}

/**
 * Migrate saved runs from localStorage to IndexedDB.
 * Call this once on app startup to migrate existing data.
 */
export async function migrateFromLocalStorage(localStorageKey: string): Promise<void> {
	if (!isIndexedDBAvailable()) return

	try {
		const data = localStorage.getItem(localStorageKey)
		if (!data) return

		const runs = JSON.parse(data) as SavedRun[]
		if (!Array.isArray(runs) || runs.length === 0) return

		// Check if migration already happened (any runs in IndexedDB)
		const existingCount = await getRunCount()
		if (existingCount > 0) {
			// Already migrated, skip
			return
		}

		// Migrate each run to IndexedDB
		for (const run of runs) {
			await saveRunToDB(run)
		}

		console.log(`Migrated ${runs.length} runs from localStorage to IndexedDB`)

		// Optionally clear localStorage after successful migration
		// localStorage.removeItem(localStorageKey)
	} catch (e) {
		console.error('Failed to migrate from localStorage:', e)
	}
}
