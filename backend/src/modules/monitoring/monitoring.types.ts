/**
 * Monitoring Module Types
 *
 * Types for audit trail and error monitoring
 */

export type ErrorType =
  | "DATA_VALIDATION"
  | "NETWORK"
  | "PERMISSION"
  | "SYSTEM"
  | "BUSINESS_RULE";
export type ErrorSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface ErrorCategory {
  type: ErrorType;
  severity: ErrorSeverity;
  recoverable: boolean;
  requiresAdminAttention: boolean;
}

export interface ErrorReport {
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  category: ErrorCategory;
  context: {
    userId?: string;
    branchId?: string;
    timestamp: string;
    userAgent: string;
    url: string;
    route: string;
    [key: string]: any;
  };
  module: string;
  submodule?: string;
  businessImpact?: string;
}

export interface AuditLogEntry {
  action: string;
  entityType: string;
  entityId?: string;
  userId?: string;
  userEmail?: string;
  branchId?: string;
  branchName?: string;
  timestamp: string;
  reason?: string;
  context?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface ErrorLogRecord {
  id: string;
  error_name: string;
  error_message: string;
  error_stack?: string;
  error_type: ErrorType;
  severity: ErrorSeverity;
  module: string;
  submodule?: string;
  user_id?: string;
  branch_id?: string;
  url: string;
  route: string;
  user_agent: string;
  business_impact?: string;
  context?: Record<string, any>;
  created_at: string;
}

/**
 * Error report data for database storage
 * Transformed from frontend ErrorReport
 */
export interface ErrorReportData {
  errorName: string;
  errorMessage: string;
  errorStack?: string;
  errorType: string;
  severity: string;
  module: string;
  submodule?: string;
  userId?: string;
  branchId?: string;
  url: string;
  route: string;
  userAgent: string;
  businessImpact?: string;
  context?: Record<string, any>;
}

export interface AuditLogRecord {
  id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  user_id?: string;
  user_name?: string | null;
  user_email?: string;
  branch_id?: string;
  branch_name?: string;
  reason?: string;
  context?: Record<string, any>;
  metadata?: Record<string, any>;
  old_value?: any;
  new_value?: any;
  created_at: string;
  deleted_at?: string;
}

// ============================================================================
// CLEANUP TYPES
// ============================================================================

/**
 * Preview result for cleanup dry-run
 */
export interface CleanupPreview {
  totalRecords: number;
  totalSize: string;
  dateRange: { oldest: Date; newest: Date };
  byEntityType: Record<string, number>;
}

/**
 * Result from batch cleanup operation
 */
export interface CleanupResult {
  deleted: number;
  batches: number;
}

/**
 * Result from archive and cleanup operation
 */
export interface ArchiveResult {
  archived: number;
  deleted: number;
  archivePath: string;
}

export interface ErrorStats {
  total_errors: number;
  by_severity: Record<string, number>;
  by_type: Record<string, number>;
  by_module: Record<string, number>;
  recent_errors: number; // last 24h
}

export interface MonitoringFilters {
  severity?: string;
  errorType?: string;
  module?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  entityType?: string;
  action?: string;
}
