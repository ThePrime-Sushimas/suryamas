/**
 * Audit Trail Utility
 * 
 * Provides client-side audit logging for user actions.
 * Currently logs to console, can be extended to send to backend audit service.
 */

export interface AuditLogEntry {
  action: string
  entityType: string
  entityId?: string
  userId?: string
  userEmail?: string
  branchId?: string
  branchName?: string
  timestamp: string
  reason?: string
  context?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

/**
 * Log an audit trail entry
 * @param entry Audit log entry details
 */
export const logAuditAction = (entry: AuditLogEntry): void => {
  // Console logging for development
  console.log('[AUDIT]', {
    ...entry,
    timestamp: entry.timestamp || new Date().toISOString()
  })
  
  // Send to backend audit service (uses existing perm_audit_log table)
  if (typeof window !== 'undefined') {
    fetch('/api/v1/monitoring/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
      keepalive: true
    }).catch(() => {
      // Silently fail if service unavailable
    })
  }
}

/**
 * Create audit log entry for confirmation actions
 */
export const createConfirmationAudit = (
  action: string,
  entityType: string,
  options: {
    entityId?: string
    userId?: string
    userEmail?: string
    branchId?: string
    branchName?: string
    reason?: string
    context?: Record<string, unknown>
  }
): AuditLogEntry => {
  return {
    action,
    entityType,
    entityId: options.entityId,
    userId: options.userId,
    userEmail: options.userEmail,
    branchId: options.branchId,
    branchName: options.branchName,
    timestamp: new Date().toISOString(),
    reason: options.reason,
    context: options.context
  }
}
