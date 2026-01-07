import { ROMAN_NUMERALS } from '@bdm-sim/simulator'
import { History, Trash2 } from 'lucide-react'
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
import { useStore, type SavedRun } from '@/hooks/use-store'
import { formatSilver } from '@/lib/utils'

function formatTimestamp(ts: number): string {
	const date = new Date(ts)
	const now = new Date()
	const isToday = date.toDateString() === now.toDateString()

	if (isToday) {
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
	}

	return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
		' ' +
		date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function RunItem({
	run,
	onLoad,
	onDelete,
}: {
	run: SavedRun
	onLoad: () => void
	onDelete: () => void
}) {
	return (
		<div className="flex items-center gap-2 p-2 rounded border bg-muted/30 hover:bg-muted/50 transition-colors">
			<button
				type="button"
				onClick={onLoad}
				className="flex-1 text-left"
			>
				<div className="flex items-center justify-between">
					<span className="text-xs font-medium">
						+{ROMAN_NUMERALS[run.targetLevel]}
					</span>
					<span className="text-xs text-muted-foreground">
						{formatTimestamp(run.timestamp)}
					</span>
				</div>
				<div className="text-xs text-muted-foreground mt-0.5">
					{formatSilver(run.silver)} • {run.attempts.toLocaleString()} attempts
				</div>
			</button>
			<Button
				variant="ghost"
				size="icon"
				className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
				onClick={(e) => {
					e.stopPropagation()
					onDelete()
				}}
			>
				<Trash2 className="w-3.5 h-3.5" />
			</Button>
		</div>
	)
}

export function SimulationHistory() {
	const { savedRuns, loadRun, deleteRun, clearAllRuns, saveCurrentRun, stepHistory, isRunning } = useStore()
	const [open, setOpen] = useState(false)

	const handleLoad = (id: string) => {
		loadRun(id)
		setOpen(false)
	}

	const canSave = stepHistory.length > 0 && !isRunning

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
					</SheetDescription>
				</SheetHeader>

				<div className="mt-4 space-y-4">
					{/* Save current button */}
					<Button
						variant="outline"
						className="w-full"
						onClick={saveCurrentRun}
						disabled={!canSave}
					>
						Save Current Run
					</Button>

					{/* Runs list */}
					{savedRuns.length > 0 ? (
						<div className="space-y-2">
							{savedRuns.map((run) => (
								<RunItem
									key={run.id}
									run={run}
									onLoad={() => handleLoad(run.id)}
									onDelete={() => deleteRun(run.id)}
								/>
							))}
						</div>
					) : (
						<div className="text-center py-8 text-sm text-muted-foreground">
							No saved runs yet
						</div>
					)}

					{/* Clear all */}
					{savedRuns.length > 0 && (
						<Button
							variant="destructive"
							className="w-full"
							onClick={clearAllRuns}
						>
							<Trash2 className="w-4 h-4 mr-2" />
							Clear All Runs
						</Button>
					)}
				</div>
			</SheetContent>
		</Sheet>
	)
}
