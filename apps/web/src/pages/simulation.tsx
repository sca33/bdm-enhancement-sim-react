import {
	ANVIL_THRESHOLDS,
	HEPTA_OKTA_ANVIL_PITY,
	HEPTA_SUB_ENHANCEMENTS,
	OKTA_SUB_ENHANCEMENTS,
	ROMAN_NUMERALS,
} from '@bdm-sim/simulator'
import { ArrowLeft, Pause, Play, RotateCcw } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { useStore } from '@/hooks/use-store'
import { formatNumber, formatSilver, formatTime } from '@/lib/utils'

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

	// Run simulation loop
	useEffect(() => {
		if (!isRunning || isPaused) return

		const runStep = () => {
			const step = stepSimulation()
			if (!step) return

			if (speed === 'instant') {
				// Run all remaining steps immediately
				while (stepSimulation()) {}
			} else if (speed === 'fast') {
				animationRef.current = requestAnimationFrame(() => {
					setTimeout(runStep, 1)
				})
			} else {
				// Regular speed - 1 second per step
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
		startSimulation()
	}

	return (
		<div className="h-full flex flex-col gap-3">
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
			<Card className="flex-1 overflow-hidden">
				<CardContent className="p-0 h-full">
					<div ref={logRef} className="h-full overflow-y-auto p-3 text-xs font-mono space-y-0.5">
						{stepHistory.length === 0 && (
							<div className="text-muted-foreground">Starting enhancement simulation...</div>
						)}
						{stepHistory.map((step, i) => (
							<LogEntry key={i} step={step} />
						))}
						{!isRunning && stepHistory.length > 0 && (
							<div className="mt-4 p-3 bg-success/20 rounded text-success font-semibold text-center">
								REACHED +{ROMAN_NUMERALS[config.targetLevel]}!
							</div>
						)}
					</div>
				</CardContent>
			</Card>

			{/* Stats */}
			<div className="grid grid-cols-2 gap-3">
				{/* Anvil Pity */}
				<Card>
					<CardHeader className="py-2 px-3">
						<CardTitle className="text-xs">Anvil Pity (V-X)</CardTitle>
					</CardHeader>
					<CardContent className="px-3 pb-2 text-xs space-y-0.5">
						{[5, 6, 7, 8, 9, 10].map((level) => (
							<div key={level} className="flex justify-between">
								<span>{ROMAN_NUMERALS[level]}:</span>
								<span>{anvilEnergy[level] ?? 0}/{ANVIL_THRESHOLDS[level]}</span>
							</div>
						))}
						{config.useHepta && (
							<div className="flex justify-between border-t pt-1 mt-1">
								<span>Hepta:</span>
								<span>{heptaProgress}/{HEPTA_SUB_ENHANCEMENTS} ({heptaPity}/{HEPTA_OKTA_ANVIL_PITY})</span>
							</div>
						)}
						{config.useOkta && (
							<div className="flex justify-between">
								<span>Okta:</span>
								<span>{oktaProgress}/{OKTA_SUB_ENHANCEMENTS} ({oktaPity}/{HEPTA_OKTA_ANVIL_PITY})</span>
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
				<Button variant="outline" onClick={handleRestart}>
					<RotateCcw className="w-4 h-4 mr-1" />
					Restart
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
