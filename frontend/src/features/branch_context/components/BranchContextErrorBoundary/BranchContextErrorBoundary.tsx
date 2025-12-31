import React from 'react'

interface BranchContextErrorBoundaryProps {
  children: React.ReactNode
}

interface BranchContextErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class BranchContextErrorBoundary extends React.Component<
  BranchContextErrorBoundaryProps,
  BranchContextErrorBoundaryState
> {
  constructor(props: BranchContextErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Branch Context Error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-4">
              Branch Context Error
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
