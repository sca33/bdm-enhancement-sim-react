import { ROMAN_NUMERALS } from '@bdm-sim/simulator'
import { History, Pin, PinOff, Trash2 } from 'lucide-react'
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
import { type SavedRun, useStore } from '@/hooks/use-store'
import { formatSilver } from '@/lib/utils'

function formatTimestamp(ts: number): string {
	const date = new Date(ts)
	const now = new Date()
	const isToday = date.toDateString() === now.toDateString()

	if (isToday) {
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
	}

	return (
		date.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
		' ' +
		date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
	)
}

function RunItem({
	run,
	onLoad,
	onDelete,
	onTogglePin,
}: {
	run: SavedRun
	onLoad: () => void
	onDelete: () => void
	onTogglePin: () => void
}) {
	return (
		<div
			className={`flex items-center gap-2 p-2 rounded border transition-colors ${run.pinned ? 'bg-accent/20 border-accent/50' : 'bg-muted/30 hover:bg-muted/50'}`}
		>
			<button type="button" onClick={onLoad} className="flex-1 text-left">
				<div className="flex items-center justify-between">
					<span className="text-xs font-medium flex items-center gap-1">
						{run.pinned && <Pin className="w-3 h-3 text-accent" />}+
						{ROMAN_NUMERALS[run.targetLevel]}
					</span>
					<span className="text-xs text-muted-foreground">{formatTimestamp(run.timestamp)}</span>
				</div>
				<div className="text-xs text-muted-foreground mt-0.5">
					{formatSilver(run.silver)} • {run.attempts.toLocaleString()} attempts
				</div>
			</button>
			<Button
				variant="ghost"
				size="icon"
				className={`h-7 w-7 shrink-0 ${run.pinned ? 'text-accent hover:text-accent/80' : 'text-muted-foreground hover:text-accent'}`}
				onClick={(e) => {
					e.stopPropagation()
					onTogglePin()
				}}
				title={run.pinned ? 'Unpin' : 'Pin'}
			>
				{run.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
			</Button>
			<Button
				variant="ghost"
				size="icon"
				className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
				onClick={(e) => {
					e.stopPropagation()
					onDelete()
				}}
				title="Delete"
			>
				<Trash2 className="w-3.5 h-3.5" />
			</Button>
		</div>
	)
}

export function SimulationHistory() {
	const { savedRuns, loadRun, deleteRun, togglePinRun, clearAllRuns } = useStore()
	const [open, setOpen] = useState(false)

	const handleLoad = (id: string) => {
		loadRun(id)
		setOpen(false)
	}

	const pinnedCount = savedRuns.filter((r) => r.pinned).length

	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetTrigger asChild>
				<Button variant="ghost" size="icon" className="shrink-0">
					<History className="w-4 h-4" />
				</Button>
			</SheetTrigger>
			<SheetContent className="overflow-y-auto">
				<SheetHeader>
					<SheetTitle>Simulation History</SheetTitle>
					<SheetDescription>
						{savedRuns.length} saved run{savedRuns.length !== 1 ? 's' : ''}
						{pinnedCount > 0 && ` (${pinnedCount} pinned)`}
					</SheetDescription>
				</SheetHeader>

				<div className="mt-4 space-y-4">
					<p className="text-xs text-muted-foreground">
						Runs are auto-saved when completed. Pin runs to protect them from auto-deletion.
					</p>

					{/* Runs list */}
					{savedRuns.length > 0 ? (
						<div className="space-y-2">
							{savedRuns.map((run) => (
								<RunItem
									key={run.id}
									run={run}
									onLoad={() => handleLoad(run.id)}
									onDelete={() => deleteRun(run.id)}
									onTogglePin={() => togglePinRun(run.id)}
								/>
							))}
						</div>
					) : (
						<div className="text-center py-8 text-sm text-muted-foreground">
							No saved runs yet. Complete a simulation to save it.
						</div>
					)}

					{/* Clear all */}
					{savedRuns.length > 0 && (
						<Button variant="destructive" className="w-full" onClick={clearAllRuns}>
							<Trash2 className="w-4 h-4 mr-2" />
							Clear All Runs
						</Button>
					)}
				</div>
			</SheetContent>
		</Sheet>
	)
}
