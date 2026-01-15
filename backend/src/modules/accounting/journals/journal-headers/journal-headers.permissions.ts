/**
 * Journal Permission Mapping
 * Maps journal workflow actions to existing permission system
 * 
 * CRITICAL: Permission mapping must reflect business logic:
 * - Staff/Accountant can submit (can_update)
 * - Manager can approve/reject (can_approve)
 * - Director can post/reverse (can_release)
 */

export const JOURNAL_PERMISSIONS = {
  // Basic CRUD
  VIEW: 'view',
  CREATE: 'insert',
  EDIT: 'update',
  DELETE: 'delete',
  
  // Workflow actions (CORRECTED MAPPING)
  SUBMIT: 'update',      // Staff/Accountant can submit for approval
  APPROVE: 'approve',    // Manager can approve
  REJECT: 'approve',     // Manager can reject
  POST: 'release',       // Director can post to GL (finalize)
  REVERSE: 'release',    // Director can reverse (serious action, not delete!)
  RESTORE: 'insert',     // Anyone with insert can restore
} as const

export type JournalPermissionAction = typeof JOURNAL_PERMISSIONS[keyof typeof JOURNAL_PERMISSIONS]

/**
 * Permission requirements for each journal status transition
 * This enforces separation of duties
 */
export const JOURNAL_STATUS_PERMISSIONS = {
  DRAFT: {
    edit: JOURNAL_PERMISSIONS.EDIT,
    delete: JOURNAL_PERMISSIONS.DELETE,
    submit: JOURNAL_PERMISSIONS.EDIT,  // ⚠️ CHANGED: update, not approve
  },
  SUBMITTED: {
    approve: JOURNAL_PERMISSIONS.APPROVE,
    reject: JOURNAL_PERMISSIONS.REJECT,
  },
  APPROVED: {
    post: JOURNAL_PERMISSIONS.POST,
    reject: JOURNAL_PERMISSIONS.REJECT,
  },
  POSTED: {
    reverse: JOURNAL_PERMISSIONS.REVERSE,  // ⚠️ CHANGED: release, not delete
  },
  REJECTED: {
    delete: JOURNAL_PERMISSIONS.DELETE,
  },
  REVERSED: {
    restore: JOURNAL_PERMISSIONS.RESTORE,
  },
} as const
