import {
	DEFAULT_CONFIG,
	DEFAULT_PRICES,
	HEPTA_SUB_ENHANCEMENTS,
	OKTA_SUB_ENHANCEMENTS,
	ROMAN_NUMERALS,
} from '@bdm-sim/simulator'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useEffect } from 'react'

import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { useStore } from '@/hooks/use-store'
import { useStrategyWorker } from '@/hooks/use-strategy-worker'
import { formatNumber, formatSilver } from '@/lib/utils'

export function HeptaOktaStrategyPage() {
	const { config, numSimulations, setPage, heptaOktaStrategyResults, setHeptaOktaStrategyResults } =
		useStore()

	const { runHeptaOktaStrategy, heptaOktaProgress, isHeptaOktaRunning } = useStrategyWorker()

	// Strategy finder uses isolated config - only targetLevel from user's config
	const strategyConfig = {
		...DEFAULT_CONFIG,
		targetLevel: config.targetLevel,
		prices: DEFAULT_PRICES,
	}

	useEffect(() => {
		if (heptaOktaStrategyResults.length === 0) {
			startAnalysis()
		}
	}, [])

	const startAnalysis = async () => {
		try {
			const results = await runHeptaOktaStrategy(strategyConfig, DEFAULT_PRICES, numSimulations)
			setHeptaOktaStrategyResults(results)
		} catch (error) {
			console.error('Strategy analysis failed:', error)
		}
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
						Target: +{ROMAN_NUMERALS[config.targetLevel]} | {numSimulations.toLocaleString()}{' '}
						simulations per strategy
					</p>
				</div>
			</div>

			{/* Progress */}
			{isHeptaOktaRunning && (
				<Card>
					<CardContent className="py-4">
						<div className="flex items-center gap-3">
							<Loader2 className="w-4 h-4 animate-spin" />
							<div className="flex-1">
								<div className="h-2 bg-muted rounded-full overflow-hidden">
									<div
										className="h-full bg-primary transition-all duration-300"
										style={{ width: `${heptaOktaProgress}%` }}
									/>
								</div>
							</div>
							<span className="text-sm text-muted-foreground">{heptaOktaProgress.toFixed(0)}%</span>
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
										<th rowSpan={2} className="px-3 py-2 text-left font-medium">
											Strategy
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
										<th className="px-3 py-1 text-right font-normal">Exquisite</th>
										<th className="px-3 py-1 text-right font-normal border-l text-muted-foreground">
											Silver
										</th>
										<th className="px-3 py-1 text-right font-normal text-muted-foreground">
											Crystals
										</th>
										<th className="px-3 py-1 text-right font-normal text-muted-foreground">
											Exquisite
										</th>
										<th className="px-3 py-1 text-right font-normal border-l text-muted-foreground">
											Silver
										</th>
										<th className="px-3 py-1 text-right font-normal text-muted-foreground">
											Crystals
										</th>
										<th className="px-3 py-1 text-right font-normal text-muted-foreground">
											Exquisite
										</th>
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
													{idx === 0 && <span className="ml-2 text-success text-[10px]">BEST</span>}
												</td>
												<td className="px-3 py-2 text-right border-l">
													{formatSilver(result.p50.silver)}
												</td>
												<td className="px-3 py-2 text-right">
													{formatNumber(result.p50.crystals)}
												</td>
												<td className="px-3 py-2 text-right">
													{formatNumber(result.p50.exquisite)}
												</td>
												<td className="px-3 py-2 text-right border-l text-muted-foreground">
													{formatSilver(result.p90.silver)}
												</td>
												<td className="px-3 py-2 text-right text-muted-foreground">
													{formatNumber(result.p90.crystals)}
												</td>
												<td className="px-3 py-2 text-right text-muted-foreground">
													{formatNumber(result.p90.exquisite)}
												</td>
												<td className="px-3 py-2 text-right border-l text-muted-foreground">
													{formatSilver(result.worst.silver)}
												</td>
												<td className="px-3 py-2 text-right text-muted-foreground">
													{formatNumber(result.worst.crystals)}
												</td>
												<td className="px-3 py-2 text-right text-muted-foreground">
													{formatNumber(result.worst.exquisite)}
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
						<strong>Hepta</strong> (VII→VIII): Complete {HEPTA_SUB_ENHANCEMENTS} sub-enhancements
						using Exquisite Black Crystals to guarantee level up. Uses anvil pity system for
						sub-enhancements.
					</p>
					<p>
						<strong>Okta</strong> (VIII→IX): Complete {OKTA_SUB_ENHANCEMENTS} sub-enhancements using
						Exquisite Black Crystals to guarantee level up. Uses anvil pity system for
						sub-enhancements.
					</p>
					<p>
						<strong>Exquisite Black Crystal</strong>: Crafted from 1,050 Restoration Scrolls + 30
						Pristine Black Crystals + 2 Valks +100%.
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
				<Button onClick={startAnalysis} disabled={isHeptaOktaRunning} className="flex-1">
					{isHeptaOktaRunning ? (
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
