import { MODULES } from '@bdm-sim/simulator'

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui'
import { useStore } from '@/hooks/use-store'

export function HomePage() {
	const setPage = useStore((s) => s.setPage)

	return (
		<div className="space-y-6">
			<div className="text-center">
				<h2 className="text-xl font-semibold mb-2">Select Enhancement Type</h2>
				<p className="text-muted-foreground text-sm">Choose an item type to simulate enhancement</p>
			</div>

			<div className="space-y-3">
				{MODULES.map((module, idx) => (
					<Card
						key={module.id}
						className={
							module.implemented
								? 'cursor-pointer hover:bg-card/80 transition-colors'
								: 'opacity-60'
						}
						onClick={() => module.implemented && setPage('awakening-config')}
					>
						<CardHeader className="py-4">
							<div className="flex items-center justify-between">
								<CardTitle className="text-base">
									<span className="text-muted-foreground mr-2">[{idx + 1}]</span>
									{module.name}
								</CardTitle>
								<span
									className={`text-xs px-2 py-1 rounded ${module.implemented ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'}`}
								>
									{module.implemented ? 'Ready' : 'Coming Soon'}
								</span>
							</div>
							<CardDescription>{module.description}</CardDescription>
						</CardHeader>
					</Card>
				))}
			</div>
		</div>
	)
}
