import {
	ANVIL_THRESHOLDS,
	ENHANCEMENT_RATES,
	HEPTA_SUB_ENHANCEMENTS,
	OKTA_SUB_ENHANCEMENTS,
	ROMAN_NUMERALS,
} from '@bdm-sim/simulator'
import { ArrowLeft, ChevronDown, ChevronUp, Play, Search } from 'lucide-react'
import { useState } from 'react'

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

export function AwakeningConfigPage() {
	const { config, setConfig, setPage, speed, setSpeed, numSimulations, setNumSimulations } =
		useStore()
	const [showRates, setShowRates] = useState(false)

	return (
		<div className="space-y-4">
			{/* Header */}
			<div className="flex items-center gap-4">
				<Button variant="ghost" size="icon" onClick={() => setPage('home')}>
					<ArrowLeft className="w-4 h-4" />
				</Button>
				<h2 className="text-xl font-semibold">Awakening Enhancement</h2>
			</div>

			{/* Rates Table (Collapsible) */}
			<Card>
				<CardHeader
					className="py-3 cursor-pointer flex flex-row items-center justify-between"
					onClick={() => setShowRates(!showRates)}
				>
					<CardTitle className="text-sm">Enhancement Rates & Anvil Pity</CardTitle>
					{showRates ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
				</CardHeader>
				{showRates && (
					<CardContent className="pt-0">
						<div className="text-xs font-mono overflow-x-auto">
							<div className="grid grid-cols-3 gap-2 font-semibold border-b pb-1 mb-1">
								<span>Level</span>
								<span>Rate</span>
								<span>Anvil</span>
							</div>
							{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
								<div key={level} className="grid grid-cols-3 gap-2">
									<span>{ROMAN_NUMERALS[level]}</span>
									<span>{((ENHANCEMENT_RATES[level] ?? 0) * 100).toFixed(1)}%</span>
									<span>{ANVIL_THRESHOLDS[level] || '-'}</span>
								</div>
							))}
						</div>
					</CardContent>
				)}
			</Card>

			{/* Target & Start */}
			<Card>
				<CardHeader className="py-3">
					<CardTitle className="text-sm">Target & Starting Settings</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					<div className="grid grid-cols-2 gap-3">
						<div>
							<label className="text-xs text-muted-foreground">Target Level</label>
							<Select
								value={String(config.targetLevel)}
								onValueChange={(v) => setConfig({ targetLevel: Number(v) })}
							>
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
						<div>
							<label className="text-xs text-muted-foreground">Start Level</label>
							<Select
								value={String(config.startLevel)}
								onValueChange={(v) => setConfig({ startLevel: Number(v) })}
							>
								<SelectTrigger className="mt-1">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => (
										<SelectItem key={level} value={String(level)}>
											+{ROMAN_NUMERALS[level]} ({level})
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>

					{config.startLevel === 7 && (
						<div>
							<label className="text-xs text-muted-foreground">Start Hepta Progress</label>
							<Select
								value={String(config.startHepta)}
								onValueChange={(v) => setConfig({ startHepta: Number(v) })}
							>
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

					{config.startLevel === 8 && (
						<div>
							<label className="text-xs text-muted-foreground">Start Okta Progress</label>
							<Select
								value={String(config.startOkta)}
								onValueChange={(v) => setConfig({ startOkta: Number(v) })}
							>
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
				</CardContent>
			</Card>

			{/* Hepta/Okta */}
			<Card>
				<CardHeader className="py-3">
					<CardTitle className="text-sm">Hepta/Okta Failsafe Enhancement</CardTitle>
					<p className="text-xs text-muted-foreground">
						Alternative paths using Exquisite Black Crystals
					</p>
				</CardHeader>
				<CardContent className="space-y-2">
					<label className="flex items-center gap-2 cursor-pointer">
						<input
							type="checkbox"
							checked={config.useHepta}
							onChange={(e) => setConfig({ useHepta: e.target.checked })}
							className="w-4 h-4 rounded border-input"
						/>
						<span className="text-sm">Use Hepta for VII→VIII (5 sub-enhancements)</span>
					</label>
					<label className="flex items-center gap-2 cursor-pointer">
						<input
							type="checkbox"
							checked={config.useOkta}
							onChange={(e) => setConfig({ useOkta: e.target.checked })}
							className="w-4 h-4 rounded border-input"
						/>
						<span className="text-sm">Use Okta for VIII→IX (10 sub-enhancements)</span>
					</label>
				</CardContent>
			</Card>

			{/* Valks */}
			<Card>
				<CardHeader className="py-3">
					<CardTitle className="text-sm">Advice of Valks Settings</CardTitle>
					<p className="text-xs text-muted-foreground">
						0 = Never use, I-X = Use starting from that level
					</p>
				</CardHeader>
				<CardContent className="space-y-3">
					<div className="grid grid-cols-3 gap-2">
						<div>
							<label className="text-xs text-muted-foreground">+10% from</label>
							<Select
								value={String(config.valks10From)}
								onValueChange={(v) => setConfig({ valks10From: Number(v) })}
							>
								<SelectTrigger className="mt-1">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="0">Never</SelectItem>
									{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
										<SelectItem key={level} value={String(level)}>
											+{ROMAN_NUMERALS[level]}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div>
							<label className="text-xs text-muted-foreground">+50% from</label>
							<Select
								value={String(config.valks50From)}
								onValueChange={(v) => setConfig({ valks50From: Number(v) })}
							>
								<SelectTrigger className="mt-1">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="0">Never</SelectItem>
									{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
										<SelectItem key={level} value={String(level)}>
											+{ROMAN_NUMERALS[level]}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div>
							<label className="text-xs text-muted-foreground">+100% from</label>
							<Select
								value={String(config.valks100From)}
								onValueChange={(v) => setConfig({ valks100From: Number(v) })}
							>
								<SelectTrigger className="mt-1">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="0">Never</SelectItem>
									{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
										<SelectItem key={level} value={String(level)}>
											+{ROMAN_NUMERALS[level]}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Restoration */}
			<Card>
				<CardHeader className="py-3">
					<CardTitle className="text-sm">Restoration Scroll Settings</CardTitle>
				</CardHeader>
				<CardContent>
					<div>
						<label className="text-xs text-muted-foreground">Use restoration from level</label>
						<Select
							value={String(config.restorationFrom)}
							onValueChange={(v) => setConfig({ restorationFrom: Number(v) })}
						>
							<SelectTrigger className="mt-1">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="0">Never</SelectItem>
								{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
									<SelectItem key={level} value={String(level)}>
										+{ROMAN_NUMERALS[level]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</CardContent>
			</Card>

			{/* Speed */}
			<Card>
				<CardHeader className="py-3">
					<CardTitle className="text-sm">Simulation Speed</CardTitle>
				</CardHeader>
				<CardContent>
					<Select value={speed} onValueChange={(v) => setSpeed(v as typeof speed)}>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="instant">Instant</SelectItem>
							<SelectItem value="fast">Fast</SelectItem>
							<SelectItem value="regular">In-game</SelectItem>
						</SelectContent>
					</Select>
				</CardContent>
			</Card>

			{/* Start Button */}
			<Button className="w-full" size="lg" onClick={() => setPage('simulation')}>
				<Play className="w-4 h-4 mr-2" />
				Start Simulation
			</Button>

			{/* Strategy Analysis */}
			<Card>
				<CardHeader className="py-3">
					<CardTitle className="text-sm">Strategy Analysis</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					<div>
						<label className="text-xs text-muted-foreground">Simulations per strategy</label>
						<input
							type="number"
							value={numSimulations}
							onChange={(e) => setNumSimulations(Number.parseInt(e.target.value, 10) || 1000)}
							className="w-full mt-1 h-9 px-3 rounded-md border bg-input text-sm focus:outline-none focus:ring-1 focus:ring-ring"
						/>
					</div>
					<div className="grid grid-cols-2 gap-2">
						<Button variant="secondary" onClick={() => setPage('restoration-strategy')}>
							<Search className="w-4 h-4 mr-1" />
							Restoration
						</Button>
						<Button variant="secondary" onClick={() => setPage('hepta-okta-strategy')}>
							<Search className="w-4 h-4 mr-1" />
							Hepta/Okta
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
