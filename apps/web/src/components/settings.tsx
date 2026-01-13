import { Settings as SettingsIcon } from 'lucide-react'

import { Button } from '@/components/ui'
import { useStore } from '@/hooks/use-store'

export function Settings() {
	const setPage = useStore((s) => s.setPage)

	return (
		<Button variant="outline" size="sm" onClick={() => setPage('settings')}>
			<SettingsIcon className="w-4 h-4 mr-2" />
			Settings
		</Button>
	)
}
