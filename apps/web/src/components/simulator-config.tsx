import { ROMAN_NUMERALS } from '@bdm-sim/simulator'

import { useSimulator } from '@/hooks/use-simulator'

import { Button, Card, CardContent, CardHeader, CardTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui'

export function SimulatorConfig() {
	const {
		targetLevel,
		strategy,
		setTargetLevel,
		setRestoration,
		setValks,
		runSimulation,
		runMonteCarlo,
		isRunning,
		reset,
	} = useSimulator()

	return (
		<Card>
			<CardHeader>
				<CardTitle>Enhancement Configuration</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Target Level */}
				<div className="space-y-2">
					<label className="text-sm font-medium">Target Level</label>
					<Select value={String(targetLevel)} onValueChange={(v) => setTargetLevel(Number(v))}>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
								<SelectItem key={level} value={String(level)}>
									{ROMAN_NUMERALS[level]} (+{level})
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{/* Restoration Strategy */}
				<div className="space-y-2">
					<label className="text-sm font-medium">Restoration Scrolls</label>
					<Select value={strategy.restoration} onValueChange={(v) => setRestoration(v as typeof strategy.restoration)}>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="never">Never Use</SelectItem>
							<SelectItem value="always">Always Use</SelectItem>
							<SelectItem value="above_threshold">Above +III Only</SelectItem>
							<SelectItem value="cost_efficient">Cost Efficient</SelectItem>
						</SelectContent>
					</Select>
				</div>

				{/* Valks Strategy */}
				<div className="space-y-2">
					<label className="text-sm font-medium">Advice of Valks</label>
					<Select value={strategy.valks} onValueChange={(v) => setValks(v as typeof strategy.valks)}>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="never">Never Use</SelectItem>
							<SelectItem value="small_only">+10% Only</SelectItem>
							<SelectItem value="large_only">+50% Only</SelectItem>
							<SelectItem value="large_high">+50% on VI+</SelectItem>
							<SelectItem value="optimal">Optimal (Auto)</SelectItem>
						</SelectContent>
					</Select>
				</div>

				{/* Action Buttons */}
				<div className="flex flex-col gap-2 pt-4">
					<Button onClick={() => runSimulation()} disabled={isRunning} className="w-full">
						{isRunning ? 'Simulating...' : 'Run Single Simulation'}
					</Button>
					<Button
						onClick={() => runMonteCarlo(10000)}
						disabled={isRunning}
						variant="secondary"
						className="w-full"
					>
						{isRunning ? 'Running...' : 'Run 10,000 Simulations'}
					</Button>
					<Button onClick={reset} variant="outline" className="w-full">
						Reset
					</Button>
				</div>
			</CardContent>
		</Card>
	)
}
