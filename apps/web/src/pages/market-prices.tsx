import { ArrowLeft, Save } from 'lucide-react'
import { useState } from 'react'

import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
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
		<div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
			<label className="text-sm w-full sm:w-48 shrink-0">{label}</label>
			<div className="flex items-center gap-2 flex-1">
				<input
					type="text"
					value={input}
					onChange={(e) => {
						setInput(e.target.value)
						const num = parseInt(e.target.value.replace(/,/g, ''), 10)
						if (!isNaN(num)) onChange(num)
					}}
					onBlur={() => setInput(String(value))}
					placeholder={placeholder}
					className="flex-1 h-9 px-3 rounded-md border bg-input text-sm focus:outline-none focus:ring-1 focus:ring-ring"
				/>
				<span className="text-muted-foreground text-sm">silver</span>
			</div>
		</div>
	)
}

export function MarketPricesPage() {
	const { prices, setPrice, setPage } = useStore()

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-4">
				<Button variant="ghost" size="icon" onClick={() => setPage('home')}>
					<ArrowLeft className="w-4 h-4" />
				</Button>
				<h2 className="text-xl font-semibold">Market Prices Configuration</h2>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">Material Prices</CardTitle>
					<p className="text-sm text-muted-foreground">Set to 0 if not applicable or unknown</p>
				</CardHeader>
				<CardContent className="space-y-4">
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
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">Advice of Valks Prices</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<PriceInput
						label="Valks +10%"
						value={prices.valks10Price}
						onChange={(v) => setPrice('valks10Price', v)}
						placeholder="0"
					/>
					<PriceInput
						label="Valks +50%"
						value={prices.valks50Price}
						onChange={(v) => setPrice('valks50Price', v)}
						placeholder="0"
					/>
					<PriceInput
						label="Valks +100%"
						value={prices.valks100Price}
						onChange={(v) => setPrice('valks100Price', v)}
						placeholder="0"
					/>
				</CardContent>
			</Card>

			<Button className="w-full" onClick={() => setPage('home')}>
				<Save className="w-4 h-4 mr-2" />
				Save & Return
			</Button>
		</div>
	)
}
