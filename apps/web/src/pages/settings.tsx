import {
	DEFAULT_GAME_SETTINGS,
	DEFAULT_PRICES,
	type GameSettings,
	type MarketPrices,
	ROMAN_NUMERALS,
} from '@bdm-sim/simulator'
import { ArrowLeft, RotateCcw } from 'lucide-react'
import { useState } from 'react'

import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { useStore } from '@/hooks/use-store'
import { formatNumber } from '@/lib/utils'

export function SettingsPage() {
	const {
		setPage,
		prices,
		setPrice,
		gameSettings,
		setGameSettings,
		setEnhancementRate,
		setAnvilThreshold,
		resetGameSettings,
	} = useStore()

	const [activeSection, setActiveSection] = useState<'prices' | 'rates' | 'hepta-okta' | 'recipes'>(
		'prices',
	)

	return (
		<div className="space-y-4">
			{/* Header */}
			<div className="flex items-center gap-4">
				<Button variant="ghost" size="icon" onClick={() => setPage('home')}>
					<ArrowLeft className="w-4 h-4" />
				</Button>
				<h2 className="text-xl font-semibold">Settings</h2>
			</div>

			{/* Section Tabs */}
			<div className="flex gap-2 border-b border-border pb-2 overflow-x-auto">
				<Button
					variant={activeSection === 'prices' ? 'default' : 'ghost'}
					size="sm"
					onClick={() => setActiveSection('prices')}
				>
					Prices
				</Button>
				<Button
					variant={activeSection === 'rates' ? 'default' : 'ghost'}
					size="sm"
					onClick={() => setActiveSection('rates')}
					className={activeSection === 'rates' ? '' : 'text-muted-foreground'}
				>
					Rates & Pity
				</Button>
				<Button
					variant={activeSection === 'hepta-okta' ? 'default' : 'ghost'}
					size="sm"
					onClick={() => setActiveSection('hepta-okta')}
					className={activeSection === 'hepta-okta' ? '' : 'text-muted-foreground'}
				>
					Hepta/Okta
				</Button>
				<Button
					variant={activeSection === 'recipes' ? 'default' : 'ghost'}
					size="sm"
					onClick={() => setActiveSection('recipes')}
					className={activeSection === 'recipes' ? '' : 'text-muted-foreground'}
				>
					Recipes
				</Button>
			</div>

			{/* Section Content */}
			{activeSection === 'prices' && (
				<PricesSection
					prices={prices}
					setPrice={setPrice}
					gameSettings={gameSettings}
					setGameSettings={setGameSettings}
				/>
			)}
			{activeSection === 'rates' && (
				<RatesSection
					gameSettings={gameSettings}
					setEnhancementRate={setEnhancementRate}
					setAnvilThreshold={setAnvilThreshold}
				/>
			)}
			{activeSection === 'hepta-okta' && (
				<HeptaOktaSection gameSettings={gameSettings} setGameSettings={setGameSettings} />
			)}
			{activeSection === 'recipes' && (
				<RecipesSection gameSettings={gameSettings} setGameSettings={setGameSettings} />
			)}

			{/* Reset Button */}
			<Card>
				<CardContent className="py-4">
					<Button
						variant="outline"
						onClick={() => {
							resetGameSettings()
							// Also reset prices to defaults
							Object.entries(DEFAULT_PRICES).forEach(([key, value]) => {
								setPrice(key as keyof typeof DEFAULT_PRICES, value)
							})
						}}
						className="w-full"
					>
						<RotateCcw className="w-4 h-4 mr-2" />
						Reset All Settings to Defaults
					</Button>
				</CardContent>
			</Card>
		</div>
	)
}

