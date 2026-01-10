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
		// Log full error details for debugging (only visible in dev tools)
		console.error('Error boundary caught error:', error, errorInfo)
	}

	/**
	 * Sanitize error message for display to user.
	 * Removes potentially sensitive information like file paths, URLs, or stack traces.
	 */
	getSafeErrorMessage(): string {
		const error = this.state.error
		if (!error?.message) return 'Unknown error'

		const message = error.message

		// Check for common sensitive patterns
		const sensitivePatterns = [
			/https?:\/\/[^\s]+/gi, // URLs
			/\/[a-z_\-/.]+\.(js|ts|tsx|jsx|mjs)/gi, // File paths
			/at\s+\w+\s+\([^)]+\)/gi, // Stack trace lines
			/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, // Emails
		]

		let sanitized = message
		for (const pattern of sensitivePatterns) {
			sanitized = sanitized.replace(pattern, '[redacted]')
		}

		// Truncate very long messages
		if (sanitized.length > 200) {
			sanitized = sanitized.substring(0, 200) + '...'
		}

		return sanitized
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
									{this.getSafeErrorMessage()}
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
