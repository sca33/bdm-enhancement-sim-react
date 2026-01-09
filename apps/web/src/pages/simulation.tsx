import {
	ANVIL_THRESHOLDS,
	HEPTA_OKTA_ANVIL_PITY,
	HEPTA_SUB_ENHANCEMENTS,
	OKTA_SUB_ENHANCEMENTS,
	ROMAN_NUMERALS,
	type StepResult,
	UI_CONSTANTS,
} from '@bdm-sim/simulator'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowLeft, Loader2, Pause, Play, RotateCcw } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { SimulationHistory } from '@/components/simulation-history'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { useStore } from '@/hooks/use-store'
import { formatNumber, formatSilver, formatTime } from '@/lib/utils'

type FlashType = 'none' | 'success' | 'fail' | 'complete'

export function SimulationPage() {
	// Granular selectors to prevent unnecessary re-renders
	// Static config/actions - rarely change
	const config = useStore((s) => s.config)
	const setPage = useStore((s) => s.setPage)
	const speed = useStore((s) => s.speed)
	const startSimulation = useStore((s) => s.startSimulation)
	const pauseSimulation = useStore((s) => s.pauseSimulation)
	const resumeSimulation = useStore((s) => s.resumeSimulation)
	const stopSimulation = useStore((s) => s.stopSimulation)
	const stepSimulation = useStore((s) => s.stepSimulation)

	// Simulation state - changes frequently during simulation
	const isRunning = useStore((s) => s.isRunning)
	const isPaused = useStore((s) => s.isPaused)
	const currentLevel = useStore((s) => s.currentLevel)
	const maxLevel = useStore((s) => s.maxLevel)
	const attempts = useStore((s) => s.attempts)
	const stats = useStore((s) => s.stats)
	const simulationStartTime = useStore((s) => s.simulationStartTime)
	const simulationElapsedTime = useStore((s) => s.simulationElapsedTime)

	// Stats panel state
	const anvilEnergy = useStore((s) => s.anvilEnergy)
	const levelSuccesses = useStore((s) => s.levelSuccesses)
	const heptaProgress = useStore((s) => s.heptaProgress)
	const oktaProgress = useStore((s) => s.oktaProgress)
	const heptaPity = useStore((s) => s.heptaPity)
	const oktaPity = useStore((s) => s.oktaPity)

	// Get step history from ring buffer - separate selector for performance
	const getStepHistory = useStore((s) => s.getStepHistory)
	const stepHistory = getStepHistory()

	const logRef = useRef<HTMLDivElement>(null)
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const isActiveRef = useRef(false)
	const [flash, setFlash] = useState<FlashType>('none')
	const [isCalculating, setIsCalculating] = useState(false)

	// Calculate displayed time based on speed mode
	const displayedTime = useMemo(() => {
		if (speed === 'regular') {
			// Real elapsed time for in-game mode (whole seconds)
			const currentElapsed =
				isRunning && !isPaused && simulationStartTime
					? (Date.now() - simulationStartTime) / 1000
					: 0
			return Math.floor(simulationElapsedTime + currentElapsed)
		}
		// Estimated in-game time for instant/fast modes
		return Math.floor(attempts * UI_CONSTANTS.AVG_ANIMATION_TIME)
	}, [speed, attempts, isRunning, isPaused, simulationStartTime, simulationElapsedTime])

	// Virtual list for log entries - only renders visible items (~30 instead of 20,000+)
	const virtualizer = useVirtualizer({
		count: stepHistory.length,
		getScrollElement: () => logRef.current,
		estimateSize: () => 20, // Approximate height of each log entry
		overscan: 5, // Extra items to render above/below viewport
	})

	// Centralized cleanup - stops loop immediately and clears pending timeouts
	const cleanup = useCallback(() => {
		isActiveRef.current = false
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current)
			timeoutRef.current = null
		}
		setIsCalculating(false)
	}, [])

	// Auto-scroll to latest entry using virtualizer
	useEffect(() => {
		if (stepHistory.length > 0) {
			virtualizer.scrollToIndex(stepHistory.length - 1, { align: 'end' })
		}
	}, [stepHistory.length, virtualizer])

	// Start simulation on mount
	useEffect(() => {
		startSimulation()
		return () => {
			cleanup()
			stopSimulation()
		}
	}, [cleanup])

	// Trigger flash animation (only in regular speed mode)
	const triggerFlash = (type: FlashType, duration: number) => {
		if (speed !== 'regular') return
		setFlash(type)
		setTimeout(() => setFlash('none'), duration)
	}

	// Run simulation loop
	useEffect(() => {
		// Stop if not running or paused
		if (!isRunning || isPaused) {
			cleanup()
			return
		}

		// Activate loop
		isActiveRef.current = true
		if (speed === 'instant') {
			setIsCalculating(true)
		}

		const runStep = () => {
			// Check flag before each step
			if (!isActiveRef.current) return

			const step = stepSimulation()
			if (!step) {
				cleanup()
				return
			}

			if (speed === 'instant') {
				// Run in chunks to allow UI updates
				const runChunk = () => {
					for (let i = 0; i < UI_CONSTANTS.INSTANT_CHUNK_SIZE; i++) {
						// Check flag EVERY iteration for immediate pause
						if (!isActiveRef.current) return
						if (!stepSimulation()) {
							cleanup()
							return
						}
					}
					// Only schedule next chunk if still active
					if (isActiveRef.current) {
						timeoutRef.current = setTimeout(runChunk, 0)
					}
				}
				timeoutRef.current = setTimeout(runChunk, 0)
			} else if (speed === 'fast') {
				if (isActiveRef.current) {
					timeoutRef.current = setTimeout(runStep, 1)
				}
			} else {
				// Regular speed - random 0.5-1.0 second per step with flash animations
				const isComplete = step.endingLevel >= config.targetLevel && step.success
				if (isComplete) {
					triggerFlash('complete', 1000)
				} else if (step.success) {
					triggerFlash('success', 100)
				} else {
					triggerFlash('fail', 100)
				}

				if (isActiveRef.current) {
					const delay = 500 + Math.random() * 500
					timeoutRef.current = setTimeout(runStep, delay)
				}
			}
		}

		runStep()

		return cleanup
	}, [isRunning, isPaused, speed, cleanup])

	const handleRestart = () => {
		cleanup()
		setFlash('none')
		startSimulation()
	}

	// Flash overlay styles
	const flashStyles: Record<FlashType, string> = {
		none: '',
		success: 'fixed inset-0 z-[100] pointer-events-none bg-success/40 animate-flash-short',
		fail: 'fixed inset-0 z-[100] pointer-events-none bg-black/50 animate-flash-short',
		complete:
			'fixed inset-0 z-[100] pointer-events-none bg-gradient-to-r from-success/60 via-accent/60 to-success/60 animate-flash-long',
	}

	return (
		<div className="h-full flex flex-col gap-3">
			{/* Flash overlay */}
			{flash !== 'none' && <div className={flashStyles[flash]} />}

			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="icon"
						onClick={() => {
							stopSimulation()
							setPage('awakening-config')
						}}
					>
						<ArrowLeft className="w-4 h-4" />
					</Button>
					<span className="text-sm font-medium">Simulation</span>
					<SimulationHistory />
				</div>
				<div className="flex items-center gap-2 text-xs">
					<span>Target: +{ROMAN_NUMERALS[config.targetLevel]}</span>
					<span>|</span>
					<span>Current: +{ROMAN_NUMERALS[currentLevel]}</span>
					<span>|</span>
					<span>Max: +{ROMAN_NUMERALS[maxLevel]}</span>
					<span>|</span>
					<span>Attempts: {attempts}</span>
				</div>
			</div>

			{/* Log */}
			<Card className="flex-1 overflow-hidden relative">
				<CardContent className="p-0 h-full">
					<div ref={logRef} className="h-full overflow-y-auto p-3 text-xs font-mono">
						{stepHistory.length === 0 && !isCalculating && (
							<div className="text-muted-foreground">Starting enhancement simulation...</div>
						)}
						{/* Virtualized list - only renders ~30 visible items instead of 20,000+ */}
						<div
							style={{
								height: `${virtualizer.getTotalSize()}px`,
								width: '100%',
								position: 'relative',
							}}
						>
							{virtualizer.getVirtualItems().map((virtualItem) => (
								<div
									key={virtualItem.key}
									style={{
										position: 'absolute',
										top: 0,
										left: 0,
										width: '100%',
										transform: `translateY(${virtualItem.start}px)`,
									}}
								>
									<LogEntry step={stepHistory[virtualItem.index]} />
								</div>
							))}
						</div>
						{!isRunning && !isCalculating && stepHistory.length > 0 && (
							<div className="mt-4 p-3 bg-success/20 rounded text-success font-semibold text-center">
								REACHED +{ROMAN_NUMERALS[config.targetLevel]}!
							</div>
						)}
					</div>
				</CardContent>
				{isCalculating && (
					<div className="absolute inset-0 bg-background/80 flex items-center justify-center">
						<div className="flex items-center gap-2">
							<Loader2 className="w-6 h-6 animate-spin" />
							<span className="text-sm">Calculating...</span>
						</div>
					</div>
				)}
			</Card>

			{/* Stats */}
			<div className="grid grid-cols-2 gap-3">
				{/* Anvil Pity & Successes */}
				<Card>
					<CardContent className="px-3 py-2 text-xs">
						{/* Column Headers */}
						<div className="grid grid-cols-3 gap-1 mb-1 text-muted-foreground font-medium">
							<span></span>
							<span className="text-right">Pity</span>
							<span className="text-right">OK</span>
						</div>
						{/* Level rows */}
						{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
							<div key={level} className="grid grid-cols-3 gap-1">
								<span className="font-medium">{ROMAN_NUMERALS[level]}</span>
								<span className="text-right">
									{ANVIL_THRESHOLDS[level] > 0
										? `${anvilEnergy[level] ?? 0}/${ANVIL_THRESHOLDS[level]}`
										: '-'}
								</span>
								<span className="text-right text-success">{levelSuccesses[level] ?? 0}</span>
							</div>
						))}
						{config.useHepta && (
							<div className="grid grid-cols-3 gap-1 border-t pt-1 mt-1">
								<span className="font-medium">Hepta</span>
								<span className="text-right">
									{heptaPity}/{HEPTA_OKTA_ANVIL_PITY}
								</span>
								<span className="text-right text-accent">
									{heptaProgress}/{HEPTA_SUB_ENHANCEMENTS}
								</span>
							</div>
						)}
						{config.useOkta && (
							<div className="grid grid-cols-3 gap-1">
								<span className="font-medium">Okta</span>
								<span className="text-right">
									{oktaPity}/{HEPTA_OKTA_ANVIL_PITY}
								</span>
								<span className="text-right text-accent">
									{oktaProgress}/{OKTA_SUB_ENHANCEMENTS}
								</span>
							</div>
						)}
					</CardContent>
				</Card>

				{/* Resources */}
				<Card>
					<CardHeader className="py-2 px-3">
						<CardTitle className="text-xs">Resources Spent</CardTitle>
					</CardHeader>
					<CardContent className="px-3 pb-2 text-xs space-y-0.5">
						<div className="flex justify-between">
							<span>Crystals:</span>
							<span>{formatNumber(stats.crystals)}</span>
						</div>
						<div className="flex justify-between">
							<span>Exquisite:</span>
							<span>{formatNumber(stats.exquisiteCrystals)}</span>
						</div>
						<div className="flex justify-between">
							<span>Scrolls:</span>
							<span>{formatNumber(stats.scrolls)}</span>
						</div>
						<div className="flex justify-between">
							<span>Valks +10%:</span>
							<span>{stats.valks10Used}</span>
						</div>
						<div className="flex justify-between">
							<span>Valks +50%:</span>
							<span>{stats.valks50Used}</span>
						</div>
						<div className="flex justify-between">
							<span>Valks +100%:</span>
							<span>{stats.valks100Used}</span>
						</div>
						<div className="flex justify-between border-t pt-1 mt-1 font-semibold text-primary">
							<span>Silver:</span>
							<span>{formatSilver(stats.silver)}</span>
						</div>
						<div className="flex justify-between text-muted-foreground">
							<span>Time:</span>
							<span>{formatTime(displayedTime)}</span>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Controls */}
			<div className="flex gap-2">
				<Button
					variant="outline"
					onClick={() => {
						stopSimulation()
						setPage('awakening-config')
					}}
				>
					Back
				</Button>
				<Button
					variant={isPaused ? 'success' : 'default'}
					onClick={() => (isPaused ? resumeSimulation() : pauseSimulation())}
					disabled={!isRunning}
					className="flex-1"
				>
					{isPaused ? (
						<>
							<Play className="w-4 h-4 mr-1" /> Resume
						</>
					) : (
						<>
							<Pause className="w-4 h-4 mr-1" /> Pause
						</>
					)}
				</Button>
				<Button variant="outline" onClick={handleRestart} disabled={isCalculating}>
					{isCalculating ? (
						<Loader2 className="w-4 h-4 mr-1 animate-spin" />
					) : (
						<RotateCcw className="w-4 h-4 mr-1" />
					)}
					{isCalculating ? 'Calculating...' : 'Restart'}
				</Button>
			</div>
		</div>
	)
}

