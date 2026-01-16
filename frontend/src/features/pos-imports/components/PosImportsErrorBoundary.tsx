import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, ArrowLeft, Mail, FileText } from 'lucide-react'
import { 
  categorizeError, 
  reportErrorToMonitoring, 
  getErrorTitle, 
  getErrorDescription,
  assessBusinessImpact,
  type ErrorCategory 
} from '@/utils/error-monitoring.util'

interface Props {
  children: ReactNode
  module?: string
  submodule?: string
  feature?: string
  businessCritical?: boolean
}

interface State {
  hasError: boolean
  error: Error | null
  errorCategory?: ErrorCategory
  preservedState?: {
    timestamp: string
    formData?: unknown
    selectedIds?: unknown
    [key: string]: unknown
  }
}

export class PosImportsErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, preservedState: undefined }
  }

  static getDerivedStateFromError(error: Error): State {
    const category = categorizeError(error)
    return { hasError: true, error, errorCategory: category }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const category = this.state.errorCategory || categorizeError(error)
    
    // Preserve state before error
    const preservedState = this.captureCurrentState()
    this.setState({ preservedState })
    
    // Get user and branch context
    const userId = this.getUserId()
    const branchId = this.getBranchId()
    
    // Report to monitoring system
    reportErrorToMonitoring({
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      category,
      context: {
        userId,
        branchId,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        route: window.location.pathname,
        componentStack: errorInfo.componentStack,
        preservedState
      },
      module: this.props.module || 'POS_IMPORTS',
      submodule: this.props.submodule,
      businessImpact: assessBusinessImpact(category)
    })
  }
  
  private captureCurrentState(): { timestamp: string; formData?: unknown; selectedIds?: unknown; [key: string]: unknown } {
    try {
      // Capture relevant state from localStorage/sessionStorage
      const state: { timestamp: string; formData?: unknown; selectedIds?: unknown; [key: string]: unknown } = {
        timestamp: new Date().toISOString()
      }
      
      // Try to capture form data from sessionStorage
      const formData = sessionStorage.getItem('formData')
      if (formData) {
        state.formData = JSON.parse(formData)
      }
      
      // Try to capture selection state
      const selection = sessionStorage.getItem('selectedIds')
      if (selection) {
        state.selectedIds = JSON.parse(selection)
      }
      
      return state
    } catch {
      return { timestamp: new Date().toISOString() }
    }
  }
  
  private getUserId(): string | undefined {
    try {
      const authStore = localStorage.getItem('auth-storage')
      if (authStore) {
        const parsed = JSON.parse(authStore)
        return parsed.state?.user?.id
      }
    } catch {
      return undefined
    }
  }
  
  private getBranchId(): string | undefined {
    try {
      const branchStore = localStorage.getItem('branch-context-storage')
      if (branchStore) {
        const parsed = JSON.parse(branchStore)
        return parsed.state?.currentBranch?.branch_id
      }
    } catch {
      return undefined
    }
  }
  
  private handleReload = () => {
    window.location.reload()
  }
  
  private handleGoBack = () => {
    window.history.back()
  }
  
  private handleClearCacheAndRetry = () => {
    // Clear relevant caches
    sessionStorage.clear()
    window.location.reload()
  }
  
  private handleReportError = () => {
    const { error, errorCategory } = this.state
    const subject = encodeURIComponent(`Error Report: ${error?.name || 'Unknown Error'}`)
    const body = encodeURIComponent(
      `Error: ${error?.message}\n` +
      `Type: ${errorCategory?.type}\n` +
      `Severity: ${errorCategory?.severity}\n` +
      `Module: ${this.props.module || 'POS_IMPORTS'}\n` +
      `URL: ${window.location.href}\n` +
      `Time: ${new Date().toISOString()}`
    )
    window.location.href = `mailto:support@suryamas.com?subject=${subject}&body=${body}`
  }
  
  private handleRestoreState = () => {
    const { preservedState } = this.state
    if (!preservedState) return
    
    try {
      // Restore to sessionStorage
      if (preservedState.formData) {
        sessionStorage.setItem('formData', JSON.stringify(preservedState.formData))
      }
      if (preservedState.selectedIds) {
        sessionStorage.setItem('selectedIds', JSON.stringify(preservedState.selectedIds))
      }
      
      // Reload page to restore state
      window.location.reload()
    } catch (err) {
      console.error('Failed to restore state:', err)
      window.location.reload()
    }
  }

  render() {
    if (this.state.hasError) {
      const { error, errorCategory, preservedState } = this.state
      const title = getErrorTitle(errorCategory)
      const description = getErrorDescription(errorCategory)
      
      const severityColors = {
        CRITICAL: 'bg-red-50 border-red-200',
        HIGH: 'bg-orange-50 border-orange-200',
        MEDIUM: 'bg-yellow-50 border-yellow-200',
        LOW: 'bg-blue-50 border-blue-200'
      }
      
      const iconColors = {
        CRITICAL: 'text-red-500',
        HIGH: 'text-orange-500',
        MEDIUM: 'text-yellow-500',
        LOW: 'text-blue-500'
      }
      
      const severity = errorCategory?.severity || 'MEDIUM'
      const hasPreservedState = preservedState && Object.keys(preservedState).length > 1 // More than just timestamp
      
      return (
        <div className="p-6">
          <div className={`border rounded-lg p-6 ${severityColors[severity]}`}>
            <div className="flex items-start gap-3">
              <AlertTriangle className={`shrink-0 mt-0.5 ${iconColors[severity]}`} size={24} />
              <div className="flex-1">
                <h3 className="font-medium text-gray-900 text-lg mb-1">{title}</h3>
                
                <div className="text-sm text-gray-700 mb-4 space-y-2">
                  <p className="font-medium">{error?.message}</p>
                  <p>{description}</p>
                  
                  {this.props.businessCritical && (
                    <p className="text-red-700 font-medium">
                      ⚠️ This is a business-critical operation. Please contact support immediately.
                    </p>
                  )}
                  
                  {/* State Preservation Notice */}
                  {hasPreservedState && (
                    <p className="text-green-700 font-medium">
                      ✅ Your work has been preserved and can be restored.
                    </p>
                  )}
                </div>

                {/* Recovery Actions */}
                <div className="flex flex-wrap gap-3">
                  {/* Restore State (if available) */}
                  {hasPreservedState && (
                    <button
                      onClick={this.handleRestoreState}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                    >
                      <RefreshCw size={16} />
                      Restore My Work
                    </button>
                  )}
                  
                  {/* Default: Reload */}
                  <button
                    onClick={this.handleReload}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2"
                  >
                    <RefreshCw size={16} />
                    Reload Page
                  </button>
                  
                  {/* Network error: Clear cache */}
                  {errorCategory?.type === 'NETWORK' && (
                    <button
                      onClick={this.handleClearCacheAndRetry}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                    >
                      <RefreshCw size={16} />
                      Clear Cache & Retry
                    </button>
                  )}
                  
                  {/* Permission error: Go back */}
                  {errorCategory?.type === 'PERMISSION' && (
                    <button
                      onClick={this.handleGoBack}
                      className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-2"
                    >
                      <ArrowLeft size={16} />
                      Go Back
                    </button>
                  )}
                  
                  {/* Critical error: Contact support */}
                  {(errorCategory?.severity === 'CRITICAL' || this.props.businessCritical) && (
                    <button
                      onClick={this.handleReportError}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                    >
                      <Mail size={16} />
                      Contact Support
                    </button>
                  )}
                  
                  {/* Report error */}
                  <button
                    onClick={this.handleReportError}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                  >
                    <FileText size={16} />
                    Report Error
                  </button>
                </div>
                
                {/* Technical details (collapsible) */}
                {import.meta.env.DEV && error?.stack && (
                  <details className="mt-4">
                    <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-800">
                      Technical Details (Development Only)
                    </summary>
                    <pre className="mt-2 text-xs bg-gray-100 p-3 rounded overflow-auto max-h-40">
                      {error.stack}
                    </pre>
                    {hasPreservedState && (
                      <pre className="mt-2 text-xs bg-green-100 p-3 rounded overflow-auto max-h-40">
                        Preserved State: {JSON.stringify(preservedState, null, 2)}
                      </pre>
                    )}
                  </details>
                )}
              </div>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
