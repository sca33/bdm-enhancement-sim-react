import { MODULES } from '@bdm-sim/simulator'
import { Play, Search } from 'lucide-react'

import { Button, Card, CardDescription, CardHeader, CardTitle } from '@/components/ui'
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
					<Card key={module.id} className={module.implemented ? '' : 'opacity-60'}>
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

							{/* Action buttons - only show for implemented modules */}
							{module.implemented && (
								<div className="flex gap-2 pt-3">
									<Button className="flex-1" onClick={() => setPage('awakening-config')}>
										<Play className="w-4 h-4 mr-2" />
										Simulator
									</Button>
									<Button
										variant="secondary"
										size="default"
										onClick={() => setPage('strategy-finder')}
									>
										<Search className="w-4 h-4 mr-1" />
										Strategy
									</Button>
								</div>
							)}
						</CardHeader>
					</Card>
				))}
			</div>

			{/* Version info */}
			<div className="text-center text-xs text-muted-foreground pt-4 border-t border-border">
				<p>
					Build: <code className="bg-muted px-1 rounded">{__BUILD_VERSION__}</code>
					<span className="mx-2">|</span>
					{new Date(__BUILD_TIME__).toLocaleString()}
				</p>
			</div>
		</div>
	)
}
