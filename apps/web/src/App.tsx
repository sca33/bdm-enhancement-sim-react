import { useStore } from '@/hooks/use-store'
import {
	AwakeningConfigPage,
	HeptaOktaStrategyPage,
	HomePage,
	MarketPricesPage,
	RestorationStrategyPage,
	SimulationPage,
} from '@/pages'

export default function App() {
	const currentPage = useStore((s) => s.currentPage)

	const renderPage = () => {
		switch (currentPage) {
			case 'home':
				return <HomePage />
			case 'market-prices':
				return <MarketPricesPage />
			case 'awakening-config':
				return <AwakeningConfigPage />
			case 'simulation':
				return <SimulationPage />
			case 'restoration-strategy':
				return <RestorationStrategyPage />
			case 'hepta-okta-strategy':
				return <HeptaOktaStrategyPage />
			default:
				return <HomePage />
		}
	}

	// Simulation page needs full height
	const isSimulation = currentPage === 'simulation'

	return (
		<div className={`min-h-screen bg-background flex flex-col ${isSimulation ? 'h-screen' : ''}`}>
			{/* Header */}
			<header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50 shrink-0">
				<div className="container mx-auto px-4 py-3">
					<h1 className="text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
						BDM Enhancement Simulator
					</h1>
				</div>
			</header>

			{/* Main Content */}
			<main className={`container mx-auto px-4 py-4 ${isSimulation ? 'flex-1 overflow-hidden' : ''}`}>
				{renderPage()}
			</main>

			{/* Footer - hide on simulation page */}
			{!isSimulation && (
				<footer className="border-t mt-auto shrink-0">
					<div className="container mx-auto px-4 py-3 text-center text-xs text-muted-foreground">
						<p>
							Data sourced from official BDM Korea patch notes.
							<br />
							All simulations run client-side in your browser.
						</p>
					</div>
				</footer>
			)}
		</div>
	)
}
