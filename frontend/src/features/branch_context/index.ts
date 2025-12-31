export { useBranchContextStore } from './store/branchContext.store'
export { usePermissionStore } from './store/permission.store'
export type { BranchContext, PermissionMatrix, PermissionAction } from './types'

export { branchApi } from './api/branchContext.api'

export { BranchSwitcher } from './components/BranchSwitcher'
export { BranchSelectionGuard } from './components/BranchSelectionGuard'
export { PermissionProvider } from './components/PermissionProvider'
export { BranchContextErrorBoundary } from './components/BranchContextErrorBoundary'

export { useBranchContext, useRequiredBranchContext } from './hooks/useBranchContext'
export { usePermission } from './hooks/usePermission'
