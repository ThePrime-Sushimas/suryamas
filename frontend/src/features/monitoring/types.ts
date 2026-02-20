/**
 * Monitoring Module Types
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
  user_email?: string;
  branch_id?: string;
  branch_name?: string;
  url: string;
  route: string;
  user_agent: string;
  business_impact?: string;
  context?: Record<string, any>;
  created_at: string;
}

export interface AuditLogRecord {
  id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  user_id?: string;
  user_email?: string;
  branch_id?: string;
  branch_name?: string;
  reason?: string;
  context?: Record<string, any>;
  metadata?: Record<string, any>;
  old_value?: any;
  new_value?: any;
  created_at: string;
}

export interface ErrorStats {
  total_errors: number;
  by_severity: Record<ErrorSeverity, number>;
  by_type: Record<ErrorType, number>;
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