const LogEntry = memo(function LogEntry({ step }: { step: StepResult }) {
	if (step.isHeptaOkta) {
		const maxSubs = step.pathName === 'Okta' ? OKTA_SUB_ENHANCEMENTS : HEPTA_SUB_ENHANCEMENTS

		if (step.pathComplete) {
			return (
				<div className="text-accent font-semibold">
					═══ {step.pathName} COMPLETE! {ROMAN_NUMERALS[step.startingLevel]} →{' '}
					{ROMAN_NUMERALS[step.endingLevel]} ═══
				</div>
			)
		}

		return (
			<div>
				<span className="text-accent">{step.pathName}</span> ({step.subProgress}/{maxSubs}):{' '}
				{step.anvilTriggered ? (
					<span className="text-warning font-semibold">ANVIL SUCCESS!</span>
				) : step.success ? (
					<span className="text-success">SUB SUCCESS</span>
				) : (
					<span className="text-destructive">
						FAIL (pity: {step.subPity}/{HEPTA_OKTA_ANVIL_PITY})
					</span>
				)}
			</div>
		)
	}

	return (
		<div>
			<span className="font-semibold">{ROMAN_NUMERALS[step.startingLevel]}</span>
			{' → '}
			<span className="font-semibold">{ROMAN_NUMERALS[step.startingLevel + 1]}</span>:{' '}
			{step.anvilTriggered ? (
				<span className="text-warning font-semibold">ANVIL SUCCESS!</span>
			) : step.success ? (
				<span className="text-success">SUCCESS</span>
			) : (
				<span className="text-destructive">FAIL</span>
			)}
			{step.valksUsed && <span className="text-accent"> (Valks +{step.valksUsed}%)</span>}
			{step.restorationAttempted && (
				<>
					{' | Restoration: '}
					{step.restorationSuccess ? (
						<span className="text-info">SAVED</span>
					) : (
						<span className="text-destructive font-semibold">
							FAILED ↓ {ROMAN_NUMERALS[step.endingLevel]}
						</span>
					)}
				</>
			)}
			{step.success && !step.restorationAttempted && (
				<span className="text-success font-semibold">
					{' '}
					↑ Now at +{ROMAN_NUMERALS[step.endingLevel]}
				</span>
			)}
		</div>
	)
})
