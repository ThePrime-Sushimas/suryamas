import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class BankStatementImportErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // TODO: integrate with global error monitoring util if needed
    console.error('BankStatementImportErrorBoundary caught error', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="alert alert-error">
          <div>
            <h3 className="font-semibold">Terjadi kesalahan di modul Bank Statement Import</h3>
            <p className="text-sm">
              Silakan muat ulang halaman atau hubungi administrator jika masalah berlanjut.
            </p>
            {this.state.error && (
              <pre className="mt-2 text-xs opacity-70 overflow-auto max-h-32">
                {this.state.error.message}
              </pre>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

