import { ROMAN_NUMERALS } from '@bdm-sim/simulator'

import { useSimulator } from '@/hooks/use-simulator'
import { formatNumber, formatSilver } from '@/lib/utils'

import { Card, CardContent, CardHeader, CardTitle, Progress } from './ui'

export function SimulatorResults() {
	const { currentResult, monteCarloResult, progress, isRunning, targetLevel } = useSimulator()

	return (
		<div className="space-y-4">
			{/* Progress */}
			{isRunning && (
				<Card>
					<CardContent className="pt-6">
						<div className="space-y-2">
							<div className="flex justify-between text-sm">
								<span>Running simulation...</span>
								<span>{progress.toFixed(0)}%</span>
							</div>
							<Progress value={progress} />
						</div>
					</CardContent>
				</Card>
			)}

			{/* Single Simulation Result */}
			{currentResult && !monteCarloResult && (
				<Card>
					<CardHeader>
						<CardTitle>
							Simulation Result → {ROMAN_NUMERALS[targetLevel]}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-2 gap-4 text-sm">
							<StatItem label="Total Attempts" value={currentResult.totalAttempts} />
							<StatItem label="Successes" value={currentResult.successes} />
							<StatItem label="Failures" value={currentResult.failures} />
							<StatItem label="Level Drops" value={currentResult.levelDrops} />
							<StatItem label="Anvil Triggers" value={currentResult.anvilTriggers} />
							<StatItem label="Restorations Used" value={currentResult.restorationAttempts} />
							<StatItem
								label="Crystals Used"
								value={currentResult.materialsUsed.pristine_black_crystal ?? 0}
							/>
							<StatItem
								label="Scrolls Used"
								value={currentResult.materialsUsed.restoration_scroll ?? 0}
							/>
							<div className="col-span-2 pt-2 border-t">
								<StatItem
									label="Total Cost"
									value={formatSilver(currentResult.silverCost)}
									highlight
								/>
							</div>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Monte Carlo Results */}
			{monteCarloResult && (
				<Card>
					<CardHeader>
						<CardTitle>
							Monte Carlo Results ({formatNumber(monteCarloResult.numSimulations)} runs) →{' '}
							{ROMAN_NUMERALS[targetLevel]}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							{/* Attempts */}
							<StatsSection title="Attempts" stats={monteCarloResult.attempts} />

							{/* Silver Cost */}
							<StatsSection
								title="Silver Cost"
								stats={monteCarloResult.silverCost}
								formatter={formatSilver}
							/>

							{/* Crystals */}
							<StatsSection title="Pristine Black Crystals" stats={monteCarloResult.pristineBlackCrystals} />

							{/* Scrolls */}
							<StatsSection title="Restoration Scrolls" stats={monteCarloResult.restorationScrolls} />

							{/* Level Drops */}
							<StatsSection title="Level Drops" stats={monteCarloResult.levelDrops} />
						</div>
					</CardContent>
				</Card>
			)}

			{/* Empty State */}
			{!currentResult && !monteCarloResult && !isRunning && (
				<Card>
					<CardContent className="pt-6">
						<p className="text-center text-muted-foreground">
							Configure your settings and run a simulation to see results.
						</p>
					</CardContent>
				</Card>
			)}
		</div>
	)
}

function StatItem({
	label,
	value,
	highlight,
}: {
	label: string
	value: number | string
	highlight?: boolean
}) {
	return (
		<div className={highlight ? 'text-lg font-semibold' : ''}>
			<span className="text-muted-foreground">{label}:</span>{' '}
			<span className={highlight ? 'text-primary' : ''}>{typeof value === 'number' ? formatNumber(value) : value}</span>
		</div>
	)
}

function StatsSection({
	title,
	stats,
	formatter = formatNumber,
}: {
	title: string
	stats: { average: number; p50: number; p90: number; p99: number; worst?: number }
	formatter?: (n: number) => string
}) {
	return (
		<div className="space-y-2">
			<h4 className="font-medium text-sm">{title}</h4>
			<div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
				<div className="bg-muted/50 p-2 rounded">
					<div className="text-muted-foreground text-xs">Average</div>
					<div className="font-mono">{formatter(stats.average)}</div>
				</div>
				<div className="bg-muted/50 p-2 rounded">
					<div className="text-muted-foreground text-xs">Median (P50)</div>
					<div className="font-mono">{formatter(stats.p50)}</div>
				</div>
				<div className="bg-muted/50 p-2 rounded">
					<div className="text-muted-foreground text-xs">P90</div>
					<div className="font-mono">{formatter(stats.p90)}</div>
				</div>
				<div className="bg-muted/50 p-2 rounded">
					<div className="text-muted-foreground text-xs">P99</div>
					<div className="font-mono">{formatter(stats.p99)}</div>
				</div>
				{stats.worst !== undefined && (
					<div className="bg-destructive/20 p-2 rounded">
						<div className="text-muted-foreground text-xs">Worst</div>
						<div className="font-mono text-destructive">{formatter(stats.worst)}</div>
					</div>
				)}
			</div>
		</div>
	)
}