function PricesSection({
	prices,
	setPrice,
	gameSettings,
	setGameSettings,
}: {
	prices: MarketPrices
	setPrice: <K extends keyof MarketPrices>(key: K, value: number) => void
	gameSettings: GameSettings
	setGameSettings: (partial: Partial<GameSettings>) => void
}) {
	return (
		<Card>
			<CardHeader className="py-3">
				<CardTitle className="text-sm">Market Prices</CardTitle>
				<p className="text-xs text-muted-foreground">Set silver costs for basic items</p>
			</CardHeader>
			<CardContent className="space-y-4">
				<PriceInput
					label="Enhancement Cost (per attempt)"
					value={gameSettings.enhancementCostPerAttempt}
					onChange={(v) => setGameSettings({ enhancementCostPerAttempt: v })}
					defaultValue={DEFAULT_GAME_SETTINGS.enhancementCostPerAttempt}
				/>
				<PriceInput
					label="Pristine Black Crystal"
					value={prices.crystalPrice}
					onChange={(v) => setPrice('crystalPrice', v)}
					defaultValue={DEFAULT_PRICES.crystalPrice}
				/>
				<PriceInput
					label="Restoration Scroll Bundle (200K)"
					value={prices.restorationBundlePrice}
					onChange={(v) => setPrice('restorationBundlePrice', v)}
					defaultValue={DEFAULT_PRICES.restorationBundlePrice}
				/>
				<div className="pt-2 border-t">
					<p className="text-xs font-medium mb-3">Valks Prices (0 = Not on market)</p>
					<div className="space-y-3">
						<PriceInput
							label="Valks +10%"
							value={prices.valks10Price}
							onChange={(v) => setPrice('valks10Price', v)}
							defaultValue={DEFAULT_PRICES.valks10Price}
						/>
						<PriceInput
							label="Valks +50%"
							value={prices.valks50Price}
							onChange={(v) => setPrice('valks50Price', v)}
							defaultValue={DEFAULT_PRICES.valks50Price}
						/>
						<PriceInput
							label="Valks +100%"
							value={prices.valks100Price}
							onChange={(v) => setPrice('valks100Price', v)}
							defaultValue={DEFAULT_PRICES.valks100Price}
						/>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

// Vertical-first ordering for 2-column grid: [1,6], [2,7], [3,8], [4,9], [5,10]
const LEVELS_VERTICAL_ORDER = [1, 6, 2, 7, 3, 8, 4, 9, 5, 10]

function RatesSection({
	gameSettings,
	setEnhancementRate,
	setAnvilThreshold,
}: {
	gameSettings: GameSettings
	setEnhancementRate: (level: number, rate: number) => void
	setAnvilThreshold: (level: number, threshold: number) => void
}) {
	const [gearType, setGearType] = useState<'awakening'>('awakening')

	return (
		<div className="space-y-4">
			{/* Gear Type Sub-tabs */}
			<div className="flex gap-1 bg-muted/50 p-1 rounded-md">
				<button
					type="button"
					onClick={() => setGearType('awakening')}
					className={`flex-1 text-xs py-1.5 px-3 rounded transition-colors ${
						gearType === 'awakening'
							? 'bg-background shadow-sm font-medium'
							: 'text-muted-foreground hover:text-foreground'
					}`}
				>
					Awakening
				</button>
				{/* Future gear types will be added here */}
			</div>

			<Card>
				<CardHeader className="py-3">
					<CardTitle className="text-sm">Enhancement Rates</CardTitle>
					<p className="text-xs text-muted-foreground">Success chance per level (0-100%)</p>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-2 gap-3">
						{LEVELS_VERTICAL_ORDER.map((level) => (
							<div key={level} className="flex items-center gap-2">
								<span className="text-xs text-muted-foreground w-8">+{ROMAN_NUMERALS[level]}</span>
								<input
									type="number"
									step="0.1"
									min="0"
									max="100"
									value={(gameSettings.enhancementRates[level] * 100).toFixed(1)}
									onChange={(e) => {
										const pct = Number.parseFloat(e.target.value) || 0
										setEnhancementRate(level, Math.max(0, Math.min(1, pct / 100)))
									}}
									className="flex-1 h-8 px-2 rounded-md border bg-input text-sm focus:outline-none focus:ring-1 focus:ring-ring"
								/>
								<span className="text-xs text-muted-foreground">%</span>
							</div>
						))}
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="py-3">
					<CardTitle className="text-sm">Anvil Pity Thresholds</CardTitle>
					<p className="text-xs text-muted-foreground">
						Failures needed for guaranteed success (0 = no pity)
					</p>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-2 gap-3">
						{LEVELS_VERTICAL_ORDER.map((level) => (
							<div key={level} className="flex items-center gap-2">
								<span className="text-xs text-muted-foreground w-8">+{ROMAN_NUMERALS[level]}</span>
								<input
									type="number"
									min="0"
									max="1000"
									value={gameSettings.anvilThresholds[level]}
									onChange={(e) => {
										const val = Number.parseInt(e.target.value, 10) || 0
										setAnvilThreshold(level, Math.max(0, val))
									}}
									className="flex-1 h-8 px-2 rounded-md border bg-input text-sm focus:outline-none focus:ring-1 focus:ring-ring"
								/>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	)
}

function HeptaOktaSection({
	gameSettings,
	setGameSettings,
}: {
	gameSettings: GameSettings
	setGameSettings: (partial: Partial<GameSettings>) => void
}) {
	return (
		<Card>
			<CardHeader className="py-3">
				<CardTitle className="text-sm">Hepta/Okta Settings</CardTitle>
				<p className="text-xs text-muted-foreground">Configure failsafe enhancement paths</p>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid grid-cols-2 gap-4">
					<div>
						<label className="text-xs text-muted-foreground">Hepta Sub-enhancements</label>
						<input
							type="number"
							min="1"
							max="100"
							value={gameSettings.heptaSubEnhancements}
							onChange={(e) => {
								const val = Number.parseInt(e.target.value, 10) || 1
								setGameSettings({ heptaSubEnhancements: Math.max(1, val) })
							}}
							className="w-full mt-1 h-9 px-3 rounded-md border bg-input text-sm focus:outline-none focus:ring-1 focus:ring-ring"
						/>
						<p className="text-[10px] text-muted-foreground mt-1">
							For VII→VIII (default: {DEFAULT_GAME_SETTINGS.heptaSubEnhancements})
						</p>
					</div>
					<div>
						<label className="text-xs text-muted-foreground">Okta Sub-enhancements</label>
						<input
							type="number"
							min="1"
							max="100"
							value={gameSettings.oktaSubEnhancements}
							onChange={(e) => {
								const val = Number.parseInt(e.target.value, 10) || 1
								setGameSettings({ oktaSubEnhancements: Math.max(1, val) })
							}}
							className="w-full mt-1 h-9 px-3 rounded-md border bg-input text-sm focus:outline-none focus:ring-1 focus:ring-ring"
						/>
						<p className="text-[10px] text-muted-foreground mt-1">
							For VIII→IX (default: {DEFAULT_GAME_SETTINGS.oktaSubEnhancements})
						</p>
					</div>
				</div>

				<div className="grid grid-cols-2 gap-4 pt-3 border-t">
					<div>
						<label className="text-xs text-muted-foreground">Success Rate</label>
						<div className="flex items-center gap-2 mt-1">
							<input
								type="number"
								step="0.1"
								min="0"
								max="100"
								value={(gameSettings.heptaOktaSuccessRate * 100).toFixed(1)}
								onChange={(e) => {
									const pct = Number.parseFloat(e.target.value) || 0
									setGameSettings({
										heptaOktaSuccessRate: Math.max(0, Math.min(1, pct / 100)),
									})
								}}
								className="flex-1 h-9 px-3 rounded-md border bg-input text-sm focus:outline-none focus:ring-1 focus:ring-ring"
							/>
							<span className="text-sm text-muted-foreground">%</span>
						</div>
						<p className="text-[10px] text-muted-foreground mt-1">
							Default: {(DEFAULT_GAME_SETTINGS.heptaOktaSuccessRate * 100).toFixed(0)}%
						</p>
					</div>
					<div>
						<label className="text-xs text-muted-foreground">Anvil Pity</label>
						<input
							type="number"
							min="0"
							max="1000"
							value={gameSettings.heptaOktaAnvilPity}
							onChange={(e) => {
								const val = Number.parseInt(e.target.value, 10) || 0
								setGameSettings({ heptaOktaAnvilPity: Math.max(0, val) })
							}}
							className="w-full mt-1 h-9 px-3 rounded-md border bg-input text-sm focus:outline-none focus:ring-1 focus:ring-ring"
						/>
						<p className="text-[10px] text-muted-foreground mt-1">
							Default: {DEFAULT_GAME_SETTINGS.heptaOktaAnvilPity}
						</p>
					</div>
				</div>

				<div className="pt-3 border-t">
					<label className="text-xs text-muted-foreground">Exquisite Crystals per Attempt</label>
					<input
						type="number"
						min="1"
						max="100"
						value={gameSettings.heptaOktaCrystalsPerAttempt}
						onChange={(e) => {
							const val = Number.parseInt(e.target.value, 10) || 1
							setGameSettings({ heptaOktaCrystalsPerAttempt: Math.max(1, val) })
						}}
						className="w-full mt-1 h-9 px-3 rounded-md border bg-input text-sm focus:outline-none focus:ring-1 focus:ring-ring"
					/>
					<p className="text-[10px] text-muted-foreground mt-1">
						Cost per sub-enhancement attempt (default:{' '}
						{DEFAULT_GAME_SETTINGS.heptaOktaCrystalsPerAttempt})
					</p>
				</div>
			</CardContent>
		</Card>
	)
}

function RecipesSection({
	gameSettings,
	setGameSettings,
}: {
	gameSettings: GameSettings
	setGameSettings: (partial: Partial<GameSettings>) => void
}) {
	const updateRecipe = (field: keyof typeof gameSettings.exquisiteRecipe, value: number) => {
		setGameSettings({
			exquisiteRecipe: {
				...gameSettings.exquisiteRecipe,
				[field]: value,
			},
		})
	}

	return (
		<Card>
			<CardHeader className="py-3">
				<CardTitle className="text-sm">Exquisite Black Crystal Recipe</CardTitle>
				<p className="text-xs text-muted-foreground">
					Materials needed to craft one Exquisite Black Crystal
				</p>
			</CardHeader>
			<CardContent className="space-y-4">
				<div>
					<label className="text-xs text-muted-foreground">Restoration Scrolls</label>
					<input
						type="number"
						min="0"
						value={gameSettings.exquisiteRecipe.restorationScrolls}
						onChange={(e) => {
							const val = Number.parseInt(e.target.value, 10) || 0
							updateRecipe('restorationScrolls', Math.max(0, val))
						}}
						className="w-full mt-1 h-9 px-3 rounded-md border bg-input text-sm focus:outline-none focus:ring-1 focus:ring-ring"
					/>
					<p className="text-[10px] text-muted-foreground mt-1">
						Default: {formatNumber(DEFAULT_GAME_SETTINGS.exquisiteRecipe.restorationScrolls)}
					</p>
				</div>

				<div>
					<label className="text-xs text-muted-foreground">Pristine Black Crystals</label>
					<input
						type="number"
						min="0"
						value={gameSettings.exquisiteRecipe.pristineBlackCrystal}
						onChange={(e) => {
							const val = Number.parseInt(e.target.value, 10) || 0
							updateRecipe('pristineBlackCrystal', Math.max(0, val))
						}}
						className="w-full mt-1 h-9 px-3 rounded-md border bg-input text-sm focus:outline-none focus:ring-1 focus:ring-ring"
					/>
					<p className="text-[10px] text-muted-foreground mt-1">
						Default: {DEFAULT_GAME_SETTINGS.exquisiteRecipe.pristineBlackCrystal}
					</p>
				</div>

				<div>
					<label className="text-xs text-muted-foreground">Valks +100%</label>
					<input
						type="number"
						min="0"
						value={gameSettings.exquisiteRecipe.valks100}
						onChange={(e) => {
							const val = Number.parseInt(e.target.value, 10) || 0
							updateRecipe('valks100', Math.max(0, val))
						}}
						className="w-full mt-1 h-9 px-3 rounded-md border bg-input text-sm focus:outline-none focus:ring-1 focus:ring-ring"
					/>
					<p className="text-[10px] text-muted-foreground mt-1">
						Default: {DEFAULT_GAME_SETTINGS.exquisiteRecipe.valks100}
					</p>
				</div>
			</CardContent>
		</Card>
	)
}

function PriceInput({
	label,
	value,
	onChange,
	defaultValue,
}: {
	label: string
	value: number
	onChange: (v: number) => void
	defaultValue: number
}) {
	const [inputValue, setInputValue] = useState(formatNumber(value))

	return (
		<div>
			<label className="text-xs text-muted-foreground">{label}</label>
			<input
				type="text"
				value={inputValue}
				onChange={(e) => {
					setInputValue(e.target.value)
					const num = Number.parseInt(e.target.value.replace(/,/g, ''), 10)
					if (!Number.isNaN(num)) {
						onChange(num)
					}
				}}
				onBlur={() => setInputValue(formatNumber(value))}
				className="w-full mt-1 h-9 px-3 rounded-md border bg-input text-sm focus:outline-none focus:ring-1 focus:ring-ring"
			/>
			<p className="text-[10px] text-muted-foreground mt-1">
				Default: {formatNumber(defaultValue)} silver
			</p>
		</div>
	)
}
