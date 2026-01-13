import {
	DEFAULT_CONFIG,
	DEFAULT_PRICES,
	HEPTA_SUB_ENHANCEMENTS,
	OKTA_SUB_ENHANCEMENTS,
	ROMAN_NUMERALS,
} from '@bdm-sim/simulator'
import { AlertTriangle, ArrowLeft, ChevronDown, ChevronRight, Loader2, Play } from 'lucide-react'
import { Fragment, useEffect, useState } from 'react'

import { DistributionHistogram, SurvivalCurve } from '@/components/distribution-graph'
import {
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui'
import { useStore } from '@/hooks/use-store'
import { useStrategyWorker } from '@/hooks/use-strategy-worker'
import { formatNumber, formatSilver } from '@/lib/utils'
import type {
	DistributionData,
	ResourceLimits,
	SurvivalCurvePoint,
} from '@/workers/strategy.worker'

type Tab = 'restoration' | 'hepta-okta'

export function StrategyFinderPage() {
	const { setPage, numSimulations, setNumSimulations } = useStore()
	const [activeTab, setActiveTab] = useState<Tab>('restoration')

	return (
		<div className="space-y-4">
			{/* Header */}
			<div className="flex items-center gap-4">
				<Button variant="ghost" size="icon" onClick={() => setPage('home')}>
					<ArrowLeft className="w-4 h-4" />
				</Button>
				<h2 className="text-xl font-semibold">Strategy Finder</h2>
			</div>

			{/* Tabs */}
			<div className="flex gap-2 border-b border-border pb-2">
				<Button
					variant={activeTab === 'restoration' ? 'default' : 'ghost'}
					size="sm"
					onClick={() => setActiveTab('restoration')}
				>
					Restoration Strategy
				</Button>
				<Button
					variant={activeTab === 'hepta-okta' ? 'default' : 'ghost'}
					size="sm"
					onClick={() => setActiveTab('hepta-okta')}
					className={activeTab === 'hepta-okta' ? '' : 'text-muted-foreground'}
				>
					Hepta/Okta Strategy
				</Button>
			</div>

			{/* Tab Content */}
			{activeTab === 'restoration' ? (
				<RestorationStrategyTab
					numSimulations={numSimulations}
					setNumSimulations={setNumSimulations}
				/>
			) : (
				<HeptaOktaStrategyTab
					numSimulations={numSimulations}
					setNumSimulations={setNumSimulations}
				/>
			)}
		</div>
	)
}

function RestorationStrategyTab({
	numSimulations,
	setNumSimulations,
}: {
	numSimulations: number
	setNumSimulations: (n: number) => void
}) {
	const { config } = useStore()
	const { runRestorationStrategy, restorationProgress, isRestorationRunning } = useStrategyWorker()

	// Local state for strategy configuration
	const [startLevel, setStartLevel] = useState(0)
	const [startHepta, setStartHepta] = useState(0)
	const [startOkta, setStartOkta] = useState(0)
	const [targetLevel, setTargetLevel] = useState(config.targetLevel)
	const [useHepta, setUseHepta] = useState(false)
	const [useOkta, setUseOkta] = useState(false)
	const [resources, setResources] = useState<ResourceLimits>({
		crystals: 1000,
		crystalsUnlimited: true,
		scrolls: 100000,
		scrollsUnlimited: true,
		valks10: 100,
		valks10Unlimited: true,
		valks50: 50,
		valks50Unlimited: true,
		valks100: 20,
		valks100Unlimited: true,
	})

	const [results, setResults] = useState<
		Array<{
			restorationFrom: number
			label: string
			successRate: number
			p50: {
				crystals: number
				scrolls: number
				silver: number
				exquisite: number
				valks10: number
				valks50: number
				valks100: number
			}
			p90: {
				crystals: number
				scrolls: number
				silver: number
				exquisite: number
				valks10: number
				valks50: number
				valks100: number
			}
			worst: {
				crystals: number
				scrolls: number
				silver: number
				exquisite: number
				valks10: number
				valks50: number
				valks100: number
			}
			distribution: DistributionData
			failedDistribution?: DistributionData
			expectedCostPerSuccess: number
			expectedAttempts: number
			meanCostAllRuns: number
			meanCostSuccessful: number
			survivalCurve?: SurvivalCurvePoint[]
		}>
	>([])

	const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())
	const [expandedRowViews, setExpandedRowViews] = useState<Map<number, 'histogram' | 'survival'>>(
		new Map(),
	)

	const updateResource = <K extends keyof ResourceLimits>(key: K, value: ResourceLimits[K]) => {
		setResources((prev) => ({ ...prev, [key]: value }))
	}

	const toggleRowExpansion = (restorationFrom: number) => {
		setExpandedRows((prev) => {
			const next = new Set(prev)
			if (next.has(restorationFrom)) {
				next.delete(restorationFrom)
			} else {
				next.add(restorationFrom)
			}
			return next
		})
	}

	// Check if all resources are unlimited
	const allUnlimited =
		resources.crystalsUnlimited &&
		resources.scrollsUnlimited &&
		resources.valks10Unlimited &&
		resources.valks50Unlimited &&
		resources.valks100Unlimited

	const runAnalysis = async () => {
		try {
			const strategyConfig = {
				...DEFAULT_CONFIG,
				startLevel,
				startHepta: startLevel === 7 ? startHepta : 0,
				startOkta: startLevel === 8 ? startOkta : 0,
				targetLevel,
				useHepta,
				useOkta,
				prices: DEFAULT_PRICES,
			}

			const rawResults = await runRestorationStrategy(
				strategyConfig,
				DEFAULT_PRICES,
				numSimulations,
				resources,
			)

			// Sort by completion rate (desc), then by P50 silver cost (asc) as tiebreaker
			const sortedResults = [...rawResults].sort((a, b) => {
				// First: completion rate descending
				if (b.successRate !== a.successRate) {
					return b.successRate - a.successRate
				}
				// Tiebreaker: P50 silver cost ascending
				return a.p50.silver - b.p50.silver
			})

			setResults(sortedResults)
		} catch (error) {
			console.error('Strategy analysis failed:', error)
		}
	}

	// Ensure startLevel < targetLevel when target changes
	useEffect(() => {
		if (startLevel >= targetLevel) {
			setStartLevel(Math.max(0, targetLevel - 1))
		}
		// Only react to targetLevel changes - startLevel adjustment is a side effect
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [targetLevel])

	return (
		<div className="space-y-4">
			{/* Configuration */}
			<Card>
				<CardHeader className="py-3">
					<CardTitle className="text-sm">Strategy Configuration</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					{/* Target & Start Level */}
					<div className="grid grid-cols-2 gap-3">
						<div>
							<label className="text-xs text-muted-foreground">Start Level</label>
							<Select value={String(startLevel)} onValueChange={(v) => setStartLevel(Number(v))}>
								<SelectTrigger className="mt-1">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => (
										<SelectItem key={level} value={String(level)} disabled={level >= targetLevel}>
											+{ROMAN_NUMERALS[level]} ({level})
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div>
							<label className="text-xs text-muted-foreground">Target Level</label>
							<Select value={String(targetLevel)} onValueChange={(v) => setTargetLevel(Number(v))}>
								<SelectTrigger className="mt-1">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
										<SelectItem key={level} value={String(level)}>
											+{ROMAN_NUMERALS[level]} ({level})
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>

					{/* Hepta Progress (when starting at +VII) */}
					{startLevel === 7 && (
						<div>
							<label className="text-xs text-muted-foreground">Start Hepta Progress</label>
							<Select value={String(startHepta)} onValueChange={(v) => setStartHepta(Number(v))}>
								<SelectTrigger className="mt-1">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{[0, 1, 2, 3, 4].map((p) => (
										<SelectItem key={p} value={String(p)}>
											{p}/{HEPTA_SUB_ENHANCEMENTS}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					)}

					{/* Okta Progress (when starting at +VIII) */}
					{startLevel === 8 && (
						<div>
							<label className="text-xs text-muted-foreground">Start Okta Progress</label>
							<Select value={String(startOkta)} onValueChange={(v) => setStartOkta(Number(v))}>
								<SelectTrigger className="mt-1">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((p) => (
										<SelectItem key={p} value={String(p)}>
											{p}/{OKTA_SUB_ENHANCEMENTS}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					)}

					{/* Hepta/Okta Checkboxes */}
					<div className="pt-2 border-t">
						<p className="text-xs font-medium mb-2">Hepta/Okta Failsafe (Exquisite Crystals)</p>
						<div className="space-y-2">
							<label className="flex items-center gap-2 cursor-pointer">
								<input
									type="checkbox"
									checked={useHepta}
									onChange={(e) => setUseHepta(e.target.checked)}
									className="w-4 h-4 rounded border-input"
								/>
								<span className="text-sm">Use Hepta for VII→VIII ({HEPTA_SUB_ENHANCEMENTS} subs)</span>
							</label>
							<label className="flex items-center gap-2 cursor-pointer">
								<input
									type="checkbox"
									checked={useOkta}
									onChange={(e) => setUseOkta(e.target.checked)}
									className="w-4 h-4 rounded border-input"
								/>
								<span className="text-sm">Use Okta for VIII→IX ({OKTA_SUB_ENHANCEMENTS} subs)</span>
							</label>
						</div>
					</div>

					{/* Simulations */}
					<div>
						<label className="text-xs text-muted-foreground">Simulations per strategy</label>
						<input
							type="number"
							value={numSimulations}
							onChange={(e) => setNumSimulations(Number.parseInt(e.target.value, 10) || 1000)}
							className="w-full mt-1 h-9 px-3 rounded-md border bg-input text-sm focus:outline-none focus:ring-1 focus:ring-ring"
						/>
					</div>
				</CardContent>
			</Card>

			{/* Resource Limits */}
			<Card>
				<CardHeader className="py-3">
					<CardTitle className="text-sm">Available Resources</CardTitle>
					<p className="text-xs text-muted-foreground">
						Set limits to calculate success rate and find optimal strategy
					</p>
				</CardHeader>
				<CardContent className="space-y-3">
					{/* Crystals */}
					<ResourceInput
						label="Pristine Black Crystals"
						value={resources.crystals}
						unlimited={resources.crystalsUnlimited}
						onChange={(v) => updateResource('crystals', v)}
						onUnlimitedChange={(v) => updateResource('crystalsUnlimited', v)}
					/>

					{/* Scrolls */}
					<ResourceInput
						label="Restoration Scrolls"
						value={resources.scrolls}
						unlimited={resources.scrollsUnlimited}
						onChange={(v) => updateResource('scrolls', v)}
						onUnlimitedChange={(v) => updateResource('scrollsUnlimited', v)}
					/>

					{/* Valks Section */}
					<div className="pt-2 border-t">
						<p className="text-xs font-medium mb-2">Valks (used in priority: 100 → 50 → 10)</p>
						<div className="grid grid-cols-3 gap-2">
							<ResourceInput
								label="+10%"
								value={resources.valks10}
								unlimited={resources.valks10Unlimited}
								onChange={(v) => updateResource('valks10', v)}
								onUnlimitedChange={(v) => updateResource('valks10Unlimited', v)}
								compact
							/>
							<ResourceInput
								label="+50%"
								value={resources.valks50}
								unlimited={resources.valks50Unlimited}
								onChange={(v) => updateResource('valks50', v)}
								onUnlimitedChange={(v) => updateResource('valks50Unlimited', v)}
								compact
							/>
							<ResourceInput
								label="+100%"
								value={resources.valks100}
								unlimited={resources.valks100Unlimited}
								onChange={(v) => updateResource('valks100', v)}
								onUnlimitedChange={(v) => updateResource('valks100Unlimited', v)}
								compact
							/>
						</div>
					</div>

					{!allUnlimited && (
						<p className="text-[10px] text-warning">
							Resource limits active - success rate will be calculated
						</p>
					)}
				</CardContent>
			</Card>

			{/* Run Button */}
			<Button onClick={runAnalysis} disabled={isRestorationRunning} className="w-full">
				{isRestorationRunning ? (
					<>
						<Loader2 className="w-4 h-4 mr-2 animate-spin" />
						Running... {restorationProgress.toFixed(0)}%
					</>
				) : (
					<>
						<Play className="w-4 h-4 mr-2" />
						Find Best Strategy
					</>
				)}
			</Button>

			{/* Progress */}
			{isRestorationRunning && (
				<div className="h-2 bg-muted rounded-full overflow-hidden">
					<div
						className="h-full bg-primary transition-all duration-300"
						style={{ width: `${restorationProgress}%` }}
					/>
				</div>
			)}

			{/* Results */}
			{results.length > 0 && (
				<Card>
					<CardHeader className="py-3">
						<CardTitle className="text-sm">Strategy Comparison</CardTitle>
						<p className="text-xs text-muted-foreground">
							+{ROMAN_NUMERALS[startLevel]} → +{ROMAN_NUMERALS[targetLevel]} | Sorted by completion
							%, then P50 cost
						</p>
					</CardHeader>
					<CardContent className="p-0">
						{/* Warning banner for low success rates */}
						{!allUnlimited && results.some((r) => r.successRate < 100) && (
							<div className="bg-muted/50 border-b border-border px-4 py-3">
								<div className="flex items-start gap-3">
									<AlertTriangle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
									<div className="text-xs">
										<p className="font-medium">P50/P90/Worst include all runs</p>
										<p className="text-muted-foreground mt-1">
											Statistics now include runs that hit crystal limits.{' '}
											<strong>Completion</strong> shows % of runs that reached the target. Failed
											runs show cost at crystal exhaustion.
										</p>
									</div>
								</div>
							</div>
						)}
						<div className="overflow-x-auto">
							<table className="w-full text-xs">
								<thead>
									<tr className="border-b bg-muted/50">
										<th rowSpan={2} className="px-3 py-2 text-left font-medium">
											Restoration From
										</th>
										{!allUnlimited && (
											<th
												rowSpan={2}
												className="px-2 py-2 text-center font-medium"
												title="% of runs that reached target before crystals ran out"
											>
												Completion
											</th>
										)}
										<th colSpan={3} className="px-3 py-1 text-center font-medium border-l">
											P50 (Median)
										</th>
										<th
											colSpan={3}
											className="px-3 py-1 text-center font-medium border-l text-muted-foreground"
										>
											P90 (Unlucky)
										</th>
										<th
											colSpan={3}
											className="px-3 py-1 text-center font-medium border-l text-muted-foreground"
										>
											Worst Case
										</th>
									</tr>
									<tr className="border-b bg-muted/50">
										<th className="px-3 py-1 text-right font-normal border-l">Silver</th>
										<th className="px-3 py-1 text-right font-normal">Crystals</th>
										<th className="px-3 py-1 text-right font-normal">Rest. Scrolls</th>
										<th className="px-3 py-1 text-right font-normal border-l text-muted-foreground">
											Silver
										</th>
										<th className="px-3 py-1 text-right font-normal text-muted-foreground">
											Crystals
										</th>
										<th className="px-3 py-1 text-right font-normal text-muted-foreground">
											Rest. Scrolls
										</th>
										<th className="px-3 py-1 text-right font-normal border-l text-muted-foreground">
											Silver
										</th>
										<th className="px-3 py-1 text-right font-normal text-muted-foreground">
											Crystals
										</th>
										<th className="px-3 py-1 text-right font-normal text-muted-foreground">
											Rest. Scrolls
										</th>
									</tr>
								</thead>
								<tbody>
									{results.map((result, idx) => {
										const isLowSuccess = result.successRate < 50
										const isHighSuccess = result.successRate >= 90
										const isExpanded = expandedRows.has(result.restorationFrom)
										const colSpan = allUnlimited ? 10 : 11
										return (
											<Fragment key={result.restorationFrom}>
												<tr
													onClick={() => toggleRowExpansion(result.restorationFrom)}
													className={`border-b cursor-pointer hover:bg-muted/30 transition-colors ${
														idx === 0 && (allUnlimited || result.successRate >= 50)
															? 'bg-success/10'
															: isLowSuccess && !allUnlimited
																? 'opacity-60'
																: ''
													}`}
												>
													<td className="px-3 py-2 font-medium">
														<div className="flex items-center gap-2">
															{isExpanded ? (
																<ChevronDown className="w-3 h-3 text-muted-foreground" />
															) : (
																<ChevronRight className="w-3 h-3 text-muted-foreground" />
															)}
															{result.label}
															{idx === 0 && (allUnlimited || result.successRate >= 50) && (
																<span className="text-success text-[10px] font-semibold">BEST</span>
															)}
														</div>
													</td>
													{!allUnlimited && (
														<td
															className={`px-2 py-2 text-center font-medium ${
																isLowSuccess
																	? 'text-destructive'
																	: isHighSuccess
																		? 'text-success'
																		: 'text-warning'
															}`}
														>
															{result.successRate.toFixed(0)}%
														</td>
													)}
													<td className="px-3 py-2 text-right border-l">
														{formatSilver(result.p50.silver)}
													</td>
													<td className="px-3 py-2 text-right">
														{formatNumber(result.p50.crystals)}
													</td>
													<td className="px-3 py-2 text-right">
														{formatNumber(result.p50.scrolls)}
													</td>
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
												{isExpanded && (
													<tr className="border-b bg-muted/20">
														<td colSpan={colSpan} className="px-4 py-3">
															{/* View toggle (only show when survival curve is available) */}
															{result.survivalCurve && result.survivalCurve.length > 0 && (
																<div className="flex gap-2 mb-3">
																	<button
																		type="button"
																		className={`px-2 py-1 text-xs rounded ${
																			(
																				expandedRowViews.get(result.restorationFrom) ?? 'histogram'
																			) === 'histogram'
																				? 'bg-primary text-primary-foreground'
																				: 'bg-muted text-muted-foreground hover:bg-muted/80'
																		}`}
																		onClick={(e) => {
																			e.stopPropagation()
																			setExpandedRowViews((prev) => {
																				const next = new Map(prev)
																				next.set(result.restorationFrom, 'histogram')
																				return next
																			})
																		}}
																	>
																		Distribution
																	</button>
																	<button
																		type="button"
																		className={`px-2 py-1 text-xs rounded ${
																			expandedRowViews.get(result.restorationFrom) === 'survival'
																				? 'bg-primary text-primary-foreground'
																				: 'bg-muted text-muted-foreground hover:bg-muted/80'
																		}`}
																		onClick={(e) => {
																			e.stopPropagation()
																			setExpandedRowViews((prev) => {
																				const next = new Map(prev)
																				next.set(result.restorationFrom, 'survival')
																				return next
																			})
																		}}
																	>
																		Success Probability
																	</button>
																</div>
															)}

															{/* Show histogram or survival curve based on selection */}
															{expandedRowViews.get(result.restorationFrom) === 'survival' &&
															result.survivalCurve &&
															result.survivalCurve.length > 0 ? (
																<SurvivalCurve
																	data={result.survivalCurve}
																	currentSuccessRate={result.successRate}
																/>
															) : (
																<DistributionHistogram
																	distribution={result.distribution}
																	failedDistribution={result.failedDistribution}
																/>
															)}
														</td>
													</tr>
												)}
											</Fragment>
										)
									})}
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
						The strategy finder runs Monte Carlo simulations to compare different restoration
						starting levels and finds the most cost-effective approach.
					</p>
					<p>
						<strong>Completion:</strong> % of simulations that reached the target level before
						crystals ran out. Failed runs are included in cost statistics.
					</p>
					<p>
						<strong>P50 (Median):</strong> 50% of ALL simulations cost less than this — includes
						both successful runs and runs that hit crystal limits.
					</p>
					<p>
						<strong>P90:</strong> 90% of ALL simulations cost less than this — prepare for bad luck.
					</p>
					<p>
						<strong>Worst Case:</strong> The most expensive simulation in the sample.
					</p>
					<p>
						<strong>Rest. Scrolls:</strong> Restoration scrolls used (200 per restoration attempt).
					</p>
				</CardContent>
			</Card>
		</div>
	)
}

function ResourceInput({
	label,
	value,
	unlimited,
	onChange,
	onUnlimitedChange,
	compact = false,
}: {
	label: string
	value: number
	unlimited: boolean
	onChange: (v: number) => void
	onUnlimitedChange: (v: boolean) => void
	compact?: boolean
}) {
	const inputId = `resource-${label.replace(/\s+/g, '-').toLowerCase()}`

	return (
		<div className={compact ? '' : 'space-y-1'}>
			<div className="flex items-center justify-between">
				<label htmlFor={inputId} className="text-xs text-muted-foreground">
					{label}
				</label>
				<label className="flex items-center gap-1.5 cursor-pointer select-none">
					<button
						type="button"
						role="switch"
						aria-checked={unlimited}
						onClick={() => onUnlimitedChange(!unlimited)}
						className={`relative w-7 h-4 rounded-full transition-colors ${
							unlimited ? 'bg-primary' : 'bg-muted'
						}`}
					>
						<span
							className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-background transition-transform ${
								unlimited ? 'translate-x-3' : 'translate-x-0'
							}`}
						/>
					</button>
					<span className="text-[10px] text-muted-foreground">Unlimited</span>
				</label>
			</div>
			<input
				id={inputId}
				type="number"
				value={value}
				onChange={(e) => onChange(Number.parseInt(e.target.value, 10) || 0)}
				disabled={unlimited}
				className={`w-full h-8 px-2 rounded-md border bg-input text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed ${compact ? 'mt-1' : ''}`}
			/>
		</div>
	)
}

function HeptaOktaStrategyTab({
	numSimulations,
	setNumSimulations,
}: {
	numSimulations: number
	setNumSimulations: (n: number) => void
}) {
	const { config } = useStore()
	const { runHeptaOktaStrategy, heptaOktaProgress, isHeptaOktaRunning } = useStrategyWorker()

	// Local state for strategy configuration
	const [startLevel, setStartLevel] = useState(0)
	const [startHepta, setStartHepta] = useState(0)
	const [startOkta, setStartOkta] = useState(0)
	const [targetLevel, setTargetLevel] = useState(config.targetLevel)

	const [results, setResults] = useState<
		Array<{
			useHepta: boolean
			useOkta: boolean
			label: string
			p50: { crystals: number; scrolls: number; silver: number; exquisite: number }
			p90: { crystals: number; scrolls: number; silver: number; exquisite: number }
			worst: { crystals: number; scrolls: number; silver: number; exquisite: number }
			distribution: DistributionData
			failedDistribution?: DistributionData
		}>
	>([])

	const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

	const toggleRowExpansion = (label: string) => {
		setExpandedRows((prev) => {
			const next = new Set(prev)
			if (next.has(label)) {
				next.delete(label)
			} else {
				next.add(label)
			}
			return next
		})
	}

	// Default unlimited resources for hepta/okta analysis
	const defaultResources: ResourceLimits = {
		crystals: 0,
		crystalsUnlimited: true,
		scrolls: 0,
		scrollsUnlimited: true,
		valks10: 0,
		valks10Unlimited: true,
		valks50: 0,
		valks50Unlimited: true,
		valks100: 0,
		valks100Unlimited: true,
	}

	const runAnalysis = async () => {
		try {
			const strategyConfig = {
				...DEFAULT_CONFIG,
				startLevel,
				startHepta: startLevel === 7 ? startHepta : 0,
				startOkta: startLevel === 8 ? startOkta : 0,
				targetLevel,
				prices: DEFAULT_PRICES,
			}

			const rawResults = await runHeptaOktaStrategy(
				strategyConfig,
				DEFAULT_PRICES,
				numSimulations,
				defaultResources,
			)
			setResults([...rawResults].sort((a, b) => a.p50.silver - b.p50.silver))
		} catch (error) {
			console.error('Strategy analysis failed:', error)
		}
	}

	// Ensure startLevel < targetLevel when target changes
	useEffect(() => {
		if (startLevel >= targetLevel) {
			setStartLevel(Math.max(0, targetLevel - 1))
		}
		// Only react to targetLevel changes - startLevel adjustment is a side effect
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [targetLevel])

	return (
		<div className="space-y-4">
			{/* Configuration */}
			<Card>
				<CardHeader className="py-3">
					<CardTitle className="text-sm">Strategy Configuration</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					{/* Target & Start Level */}
					<div className="grid grid-cols-2 gap-3">
						<div>
							<label className="text-xs text-muted-foreground">Start Level</label>
							<Select value={String(startLevel)} onValueChange={(v) => setStartLevel(Number(v))}>
								<SelectTrigger className="mt-1">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => (
										<SelectItem key={level} value={String(level)} disabled={level >= targetLevel}>
											+{ROMAN_NUMERALS[level]} ({level})
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div>
							<label className="text-xs text-muted-foreground">Target Level</label>
							<Select value={String(targetLevel)} onValueChange={(v) => setTargetLevel(Number(v))}>
								<SelectTrigger className="mt-1">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
										<SelectItem key={level} value={String(level)}>
											+{ROMAN_NUMERALS[level]} ({level})
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>

					{/* Hepta Progress (when starting at +VII) */}
					{startLevel === 7 && (
						<div>
							<label className="text-xs text-muted-foreground">Start Hepta Progress</label>
							<Select value={String(startHepta)} onValueChange={(v) => setStartHepta(Number(v))}>
								<SelectTrigger className="mt-1">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{[0, 1, 2, 3, 4].map((p) => (
										<SelectItem key={p} value={String(p)}>
											{p}/{HEPTA_SUB_ENHANCEMENTS}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					)}

					{/* Okta Progress (when starting at +VIII) */}
					{startLevel === 8 && (
						<div>
							<label className="text-xs text-muted-foreground">Start Okta Progress</label>
							<Select value={String(startOkta)} onValueChange={(v) => setStartOkta(Number(v))}>
								<SelectTrigger className="mt-1">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((p) => (
										<SelectItem key={p} value={String(p)}>
											{p}/{OKTA_SUB_ENHANCEMENTS}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					)}

					{/* Simulations */}
					<div>
						<label className="text-xs text-muted-foreground">Simulations per strategy</label>
						<input
							type="number"
							value={numSimulations}
							onChange={(e) => setNumSimulations(Number.parseInt(e.target.value, 10) || 1000)}
							className="w-full mt-1 h-9 px-3 rounded-md border bg-input text-sm focus:outline-none focus:ring-1 focus:ring-ring"
						/>
					</div>
				</CardContent>
			</Card>

			{/* Run Button */}
			<Button onClick={runAnalysis} disabled={isHeptaOktaRunning} className="w-full">
				{isHeptaOktaRunning ? (
					<>
						<Loader2 className="w-4 h-4 mr-2 animate-spin" />
						Running... {heptaOktaProgress.toFixed(0)}%
					</>
				) : (
					<>
						<Play className="w-4 h-4 mr-2" />
						Run Analysis
					</>
				)}
			</Button>

			{/* Progress */}
			{isHeptaOktaRunning && (
				<div className="h-2 bg-muted rounded-full overflow-hidden">
					<div
						className="h-full bg-primary transition-all duration-300"
						style={{ width: `${heptaOktaProgress}%` }}
					/>
				</div>
			)}

			{/* Results */}
			{results.length > 0 && (
				<Card>
					<CardHeader className="py-3">
						<CardTitle className="text-sm">Strategy Comparison</CardTitle>
						<p className="text-xs text-muted-foreground">
							+{ROMAN_NUMERALS[startLevel]} → +{ROMAN_NUMERALS[targetLevel]} | Sorted by median
							(P50) silver cost | Restoration fixed at +VI
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
										<th colSpan={4} className="px-3 py-1 text-center font-medium border-l">
											P50
										</th>
										<th
											colSpan={4}
											className="px-3 py-1 text-center font-medium border-l text-muted-foreground"
										>
											P90
										</th>
										<th
											colSpan={4}
											className="px-3 py-1 text-center font-medium border-l text-muted-foreground"
										>
											Worst
										</th>
									</tr>
									<tr className="border-b bg-muted/50">
										<th className="px-3 py-1 text-right font-normal border-l">Silver</th>
										<th className="px-3 py-1 text-right font-normal">Crystals</th>
										<th className="px-3 py-1 text-right font-normal">Rest. Scrolls</th>
										<th className="px-3 py-1 text-right font-normal">Exquisite</th>
										<th className="px-3 py-1 text-right font-normal border-l text-muted-foreground">
											Silver
										</th>
										<th className="px-3 py-1 text-right font-normal text-muted-foreground">
											Crystals
										</th>
										<th className="px-3 py-1 text-right font-normal text-muted-foreground">
											Rest. Scrolls
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
											Rest. Scrolls
										</th>
										<th className="px-3 py-1 text-right font-normal text-muted-foreground">
											Exquisite
										</th>
									</tr>
								</thead>
								<tbody>
									{results.map((result, idx) => {
										const isExpanded = expandedRows.has(result.label)
										return (
											<Fragment key={result.label}>
												<tr
													onClick={() => toggleRowExpansion(result.label)}
													className={`border-b cursor-pointer hover:bg-muted/30 transition-colors ${idx === 0 ? 'bg-success/10' : ''}`}
												>
													<td className="px-3 py-2 font-medium">
														<div className="flex items-center gap-2">
															{isExpanded ? (
																<ChevronDown className="w-3 h-3 text-muted-foreground" />
															) : (
																<ChevronRight className="w-3 h-3 text-muted-foreground" />
															)}
															{result.label}
															{idx === 0 && <span className="text-success text-[10px]">BEST</span>}
														</div>
													</td>
													<td className="px-3 py-2 text-right border-l">
														{formatSilver(result.p50.silver)}
													</td>
													<td className="px-3 py-2 text-right">
														{formatNumber(result.p50.crystals)}
													</td>
													<td className="px-3 py-2 text-right">
														{formatNumber(result.p50.scrolls)}
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
														{formatNumber(result.p90.scrolls)}
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
														{formatNumber(result.worst.scrolls)}
													</td>
													<td className="px-3 py-2 text-right text-muted-foreground">
														{formatNumber(result.worst.exquisite)}
													</td>
												</tr>
												{isExpanded && (
													<tr className="border-b bg-muted/20">
														<td colSpan={13} className="px-4 py-3">
															<DistributionHistogram
																distribution={result.distribution}
																failedDistribution={result.failedDistribution}
															/>
														</td>
													</tr>
												)}
											</Fragment>
										)
									})}
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
						using Exquisite Black Crystals to guarantee level up.
					</p>
					<p>
						<strong>Okta</strong> (VIII→IX): Complete {OKTA_SUB_ENHANCEMENTS} sub-enhancements using
						Exquisite Black Crystals to guarantee level up.
					</p>
					<p>
						<strong>Exquisite Black Crystal</strong>: Crafted from 1,050 Restoration Scrolls + 30
						Pristine Black Crystals + 2 Valks +100%.
					</p>
				</CardContent>
			</Card>
		</div>
	)
}
