import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}

/** Format large numbers with K/M/B suffixes */
export function formatNumber(num: number): string {
	if (num >= 1_000_000_000) {
		return `${(num / 1_000_000_000).toFixed(1)}B`
	}
	if (num >= 1_000_000) {
		return `${(num / 1_000_000).toFixed(1)}M`
	}
	if (num >= 1_000) {
		return `${(num / 1_000).toFixed(1)}K`
	}
	return num.toFixed(0)
}

/** Format silver with proper suffix */
export function formatSilver(silver: number): string {
	return `${formatNumber(silver)} Silver`
}

/** Format time based on attempts (seconds) */
export function formatTime(seconds: number): string {
	if (seconds < 60) {
		return `${seconds}s`
	}
	if (seconds < 3600) {
		const mins = Math.floor(seconds / 60)
		const secs = seconds % 60
		return `${mins}m ${secs}s`
	}
	const hours = Math.floor(seconds / 3600)
	const mins = Math.floor((seconds % 3600) / 60)
	return `${hours}h ${mins}m`
}
