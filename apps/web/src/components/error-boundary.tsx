import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'

import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'

interface Props {
	children: ReactNode
}

interface State {
	hasError: boolean
	error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props)
		this.state = { hasError: false, error: null }
	}

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error }
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		console.error('Error boundary caught error:', error, errorInfo)
	}

	handleReset = () => {
		this.setState({ hasError: false, error: null })
		// Clear any persisted state that might be causing issues
		try {
			localStorage.removeItem('bdm-sim-storage')
		} catch {
			// Ignore storage errors
		}
		window.location.reload()
	}

	render() {
		if (this.state.hasError) {
			return (
				<div className="min-h-screen bg-background flex items-center justify-center p-4">
					<Card className="max-w-md w-full">
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-destructive">
								<AlertTriangle className="w-5 h-5" />
								Something went wrong
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<p className="text-sm text-muted-foreground">
								An unexpected error occurred in the simulation. This might be due to corrupted state
								or a bug in the application.
							</p>
							{this.state.error && (
								<div className="bg-muted p-3 rounded text-xs font-mono overflow-auto max-h-32">
									{this.state.error.message}
								</div>
							)}
							<Button onClick={this.handleReset} className="w-full">
								<RefreshCw className="w-4 h-4 mr-2" />
								Reset and Reload
							</Button>
						</CardContent>
					</Card>
				</div>
			)
		}

		return this.props.children
	}
}
