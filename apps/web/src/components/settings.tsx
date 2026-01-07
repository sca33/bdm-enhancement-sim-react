import {
	ANVIL_THRESHOLDS,
	ENHANCEMENT_RATES,
	EXQUISITE_BLACK_CRYSTAL_RECIPE,
	HEPTA_OKTA_ANVIL_PITY,
	HEPTA_OKTA_SUCCESS_RATE,
	HEPTA_SUB_ENHANCEMENTS,
	OKTA_SUB_ENHANCEMENTS,
	RESTORATION_SUCCESS_RATE,
	ROMAN_NUMERALS,
} from '@bdm-sim/simulator'
import { Settings as SettingsIcon } from 'lucide-react'
import { useState } from 'react'

import {
	Button,
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from '@/components/ui'
import { useStore } from '@/hooks/use-store'

function PriceInput({
	label,
	value,
	onChange,
	placeholder,
}: {
	label: string
	value: number
	onChange: (v: number) => void
	placeholder?: string
}) {
	const [input, setInput] = useState(String(value))

	return (
		<div className="flex items-center justify-between gap-2">
			<label className="text-xs shrink-0">{label}</label>
			<div className="flex items-center gap-1">
				<input
					type="text"
					value={input}
					onChange={(e) => {
						setInput(e.target.value)
						const num = Number.parseInt(e.target.value.replace(/,/g, ''), 10)
						if (!isNaN(num)) onChange(num)
					}}
					onBlur={() => setInput(String(value))}
					placeholder={placeholder}
					className="w-28 h-7 px-2 rounded border bg-input text-xs focus:outline-none focus:ring-1 focus:ring-ring text-right"
				/>
			</div>
		</div>
	)
}

export function Settings() {
	const { prices, setPrice } = useStore()
	const [open, setOpen] = useState(false)

	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetTrigger asChild>
				<Button variant="ghost" size="icon" className="shrink-0">
					<SettingsIcon className="w-4 h-4" />
				</Button>
			</SheetTrigger>
			<SheetContent className="overflow-y-auto">
				<SheetHeader>
					<SheetTitle>Settings</SheetTitle>
					<SheetDescription>Configure market prices and view game constants</SheetDescription>
				</SheetHeader>

				<div className="mt-6 space-y-6">
					{/* Market Prices */}
					<section>
						<h3 className="text-sm font-semibold mb-3">Market Prices</h3>
						<div className="space-y-3">
							<PriceInput
								label="Pristine Black Crystal"
								value={prices.crystalPrice}
								onChange={(v) => setPrice('crystalPrice', v)}
								placeholder="34650000"
							/>
							<PriceInput
								label="200K Restoration Scrolls"
								value={prices.restorationBundlePrice}
								onChange={(v) => setPrice('restorationBundlePrice', v)}
								placeholder="1000000000000"
							/>
							<div className="border-t pt-3 mt-3">
								<p className="text-xs text-muted-foreground mb-2">Advice of Valks (0 if N/A)</p>
								<div className="space-y-2">
									<PriceInput
										label="+10%"
										value={prices.valks10Price}
										onChange={(v) => setPrice('valks10Price', v)}
									/>
									<PriceInput
										label="+50%"
										value={prices.valks50Price}
										onChange={(v) => setPrice('valks50Price', v)}
									/>
									<PriceInput
										label="+100%"
										value={prices.valks100Price}
										onChange={(v) => setPrice('valks100Price', v)}
									/>
								</div>
							</div>
						</div>
					</section>

					{/* Enhancement Rates */}
					<section>
						<h3 className="text-sm font-semibold mb-3">Enhancement Rates</h3>
						<div className="text-xs font-mono bg-muted/50 rounded p-2 space-y-0.5">
							{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
								<div key={level} className="flex justify-between">
									<span>+{ROMAN_NUMERALS[level]}</span>
									<span>{((ENHANCEMENT_RATES[level] ?? 0) * 100).toFixed(1)}%</span>
								</div>
							))}
						</div>
					</section>

					{/* Anvil Pity */}
					<section>
						<h3 className="text-sm font-semibold mb-3">Anvil Pity Thresholds</h3>
						<p className="text-xs text-muted-foreground mb-2">
							Failures needed for guaranteed success
						</p>
						<div className="text-xs font-mono bg-muted/50 rounded p-2 space-y-0.5">
							{[3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
								<div key={level} className="flex justify-between">
									<span>+{ROMAN_NUMERALS[level]}</span>
									<span>{ANVIL_THRESHOLDS[level]} fails</span>
								</div>
							))}
						</div>
					</section>

					{/* Hepta/Okta */}
					<section>
						<h3 className="text-sm font-semibold mb-3">Hepta/Okta System</h3>
						<div className="text-xs space-y-1 bg-muted/50 rounded p-2">
							<div className="flex justify-between">
								<span>Hepta (VII→VIII)</span>
								<span>{HEPTA_SUB_ENHANCEMENTS} subs</span>
							</div>
							<div className="flex justify-between">
								<span>Okta (VIII→IX)</span>
								<span>{OKTA_SUB_ENHANCEMENTS} subs</span>
							</div>
							<div className="flex justify-between">
								<span>Sub success rate</span>
								<span>{(HEPTA_OKTA_SUCCESS_RATE * 100).toFixed(0)}%</span>
							</div>
							<div className="flex justify-between">
								<span>Sub pity threshold</span>
								<span>{HEPTA_OKTA_ANVIL_PITY} fails</span>
							</div>
						</div>
					</section>

					{/* Exquisite Crystal Recipe */}
					<section>
						<h3 className="text-sm font-semibold mb-3">Exquisite Black Crystal</h3>
						<p className="text-xs text-muted-foreground mb-2">Crafting recipe (per crystal)</p>
						<div className="text-xs space-y-1 bg-muted/50 rounded p-2">
							<div className="flex justify-between">
								<span>Restoration Scrolls</span>
								<span>{EXQUISITE_BLACK_CRYSTAL_RECIPE.restorationScrolls.toLocaleString()}</span>
							</div>
							<div className="flex justify-between">
								<span>Pristine Black Crystal</span>
								<span>{EXQUISITE_BLACK_CRYSTAL_RECIPE.pristineBlackCrystal}</span>
							</div>
							<div className="flex justify-between">
								<span>Valks +100%</span>
								<span>{EXQUISITE_BLACK_CRYSTAL_RECIPE.valks100}</span>
							</div>
						</div>
					</section>

					{/* Restoration */}
					<section>
						<h3 className="text-sm font-semibold mb-3">Restoration Scrolls</h3>
						<div className="text-xs space-y-1 bg-muted/50 rounded p-2">
							<div className="flex justify-between">
								<span>Scrolls per attempt</span>
								<span>200</span>
							</div>
							<div className="flex justify-between">
								<span>Success rate</span>
								<span>{(RESTORATION_SUCCESS_RATE * 100).toFixed(0)}%</span>
							</div>
						</div>
					</section>
				</div>
			</SheetContent>
		</Sheet>
	)
}
