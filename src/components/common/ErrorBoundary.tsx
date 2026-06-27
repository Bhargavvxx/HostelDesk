import React, { ErrorInfo, ReactNode } from "react"
import { AlertCircle, RefreshCw } from "lucide-react"

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // In a real app, we might log this to a telemetry service.
    // For now, console log is sufficient for the local-first architecture.
    console.error("ErrorBoundary caught an error:", error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full items-center justify-center p-4">
          <div className="flex w-full max-w-md flex-col items-center justify-center rounded-xl border border-border bg-card p-8 text-center shadow-sm">
            <div className="flex size-12 items-center justify-center rounded-full bg-destructive/15 text-destructive mb-4">
              <AlertCircle className="size-6" />
            </div>
            <h2 className="text-xl font-bold tracking-tight mb-2">Something went wrong</h2>
            <p className="text-sm text-muted-foreground mb-6">
              The application encountered an unexpected error. Your data is safe locally.
            </p>
            {this.state.error && (
              <div className="mb-6 w-full rounded-md bg-muted p-3 text-left text-xs text-muted-foreground overflow-auto max-h-32 font-mono">
                {this.state.error.message}
              </div>
            )}
            <button
              onClick={this.handleReload}
              className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 w-full"
            >
              <RefreshCw className="size-4" />
              Reload Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
