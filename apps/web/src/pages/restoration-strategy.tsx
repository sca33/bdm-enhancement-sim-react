import { ROMAN_NUMERALS } from '@bdm-sim/simulator'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { useStore } from '@/hooks/use-store'
import { formatNumber, formatSilver } from '@/lib/utils'

export function RestorationStrategyPage() {
	const {
		config,
		numSimulations,
		setPage,
		restorationStrategyResults,
		strategyProgress,
		runRestorationStrategy,
	} = useStore()
	const [isRunning, setIsRunning] = useState(false)

	useEffect(() => {
		if (restorationStrategyResults.length === 0) {
			startAnalysis()
		}
	}, [])

	const startAnalysis = async () => {
		setIsRunning(true)
		await runRestorationStrategy()
		setIsRunning(false)
	}

	return (
		<div className="space-y-4">
			{/* Header */}
			<div className="flex items-center gap-4">
				<Button variant="ghost" size="icon" onClick={() => setPage('awakening-config')}>
					<ArrowLeft className="w-4 h-4" />
				</Button>
				<div>
					<h2 className="text-xl font-semibold">Restoration Strategy Analysis</h2>
					<p className="text-xs text-muted-foreground">
						Target: +{ROMAN_NUMERALS[config.targetLevel]} | {numSimulations.toLocaleString()}{' '}
						simulations per strategy
					</p>
				</div>
			</div>

			{/* Progress */}
			{isRunning && (
				<Card>
					<CardContent className="py-4">
						<div className="flex items-center gap-3">
							<Loader2 className="w-4 h-4 animate-spin" />
							<div className="flex-1">
								<div className="h-2 bg-muted rounded-full overflow-hidden">
									<div
										className="h-full bg-primary transition-all duration-300"
										style={{ width: `${strategyProgress}%` }}
									/>
								</div>
							</div>
							<span className="text-sm text-muted-foreground">{strategyProgress.toFixed(0)}%</span>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Results */}
			{restorationStrategyResults.length > 0 && (
				<Card>
					<CardHeader className="py-3">
						<CardTitle className="text-sm">Results by Restoration Starting Level</CardTitle>
						<p className="text-xs text-muted-foreground">Sorted by median (P50) silver cost</p>
					</CardHeader>
					<CardContent className="p-0">
						<div className="overflow-x-auto">
							<table className="w-full text-xs">
								<thead>
									<tr className="border-b bg-muted/50">
										<th rowSpan={2} className="px-3 py-2 text-left font-medium">
											From
										</th>
										<th colSpan={3} className="px-3 py-1 text-center font-medium border-l">
											P50
										</th>
										<th
											colSpan={3}
											className="px-3 py-1 text-center font-medium border-l text-muted-foreground"
										>
											P90
										</th>
										<th
											colSpan={3}
											className="px-3 py-1 text-center font-medium border-l text-muted-foreground"
										>
											Worst
										</th>
									</tr>
									<tr className="border-b bg-muted/50">
										<th className="px-3 py-1 text-right font-normal border-l">Silver</th>
										<th className="px-3 py-1 text-right font-normal">Crystals</th>
										<th className="px-3 py-1 text-right font-normal">Scrolls</th>
										<th className="px-3 py-1 text-right font-normal border-l text-muted-foreground">
											Silver
										</th>
										<th className="px-3 py-1 text-right font-normal text-muted-foreground">
											Crystals
										</th>
										<th className="px-3 py-1 text-right font-normal text-muted-foreground">
											Scrolls
										</th>
										<th className="px-3 py-1 text-right font-normal border-l text-muted-foreground">
											Silver
										</th>
										<th className="px-3 py-1 text-right font-normal text-muted-foreground">
											Crystals
										</th>
										<th className="px-3 py-1 text-right font-normal text-muted-foreground">
											Scrolls
										</th>
									</tr>
								</thead>
								<tbody>
									{[...restorationStrategyResults]
										.sort((a, b) => a.p50.silver - b.p50.silver)
										.map((result, idx) => (
											<tr
												key={result.restorationFrom}
												className={`border-b ${idx === 0 ? 'bg-success/10' : ''}`}
											>
												<td className="px-3 py-2 font-medium">
													{result.label}
													{idx === 0 && <span className="ml-2 text-success text-[10px]">BEST</span>}
												</td>
												<td className="px-3 py-2 text-right border-l">
													{formatSilver(result.p50.silver)}
												</td>
												<td className="px-3 py-2 text-right">
													{formatNumber(result.p50.crystals)}
												</td>
												<td className="px-3 py-2 text-right">{formatNumber(result.p50.scrolls)}</td>
												<td className="px-3 py-2 text-right border-l text-muted-foreground">
													{formatSilver(result.p90.silver)}
												</td>
												<td className="px-3 py-2 text-right text-muted-foreground">
													{formatNumber(result.p90.crystals)}
												</td>
												<td className="px-3 py-2 text-right text-muted-foreground">
													{formatNumber(result.p90.scrolls)}
												</td>
												<td className="px-3 py-2 text-right border-l text-muted-foreground">
													{formatSilver(result.worst.silver)}
												</td>
												<td className="px-3 py-2 text-right text-muted-foreground">
													{formatNumber(result.worst.crystals)}
												</td>
												<td className="px-3 py-2 text-right text-muted-foreground">
													{formatNumber(result.worst.scrolls)}
												</td>
											</tr>
										))}
								</tbody>
							</table>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Explanation */}
			<Card>
				<CardHeader className="py-3">
					<CardTitle className="text-sm">How it works</CardTitle>
				</CardHeader>
				<CardContent className="text-xs text-muted-foreground space-y-2">
					<p>
						This analysis tests different restoration scroll starting levels to find the most
						cost-effective strategy.
					</p>
					<p>
						<strong>P50 (Median):</strong> 50% of simulations cost less than this
					</p>
					<p>
						<strong>P90:</strong> 90% of simulations cost less than this (unlucky scenario)
					</p>
					<p>
						<strong>Worst:</strong> Maximum cost observed across all simulations
					</p>
				</CardContent>
			</Card>

			{/* Actions */}
			<div className="flex gap-2">
				<Button variant="outline" onClick={() => setPage('awakening-config')}>
					Back
				</Button>
				<Button onClick={startAnalysis} disabled={isRunning} className="flex-1">
					{isRunning ? (
						<>
							<Loader2 className="w-4 h-4 mr-2 animate-spin" />
							Running...
						</>
					) : (
						'Re-run Analysis'
					)}
				</Button>
			</div>
		</div>
	)
}
