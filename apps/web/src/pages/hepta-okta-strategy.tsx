import { HEPTA_SUB_ENHANCEMENTS, OKTA_SUB_ENHANCEMENTS, ROMAN_NUMERALS } from '@bdm-sim/simulator'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { useStore } from '@/hooks/use-store'
import { formatNumber, formatSilver } from '@/lib/utils'

export function HeptaOktaStrategyPage() {
	const {
		config,
		numSimulations,
		setPage,
		heptaOktaStrategyResults,
		strategyProgress,
		runHeptaOktaStrategy,
	} = useStore()
	const [isRunning, setIsRunning] = useState(false)

	useEffect(() => {
		if (heptaOktaStrategyResults.length === 0) {
			startAnalysis()
		}
	}, [])

	const startAnalysis = async () => {
		setIsRunning(true)
		await runHeptaOktaStrategy()
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
					<h2 className="text-xl font-semibold">Hepta/Okta Strategy Analysis</h2>
					<p className="text-xs text-muted-foreground">
						Target: +{ROMAN_NUMERALS[config.targetLevel]} | {numSimulations.toLocaleString()} simulations per strategy
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
							<span className="text-sm text-muted-foreground">
								{strategyProgress.toFixed(0)}%
							</span>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Results */}
			{heptaOktaStrategyResults.length > 0 && (
				<Card>
					<CardHeader className="py-3">
						<CardTitle className="text-sm">Results by Strategy</CardTitle>
						<p className="text-xs text-muted-foreground">
							Sorted by median (P50) silver cost | Restoration fixed at +VI
						</p>
					</CardHeader>
					<CardContent className="p-0">
						<div className="overflow-x-auto">
							<table className="w-full text-xs">
								<thead>
									<tr className="border-b bg-muted/50">
										<th className="px-3 py-2 text-left font-medium">Strategy</th>
										<th className="px-3 py-2 text-right font-medium">P50 Silver</th>
										<th className="px-3 py-2 text-right font-medium">Crystals</th>
										<th className="px-3 py-2 text-right font-medium">Exquisite</th>
										<th className="px-3 py-2 text-right font-medium">P90 Silver</th>
										<th className="px-3 py-2 text-right font-medium">Worst</th>
									</tr>
								</thead>
								<tbody>
									{[...heptaOktaStrategyResults]
										.sort((a, b) => a.p50.silver - b.p50.silver)
										.map((result, idx) => (
											<tr
												key={result.label}
												className={`border-b ${idx === 0 ? 'bg-success/10' : ''}`}
											>
												<td className="px-3 py-2 font-medium">
													{result.label}
													{idx === 0 && (
														<span className="ml-2 text-success text-[10px]">BEST</span>
													)}
												</td>
												<td className="px-3 py-2 text-right">{formatSilver(result.p50.silver)}</td>
												<td className="px-3 py-2 text-right">{formatNumber(result.p50.crystals)}</td>
												<td className="px-3 py-2 text-right">{formatNumber(result.p50.exquisite)}</td>
												<td className="px-3 py-2 text-right text-muted-foreground">
													{formatSilver(result.p90.silver)}
												</td>
												<td className="px-3 py-2 text-right text-muted-foreground">
													{formatSilver(result.worst.silver)}
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
					<CardTitle className="text-sm">Hepta/Okta Explained</CardTitle>
				</CardHeader>
				<CardContent className="text-xs text-muted-foreground space-y-2">
					<p>
						<strong>Hepta</strong> (VII→VIII): Complete {HEPTA_SUB_ENHANCEMENTS} sub-enhancements using Exquisite Black Crystals
						to guarantee level up. Uses anvil pity system for sub-enhancements.
					</p>
					<p>
						<strong>Okta</strong> (VIII→IX): Complete {OKTA_SUB_ENHANCEMENTS} sub-enhancements using Exquisite Black Crystals
						to guarantee level up. Uses anvil pity system for sub-enhancements.
					</p>
					<p>
						<strong>Exquisite Black Crystal</strong>: Crafted from 1,050 Restoration Scrolls +
						30 Pristine Black Crystals + 2 Valks +100%.
					</p>
					<p className="mt-2">
						These paths trade higher material cost for guaranteed progression at difficult levels.
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
