import { SimulatorConfig } from './components/simulator-config'
import { SimulatorResults } from './components/simulator-results'

export default function App() {
	return (
		<div className="min-h-screen bg-background">
			{/* Header */}
			<header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
				<div className="container mx-auto px-4 py-4">
					<h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
						BDM Enhancement Simulator
					</h1>
					<p className="text-sm text-muted-foreground">
						Monte Carlo simulation for Black Desert Mobile awakening enhancement
					</p>
				</div>
			</header>

			{/* Main Content */}
			<main className="container mx-auto px-4 py-8">
				<div className="grid gap-8 lg:grid-cols-[350px_1fr]">
					{/* Sidebar - Configuration */}
					<aside>
						<SimulatorConfig />
					</aside>

					{/* Main - Results */}
					<section>
						<SimulatorResults />
					</section>
				</div>
			</main>

			{/* Footer */}
			<footer className="border-t mt-auto">
				<div className="container mx-auto px-4 py-4 text-center text-sm text-muted-foreground">
					<p>
						Data sourced from official BDM Korea patch notes and community research.
						<br />
						All simulations run client-side in your browser.
					</p>
				</div>
			</footer>
		</div>
	)
}
