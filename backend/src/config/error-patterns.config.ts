/**
 * Error Patterns Configuration
 * Regex-based patterns untuk PostgreSQL dan error messages
 */

export enum ErrorCategory {
  VALIDATION = 'validation',
  DATABASE = 'database',
  BUSINESS_RULE = 'business_rule',
  NOT_FOUND = 'not_found',
  CONFLICT = 'conflict',
  PERMISSION = 'permission',
  AUTHENTICATION = 'authentication',
  EXTERNAL_SERVICE = 'external_service',
  SYSTEM = 'system',
}

export interface ErrorPattern {
  pattern: RegExp;
  message: string;
  code: string;
  statusCode: number;
  category: ErrorCategory;
  logLevel?: 'error' | 'warn' | 'info';
}

export const ERROR_PATTERNS: ErrorPattern[] = [
  // ============ POSTGRESQL ERRORS ============
  
  // Unique constraint violation (PostgreSQL code 23505)
  {
    pattern: /23505|unique constraint|duplicate key|UQ_|duplicate entry/i,
    message: 'This record already exists',
    code: 'UNIQUE_CONSTRAINT_VIOLATION',
    statusCode: 409,
    category: ErrorCategory.CONFLICT,
    logLevel: 'warn',
  },

  // Foreign key violation (PostgreSQL code 23503)
  {
    pattern: /23503|foreign key|FK_|violates foreign key constraint|referenced record does not exist/i,
    message: 'Cannot complete this action because related records exist',
    code: 'FOREIGN_KEY_VIOLATION',
    statusCode: 404,
    category: ErrorCategory.DATABASE,
    logLevel: 'warn',
  },

  // Check constraint violation (PostgreSQL code 23514)
  {
    pattern: /23514|check constraint|violates check constraint/i,
    message: 'Invalid data provided',
    code: 'CHECK_CONSTRAINT_VIOLATION',
    statusCode: 400,
    category: ErrorCategory.VALIDATION,
    logLevel: 'warn',
  },

  // Not null violation (PostgreSQL code 23502)
  {
    pattern: /23502|null value|not-null constraint/i,
    message: 'Required data is missing',
    code: 'NOT_NULL_VIOLATION',
    statusCode: 400,
    category: ErrorCategory.VALIDATION,
    logLevel: 'warn',
  },

  // Exclusion violation (PostgreSQL code 23P01)
  {
    pattern: /23P01|exclusion constraint/i,
    message: 'This operation conflicts with existing data',
    code: 'EXCLUSION_VIOLATION',
    statusCode: 409,
    category: ErrorCategory.CONFLICT,
    logLevel: 'warn',
  },

  // ============ CONNECTION ERRORS ============
  {
    pattern: /connection.*failed|econnrefused|ECONNREFUSED|database.*unavailable|unable to connect/i,
    message: 'Unable to connect to database. Please try again later',
    code: 'DATABASE_CONNECTION_ERROR',
    statusCode: 503,
    category: ErrorCategory.EXTERNAL_SERVICE,
    logLevel: 'error',
  },

  {
    pattern: /connection.*timeout|ECONNTIMEOUT|ETIMEDOUT/i,
    message: 'Connection timed out. Please try again',
    code: 'CONNECTION_TIMEOUT',
    statusCode: 408,
    category: ErrorCategory.EXTERNAL_SERVICE,
    logLevel: 'warn',
  },

  // ============ QUERY ERRORS ============
  {
    pattern: /query.*failed|database query/i,
    message: 'Unable to process your request. Please try again',
    code: 'QUERY_FAILED',
    statusCode: 500,
    category: ErrorCategory.DATABASE,
    logLevel: 'error',
  },

  {
    pattern: /insert.*failed|database insert/i,
    message: 'Failed to create record. Please try again',
    code: 'INSERT_FAILED',
    statusCode: 500,
    category: ErrorCategory.DATABASE,
    logLevel: 'error',
  },

  {
    pattern: /update.*failed|database update/i,
    message: 'Failed to update record. Please try again',
    code: 'UPDATE_FAILED',
    statusCode: 500,
    category: ErrorCategory.DATABASE,
    logLevel: 'error',
  },

  {
    pattern: /delete.*failed|database delete|bulk delete/i,
    message: 'Failed to delete record. Please try again',
    code: 'DELETE_FAILED',
    statusCode: 500,
    category: ErrorCategory.DATABASE,
    logLevel: 'error',
  },

  {
    pattern: /restore.*failed|bulk restore/i,
    message: 'Failed to restore record. Please try again',
    code: 'RESTORE_FAILED',
    statusCode: 500,
    category: ErrorCategory.DATABASE,
    logLevel: 'error',
  },

  {
    pattern: /count.*failed|count query/i,
    message: 'Unable to load data. Please try again',
    code: 'COUNT_QUERY_FAILED',
    statusCode: 500,
    category: ErrorCategory.DATABASE,
    logLevel: 'warn',
  },

  // ============ PERMISSION ERRORS ============
  {
    pattern: /permission denied|access denied|unauthorized|not authorized/i,
    message: 'You do not have permission to perform this action',
    code: 'PERMISSION_DENIED',
    statusCode: 403,
    category: ErrorCategory.PERMISSION,
    logLevel: 'warn',
  },

  // ============ AUTHENTICATION ERRORS ============
  {
    pattern: /jwt|token.*invalid|authentication required|not authenticated/i,
    message: 'Authentication required. Please log in again',
    code: 'AUTHENTICATION_ERROR',
    statusCode: 401,
    category: ErrorCategory.AUTHENTICATION,
    logLevel: 'warn',
  },

  // ============ NOT FOUND ERRORS ============
  {
    pattern: /not found|does not exist|record not found/i,
    message: 'The requested resource was not found',
    code: 'NOT_FOUND',
    statusCode: 404,
    category: ErrorCategory.NOT_FOUND,
    logLevel: 'warn',
  },

  // ============ BUSINESS RULE ERRORS ============
  {
    pattern: /business rule|invalid status|cannot be modified|status transition/i,
    message: 'This operation is not allowed based on current state',
    code: 'BUSINESS_RULE_VIOLATION',
    statusCode: 422,
    category: ErrorCategory.BUSINESS_RULE,
    logLevel: 'warn',
  },

  // ============ VALIDATION ERRORS ============
  {
    pattern: /invalid|validation|malformed|incorrect format/i,
    message: 'Invalid data provided. Please check your input',
    code: 'VALIDATION_ERROR',
    statusCode: 400,
    category: ErrorCategory.VALIDATION,
    logLevel: 'warn',
  },

  // ============ NETWORK ERRORS ============
  {
    pattern: /network|net::|fetch error|cors/i,
    message: 'Network error. Please check your connection',
    code: 'NETWORK_ERROR',
    statusCode: 503,
    category: ErrorCategory.EXTERNAL_SERVICE,
    logLevel: 'error',
  },
];

/**
 * Find matching error pattern
 */
export function matchErrorPattern(error: Error): ErrorPattern | null {
  for (const pattern of ERROR_PATTERNS) {
    if (pattern.pattern.test(error.message)) {
      return pattern;
    }
  }
  return null;
}

/**
 * Get user-friendly message untuk error
 */
export function getUserFriendlyMessage(error: Error): string {
  const match = matchErrorPattern(error);
  return match?.message || 'An error occurred. Please try again';
}

/**
 * Get status code untuk error
 */
export function getErrorStatusCode(error: Error): number {
  const match = matchErrorPattern(error);
  return match?.statusCode || 500;
}

/**
 * Get category untuk error
 */
export function getErrorCategory(error: Error): ErrorCategory {
  const match = matchErrorPattern(error);
  return match?.category || ErrorCategory.SYSTEM;
}

/**
 * Get log level untuk error
 */
export function getErrorLogLevel(error: Error): 'error' | 'warn' | 'info' {
  const match = matchErrorPattern(error);
  return match?.logLevel || 'error';
}

