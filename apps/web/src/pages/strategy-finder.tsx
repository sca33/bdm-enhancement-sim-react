import {
	DEFAULT_CONFIG,
	DEFAULT_PRICES,
	HEPTA_SUB_ENHANCEMENTS,
	OKTA_SUB_ENHANCEMENTS,
	ROMAN_NUMERALS,
} from '@bdm-sim/simulator'
import { ArrowLeft, Loader2, Play } from 'lucide-react'
import { useEffect, useState } from 'react'

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

type Tab = 'restoration' | 'hepta-okta'

interface ResourceLimits {
	crystals: number
	crystalsUnlimited: boolean
	scrolls: number
	scrollsUnlimited: boolean
	valks10: number
	valks10Unlimited: boolean
	valks50: number
	valks50Unlimited: boolean
	valks100: number
	valks100Unlimited: boolean
}

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
					Hepta/Okta (Legacy)
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
	const [targetLevel, setTargetLevel] = useState(config.targetLevel)
	const [resources, setResources] = useState<ResourceLimits>({
		crystals: 1000,
		crystalsUnlimited: true,
		scrolls: 100000,
		scrollsUnlimited: true,
		// Valks are not used in restoration strategy analysis
		// (disabled in worker for accurate cost comparison)
		valks10: 0,
		valks10Unlimited: true,
		valks50: 0,
		valks50Unlimited: true,
		valks100: 0,
		valks100Unlimited: true,
	})

	const [results, setResults] = useState<
		Array<{
			restorationFrom: number
			label: string
			p50: { crystals: number; scrolls: number; silver: number }
			p90: { crystals: number; scrolls: number; silver: number }
			worst: { crystals: number; scrolls: number; silver: number }
			feasible: boolean
			recommendation?: string
		}>
	>([])

	const updateResource = <K extends keyof ResourceLimits>(key: K, value: ResourceLimits[K]) => {
		setResources((prev) => ({ ...prev, [key]: value }))
	}

	const runAnalysis = async () => {
		try {
			const strategyConfig = {
				...DEFAULT_CONFIG,
				startLevel,
				targetLevel,
				prices: DEFAULT_PRICES,
			}

			const rawResults = await runRestorationStrategy(
				strategyConfig,
				DEFAULT_PRICES,
				numSimulations,
			)

			// Process results with resource feasibility check
			const processedResults = rawResults.map((result) => {
				const feasible = checkFeasibility(result.p50)
				return {
					...result,
					feasible,
					recommendation: getFeasibilityMessage(result, feasible),
				}
			})

			// Sort by silver cost, but put feasible strategies first
			processedResults.sort((a, b) => {
				if (a.feasible && !b.feasible) return -1
				if (!a.feasible && b.feasible) return 1
				return a.p50.silver - b.p50.silver
			})

			setResults(processedResults)
		} catch (error) {
			console.error('Strategy analysis failed:', error)
		}
	}

	const checkFeasibility = (stats: { crystals: number; scrolls: number }) => {
		if (!resources.crystalsUnlimited && stats.crystals > resources.crystals) return false
		if (!resources.scrollsUnlimited && stats.scrolls > resources.scrolls) return false
		return true
	}

	const getFeasibilityMessage = (
		result: { p50: { crystals: number; scrolls: number } },
		feasible: boolean,
	): string | undefined => {
		if (feasible) return undefined

		const issues: string[] = []
		if (!resources.crystalsUnlimited && result.p50.crystals > resources.crystals) {
			issues.push(`Need ${formatNumber(result.p50.crystals - resources.crystals)} more crystals`)
		}
		if (!resources.scrollsUnlimited && result.p50.scrolls > resources.scrolls) {
			issues.push(`Need ${formatNumber(result.p50.scrolls - resources.scrolls)} more scrolls`)
		}
		return issues.join(', ')
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
						Set your available resources to filter feasible strategies
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

					{/* Note about Valks */}
					<p className="text-[10px] text-muted-foreground italic">
						Note: Valks bonuses are excluded from strategy analysis for accurate cost comparison.
					</p>
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
							+{ROMAN_NUMERALS[startLevel]} → +{ROMAN_NUMERALS[targetLevel]} | Sorted by median cost
						</p>
					</CardHeader>
					<CardContent className="p-0">
						<div className="overflow-x-auto">
							<table className="w-full text-xs">
								<thead>
									<tr className="border-b bg-muted/50">
										<th rowSpan={2} className="px-3 py-2 text-left font-medium">
											Restoration From
										</th>
										<th colSpan={3} className="px-3 py-1 text-center font-medium border-l">
											P50 (Median)
										</th>
										<th
											colSpan={3}
											className="px-3 py-1 text-center font-medium border-l text-muted-foreground"
										>
											P90 (Unlucky)
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
									</tr>
								</thead>
								<tbody>
									{results.map((result, idx) => (
										<tr
											key={result.restorationFrom}
											className={`border-b ${
												idx === 0 && result.feasible
													? 'bg-success/10'
													: !result.feasible
														? 'opacity-50'
														: ''
											}`}
										>
											<td className="px-3 py-2 font-medium">
												<div className="flex items-center gap-2">
													{result.label}
													{idx === 0 && result.feasible && (
														<span className="text-success text-[10px] font-semibold">BEST</span>
													)}
													{!result.feasible && (
														<span className="text-destructive text-[10px]">Insufficient</span>
													)}
												</div>
												{result.recommendation && (
													<div className="text-[10px] text-muted-foreground mt-0.5">
														{result.recommendation}
													</div>
												)}
											</td>
											<td className="px-3 py-2 text-right border-l">
												{formatSilver(result.p50.silver)}
											</td>
											<td className="px-3 py-2 text-right">{formatNumber(result.p50.crystals)}</td>
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
						The strategy finder runs Monte Carlo simulations to compare different restoration
						starting levels and finds the most cost-effective approach.
					</p>
					<p>
						<strong>P50 (Median):</strong> 50% of simulations cost less than this - your expected
						cost.
					</p>
					<p>
						<strong>P90:</strong> 90% of simulations cost less than this - prepare for bad luck.
					</p>
					<p>
						Strategies that exceed your available resources are marked as "Insufficient" and shown
						at the bottom.
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

	const [results, setResults] = useState<
		Array<{
			useHepta: boolean
			useOkta: boolean
			label: string
			p50: { crystals: number; scrolls: number; silver: number; exquisite: number }
			p90: { crystals: number; scrolls: number; silver: number; exquisite: number }
			worst: { crystals: number; scrolls: number; silver: number; exquisite: number }
		}>
	>([])

	const runAnalysis = async () => {
		try {
			const strategyConfig = {
				...DEFAULT_CONFIG,
				targetLevel: config.targetLevel,
				prices: DEFAULT_PRICES,
			}

			const rawResults = await runHeptaOktaStrategy(strategyConfig, DEFAULT_PRICES, numSimulations)
			setResults([...rawResults].sort((a, b) => a.p50.silver - b.p50.silver))
		} catch (error) {
			console.error('Strategy analysis failed:', error)
		}
	}

	return (
		<div className="space-y-4">
			{/* Legacy Notice */}
			<Card className="border-warning/50 bg-warning/5">
				<CardContent className="py-3 text-xs text-warning">
					This strategy finder is a legacy tool. For most use cases, the Restoration Strategy finder
					above is recommended.
				</CardContent>
			</Card>

			{/* Configuration */}
			<Card>
				<CardHeader className="py-3">
					<CardTitle className="text-sm">Configuration</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					<div>
						<label className="text-xs text-muted-foreground">Target Level</label>
						<div className="mt-1 h-9 px-3 rounded-md border bg-muted/50 flex items-center text-sm">
							+{ROMAN_NUMERALS[config.targetLevel]} (uses simulator config)
						</div>
					</div>
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
										<th colSpan={4} className="px-3 py-1 text-center font-medium border-l">
											P50
										</th>
										<th
											colSpan={4}
											className="px-3 py-1 text-center font-medium border-l text-muted-foreground"
										>
											P90
										</th>
									</tr>
									<tr className="border-b bg-muted/50">
										<th className="px-3 py-1 text-right font-normal border-l">Silver</th>
										<th className="px-3 py-1 text-right font-normal">Crystals</th>
										<th className="px-3 py-1 text-right font-normal">Scrolls</th>
										<th className="px-3 py-1 text-right font-normal">Exquisite</th>
										<th className="px-3 py-1 text-right font-normal border-l text-muted-foreground">
											Silver
										</th>
										<th className="px-3 py-1 text-right font-normal text-muted-foreground">
											Crystals
										</th>
										<th className="px-3 py-1 text-right font-normal text-muted-foreground">
											Scrolls
										</th>
										<th className="px-3 py-1 text-right font-normal text-muted-foreground">
											Exquisite
										</th>
									</tr>
								</thead>
								<tbody>
									{results.map((result, idx) => (
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
											<td className="px-3 py-2 text-right">{formatNumber(result.p50.crystals)}</td>
											<td className="px-3 py-2 text-right">{formatNumber(result.p50.scrolls)}</td>
											<td className="px-3 py-2 text-right">{formatNumber(result.p50.exquisite)}</td>
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
