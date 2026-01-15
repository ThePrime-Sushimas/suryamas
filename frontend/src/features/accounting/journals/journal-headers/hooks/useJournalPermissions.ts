import { usePermissionStore } from '@/features/branch_context/store/permission.store'

/**
 * Custom hook for journal-specific permissions
 * Maps journal workflow actions to existing permission system
 * 
 * CRITICAL MAPPING:
 * - Staff/Accountant (can_update): Can create, edit, submit
 * - Manager (can_approve): Can approve, reject
 * - Director (can_release): Can post to GL, reverse
 */
export function useJournalPermissions() {
  const hasPermission = usePermissionStore((state) => state.hasPermission)
  
  return {
    // Basic CRUD
    canView: hasPermission('journals', 'view'),
    canCreate: hasPermission('journals', 'insert'),
    canEdit: hasPermission('journals', 'update'),
    canDelete: hasPermission('journals', 'delete'),
    
    // Workflow permissions (CORRECTED MAPPING)
    canSubmit: hasPermission('journals', 'update'),    // ⚠️ Staff can submit
    canApprove: hasPermission('journals', 'approve'),  // Manager can approve
    canReject: hasPermission('journals', 'approve'),   // Manager can reject
    canPost: hasPermission('journals', 'release'),     // Director can post
    canReverse: hasPermission('journals', 'release'),  // ⚠️ Director can reverse (not delete!)
    canRestore: hasPermission('journals', 'insert'),   // Anyone with insert
  }
}
