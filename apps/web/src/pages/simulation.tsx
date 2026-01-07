import {
	ANVIL_THRESHOLDS,
	HEPTA_OKTA_ANVIL_PITY,
	HEPTA_SUB_ENHANCEMENTS,
	OKTA_SUB_ENHANCEMENTS,
	ROMAN_NUMERALS,
} from '@bdm-sim/simulator'
import { ArrowLeft, Loader2, Pause, Play, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { useStore } from '@/hooks/use-store'
import { formatNumber, formatSilver, formatTime } from '@/lib/utils'

type FlashType = 'none' | 'success' | 'fail' | 'complete'

export function SimulationPage() {
	const {
		config,
		setPage,
		speed,
		isRunning,
		isPaused,
		currentLevel,
		maxLevel,
		attempts,
		anvilEnergy,
		levelSuccesses,
		heptaProgress,
		oktaProgress,
		heptaPity,
		oktaPity,
		stats,
		stepHistory,
		startSimulation,
		pauseSimulation,
		resumeSimulation,
		stopSimulation,
		stepSimulation,
	} = useStore()

	const logRef = useRef<HTMLDivElement>(null)
	const animationRef = useRef<number | null>(null)
	const [flash, setFlash] = useState<FlashType>('none')
	const [isCalculating, setIsCalculating] = useState(false)

	// Auto-scroll log
	useEffect(() => {
		if (logRef.current) {
			logRef.current.scrollTop = logRef.current.scrollHeight
		}
	}, [stepHistory.length])

	// Start simulation on mount
	useEffect(() => {
		startSimulation()
		return () => {
			if (animationRef.current) {
				cancelAnimationFrame(animationRef.current)
			}
			stopSimulation()
		}
	}, [])

	// Trigger flash animation (only in regular speed mode)
	const triggerFlash = (type: FlashType, duration: number) => {
		if (speed !== 'regular') return
		setFlash(type)
		setTimeout(() => setFlash('none'), duration)
	}

	// Run simulation loop
	useEffect(() => {
		if (!isRunning || isPaused) return

		const runStep = () => {
			const step = stepSimulation()
			if (!step) return

			if (speed === 'instant') {
				// Run all steps with a brief delay to allow UI to show loading state
				setIsCalculating(true)
				setTimeout(() => {
					while (stepSimulation()) {}
					setIsCalculating(false)
				}, 0)
				return
			} else if (speed === 'fast') {
				animationRef.current = requestAnimationFrame(() => {
					setTimeout(runStep, 1)
				})
			} else {
				// Regular speed - 1 second per step with flash animations
				const isComplete = step.endingLevel >= config.targetLevel && step.success
				if (isComplete) {
					triggerFlash('complete', 1000)
				} else if (step.success) {
					triggerFlash('success', 100)
				} else {
					triggerFlash('fail', 100)
				}

				animationRef.current = requestAnimationFrame(() => {
					setTimeout(runStep, 1000)
				})
			}
		}

		runStep()

		return () => {
			if (animationRef.current) {
				cancelAnimationFrame(animationRef.current)
			}
		}
	}, [isRunning, isPaused, speed])

	const handleRestart = () => {
		if (animationRef.current) {
			cancelAnimationFrame(animationRef.current)
		}
		setFlash('none')
		if (speed === 'instant') {
			setIsCalculating(true)
		}
		startSimulation()
	}

	// Flash overlay styles
	const flashStyles: Record<FlashType, string> = {
		none: '',
		success: 'fixed inset-0 z-[100] pointer-events-none bg-success/40 animate-flash-short',
		fail: 'fixed inset-0 z-[100] pointer-events-none bg-black/50 animate-flash-short',
		complete: 'fixed inset-0 z-[100] pointer-events-none bg-gradient-to-r from-success/60 via-accent/60 to-success/60 animate-flash-long',
	}

	return (
		<div className="h-full flex flex-col gap-3">
			{/* Flash overlay */}
			{flash !== 'none' && <div className={flashStyles[flash]} />}

			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Button variant="ghost" size="icon" onClick={() => { stopSimulation(); setPage('awakening-config') }}>
						<ArrowLeft className="w-4 h-4" />
					</Button>
					<span className="text-sm font-medium">Simulation</span>
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
					<div ref={logRef} className="h-full overflow-y-auto p-3 text-xs font-mono space-y-0.5">
						{stepHistory.length === 0 && !isCalculating && (
							<div className="text-muted-foreground">Starting enhancement simulation...</div>
						)}
						{stepHistory.map((step, i) => (
							<LogEntry key={i} step={step} />
						))}
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
						{[5, 6, 7, 8, 9, 10].map((level) => (
							<div key={level} className="grid grid-cols-3 gap-1">
								<span className="font-medium">{ROMAN_NUMERALS[level]}</span>
								<span className="text-right">{anvilEnergy[level] ?? 0}/{ANVIL_THRESHOLDS[level]}</span>
								<span className="text-right text-success">{levelSuccesses[level] ?? 0}</span>
							</div>
						))}
						{config.useHepta && (
							<div className="grid grid-cols-3 gap-1 border-t pt-1 mt-1">
								<span className="font-medium">Hepta</span>
								<span className="text-right">{heptaPity}/{HEPTA_OKTA_ANVIL_PITY}</span>
								<span className="text-right text-accent">{heptaProgress}/{HEPTA_SUB_ENHANCEMENTS}</span>
							</div>
						)}
						{config.useOkta && (
							<div className="grid grid-cols-3 gap-1">
								<span className="font-medium">Okta</span>
								<span className="text-right">{oktaPity}/{HEPTA_OKTA_ANVIL_PITY}</span>
								<span className="text-right text-accent">{oktaProgress}/{OKTA_SUB_ENHANCEMENTS}</span>
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
							<span>{formatTime(attempts)}</span>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Controls */}
			<div className="flex gap-2">
				<Button variant="outline" onClick={() => { stopSimulation(); setPage('awakening-config') }}>
					Back
				</Button>
				<Button
					variant={isPaused ? 'success' : 'default'}
					onClick={() => isPaused ? resumeSimulation() : pauseSimulation()}
					disabled={!isRunning}
					className="flex-1"
				>
					{isPaused ? <><Play className="w-4 h-4 mr-1" /> Resume</> : <><Pause className="w-4 h-4 mr-1" /> Pause</>}
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

function LogEntry({ step }: { step: ReturnType<typeof useStore.getState>['stepHistory'][0] }) {
	if (step.isHeptaOkta) {
		const maxSubs = step.pathName === 'Okta' ? OKTA_SUB_ENHANCEMENTS : HEPTA_SUB_ENHANCEMENTS

		if (step.pathComplete) {
			return (
				<div className="text-accent font-semibold">
					═══ {step.pathName} COMPLETE! {ROMAN_NUMERALS[step.startingLevel]} → {ROMAN_NUMERALS[step.endingLevel]} ═══
				</div>
			)
		}

		return (
			<div>
				<span className="text-accent">{step.pathName}</span>{' '}
				({step.subProgress}/{maxSubs}):{' '}
				{step.anvilTriggered ? (
					<span className="text-warning font-semibold">ANVIL SUCCESS!</span>
				) : step.success ? (
					<span className="text-success">SUB SUCCESS</span>
				) : (
					<span className="text-destructive">FAIL (pity: {step.subPity}/{HEPTA_OKTA_ANVIL_PITY})</span>
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
						<span className="text-destructive font-semibold">FAILED ↓ {ROMAN_NUMERALS[step.endingLevel]}</span>
					)}
				</>
			)}
			{step.success && !step.restorationAttempted && (
				<span className="text-success font-semibold"> ↑ Now at +{ROMAN_NUMERALS[step.endingLevel]}</span>
			)}
		</div>
	)
}
