import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui'
import { formatNumber } from '@/lib/utils'
import type { DistributionData } from '@/workers/strategy.worker'

type DistributionHistogramProps = {
	distribution: DistributionData
	failedDistribution?: DistributionData
	height?: number
}

export function DistributionHistogram({
	distribution,
	failedDistribution,
	height = 120,
}: DistributionHistogramProps) {
	if (distribution.buckets.length === 0) {
		return <div className="text-sm text-muted-foreground">No data available</div>
	}

	return (
		<div className="space-y-3">
			{/* Main distribution graph */}
			<TooltipProvider delayDuration={0}>
				<div className="space-y-1">
					<div className="text-xs text-muted-foreground">
						Successful runs ({distribution.totalCount})
					</div>
					<DistributionGraph distribution={distribution} height={height} />
				</div>
			</TooltipProvider>

			{/* Failed distribution (if present) */}
			{failedDistribution && failedDistribution.buckets.length > 0 && (
				<TooltipProvider delayDuration={0}>
					<div className="space-y-1">
						<div className="text-xs text-destructive">
							Failed runs ({failedDistribution.totalCount})
						</div>
						<DistributionGraph distribution={failedDistribution} height={height} variant="failed" />
					</div>
				</TooltipProvider>
			)}

			{/* Stats summary */}
			<div className="flex gap-4 text-xs text-muted-foreground">
				<span>Min: {formatNumber(distribution.stats.min)}</span>
				<span>Mean: {formatNumber(distribution.stats.mean)}</span>
				<span>Max: {formatNumber(distribution.stats.max)}</span>
			</div>
		</div>
	)
}

type DistributionGraphProps = {
	distribution: DistributionData
	height: number
	variant?: 'success' | 'failed'
}

function DistributionGraph({ distribution, height, variant = 'success' }: DistributionGraphProps) {
	const { buckets, percentiles, stats } = distribution

	// Calculate max for normalization
	const maxPercentage = Math.max(...buckets.map((b) => b.percentage))

	// X scale: value to percentage position
	const range = stats.max - stats.min
	const valueToX = (value: number) => (range > 0 ? ((value - stats.min) / range) * 100 : 50)

	// X scale: bucket index to percentage
	const xScale = (index: number) => (index / buckets.length) * 100

	const barColor = variant === 'failed' ? 'var(--color-destructive)' : 'var(--color-primary)'

	return (
		<div className="relative rounded bg-muted/30 p-2">
			<svg
				viewBox={`0 0 100 ${height}`}
				preserveAspectRatio="none"
				className="w-full"
				style={{ height }}
				role="img"
				aria-label="Distribution histogram chart"
			>
				{/* Histogram bars */}
				{buckets.map((bucket, i) => {
					const barHeight =
						maxPercentage > 0 ? (bucket.percentage / maxPercentage) * (height - 10) : 0
					const x = xScale(i)
					const barWidth = 100 / buckets.length - 0.5

					return (
						<Tooltip key={bucket.min}>
							<TooltipTrigger asChild>
								<rect
									x={`${x}%`}
									y={height - barHeight - 5}
									width={`${barWidth}%`}
									height={barHeight}
									fill={barColor}
									className="cursor-pointer opacity-80 transition-opacity hover:opacity-100"
								/>
							</TooltipTrigger>
							<TooltipContent side="top" className="text-xs">
								<div className="space-y-1">
									<div className="font-medium">
										{formatNumber(bucket.min)} - {formatNumber(bucket.max)}
									</div>
									<div>Count: {bucket.count}</div>
									<div>Percentage: {bucket.percentage.toFixed(1)}%</div>
								</div>
							</TooltipContent>
						</Tooltip>
					)
				})}

				{/* Percentile markers - simple vertical lines */}
				{variant === 'success' && (
					<>
						{/* P50 marker */}
						<line
							x1={`${valueToX(percentiles.p50)}%`}
							y1="0"
							x2={`${valueToX(percentiles.p50)}%`}
							y2={height}
							stroke="var(--color-accent)"
							strokeWidth="1.5"
							opacity="0.7"
						/>

						{/* P90 marker */}
						<line
							x1={`${valueToX(percentiles.p90)}%`}
							y1="0"
							x2={`${valueToX(percentiles.p90)}%`}
							y2={height}
							stroke="var(--color-warning)"
							strokeWidth="1.5"
							opacity="0.7"
						/>
					</>
				)}
			</svg>
		</div>
	)
}
