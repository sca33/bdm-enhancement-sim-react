import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui'
import { formatSilver } from '@/lib/utils'
import type { SurvivalCurvePoint } from '@/workers/strategy.worker'

type SurvivalCurveProps = {
	data: SurvivalCurvePoint[]
	height?: number
	currentSuccessRate: number
}

export function SurvivalCurve({ data, height = 120, currentSuccessRate }: SurvivalCurveProps) {
	if (!data || data.length === 0) {
		return <div className="text-sm text-muted-foreground">No survival data available</div>
	}

	return (
		<div className="space-y-3">
			<TooltipProvider delayDuration={0}>
				<div className="space-y-1">
					<div className="text-xs text-muted-foreground">
						Success probability at budget levels (max: {currentSuccessRate.toFixed(0)}%)
					</div>
					<SurvivalGraph data={data} height={height} maxSuccess={currentSuccessRate} />
				</div>
			</TooltipProvider>

			{/* Key budget points */}
			<div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
				{data.length > 0 && (
					<>
						<span>
							At {formatSilver(data[0].silver)}: {data[0].successProbability.toFixed(0)}%
						</span>
						<span>
							At {formatSilver(data[Math.floor(data.length / 2)].silver)}:{' '}
							{data[Math.floor(data.length / 2)].successProbability.toFixed(0)}%
						</span>
						<span>
							At {formatSilver(data[data.length - 1].silver)}:{' '}
							{data[data.length - 1].successProbability.toFixed(0)}%
						</span>
					</>
				)}
			</div>
		</div>
	)
}

type SurvivalGraphProps = {
	data: SurvivalCurvePoint[]
	height: number
	maxSuccess: number
}

function SurvivalGraph({ data, height, maxSuccess }: SurvivalGraphProps) {
	// Normalize to 0-100 on both axes
	const minSilver = data[0].silver
	const maxSilver = data[data.length - 1].silver
	const silverRange = maxSilver - minSilver || 1

	// Create path for the survival curve
	const pathPoints = data.map((point, i) => {
		const x = ((point.silver - minSilver) / silverRange) * 100
		// Y is inverted in SVG (0 is top), and we scale to maxSuccess
		const y = height - (point.successProbability / Math.max(maxSuccess, 1)) * (height - 10) - 5
		return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
	})

	const pathD = pathPoints.join(' ')

	// Create filled area path
	const areaPath = `${pathD} L 100 ${height - 5} L 0 ${height - 5} Z`

	// Find the 50% success point (if it exists in the data)
	const fiftyPercentPoint = data.find((p) => p.successProbability >= 50)

	return (
		<div className="relative rounded bg-muted/30 p-2">
			<svg
				viewBox={`0 0 100 ${height}`}
				preserveAspectRatio="none"
				className="w-full"
				style={{ height }}
				role="img"
				aria-label="Survival curve showing success probability at different budget levels"
			>
				{/* Grid lines */}
				{[25, 50, 75].map((pct) => {
					const y = height - (pct / Math.max(maxSuccess, 1)) * (height - 10) - 5
					if (y < 0 || y > height) return null
					return (
						<line
							key={pct}
							x1="0"
							y1={y}
							x2="100"
							y2={y}
							stroke="var(--color-border)"
							strokeWidth="0.5"
							strokeDasharray="2,2"
							opacity="0.3"
						/>
					)
				})}

				{/* Filled area under curve */}
				<path d={areaPath} fill="var(--color-primary)" opacity="0.15" />

				{/* Main curve line */}
				<path d={pathD} fill="none" stroke="var(--color-primary)" strokeWidth="2" opacity="0.8" />

				{/* Interactive hover points */}
				<TooltipProvider delayDuration={0}>
					{data.map((point, i) => {
						const x = ((point.silver - minSilver) / silverRange) * 100
						const y =
							height - (point.successProbability / Math.max(maxSuccess, 1)) * (height - 10) - 5

						return (
							<Tooltip key={i}>
								<TooltipTrigger asChild>
									<circle
										cx={x}
										cy={y}
										r={4}
										fill="var(--color-primary)"
										className="cursor-pointer opacity-0 hover:opacity-100"
									/>
								</TooltipTrigger>
								<TooltipContent side="top" className="text-xs">
									<div className="space-y-1">
										<div className="font-medium">Budget: {formatSilver(point.silver)}</div>
										<div>Success: {point.successProbability.toFixed(1)}%</div>
									</div>
								</TooltipContent>
							</Tooltip>
						)
					})}
				</TooltipProvider>

				{/* 50% success marker (if achievable) */}
				{fiftyPercentPoint && (
					<>
						<line
							x1={((fiftyPercentPoint.silver - minSilver) / silverRange) * 100}
							y1="0"
							x2={((fiftyPercentPoint.silver - minSilver) / silverRange) * 100}
							y2={height}
							stroke="var(--color-success)"
							strokeWidth="1.5"
							strokeDasharray="4,2"
							opacity="0.6"
						/>
					</>
				)}
			</svg>

			{/* Y-axis labels */}
			<div className="absolute left-3 top-2 text-[10px] text-muted-foreground">
				{maxSuccess.toFixed(0)}%
			</div>
			<div className="absolute left-3 bottom-2 text-[10px] text-muted-foreground">0%</div>
		</div>
	)
}
