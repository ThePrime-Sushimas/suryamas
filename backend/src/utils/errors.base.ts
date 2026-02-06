/**
 * Base Error Classes
 * Base error classes yang digunakan oleh seluruh aplikasi
 */

// ============================================================================
// ERROR CATEGORIES
// ============================================================================

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

// ============================================================================
// ERROR RESPONSE INTERFACE
// ============================================================================

export interface ErrorResponse {
  message: string;
  statusCode: number;
  code: string;
  category: ErrorCategory;
  details?: Record<string, unknown>;
  context?: Record<string, unknown>;
}

// ============================================================================
// BASE ERROR CLASS
// ============================================================================

export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly context?: Record<string, unknown> & { [key: string]: unknown },
    public readonly cause?: Error,
    public readonly category: ErrorCategory = ErrorCategory.SYSTEM
  ) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }

  /**
   * Convert error to response format
   */
  toResponse(): ErrorResponse {
    return {
      message: this.message,
      statusCode: this.statusCode,
      code: this.code,
      category: this.category,
      details: this.context,
    }
  }

  /**
   * Get user-friendly message
   */
  getUserMessage(): string {
    return this.message
  }

  /**
   * Check if error is operational (expected error)
   */
  isOperational(): boolean {
    return this.category !== ErrorCategory.SYSTEM
  }
}

// ============================================================================
// DOMAIN ERROR CLASSES
// ============================================================================

export class DatabaseError extends AppError {
  constructor(
    message: string,
    options?: { 
      cause?: Error; 
      context?: Record<string, unknown>;
      code?: string;
    }
  ) {
    super(
      message,
      500,
      options?.code || 'DATABASE_ERROR',
      options?.context,
      options?.cause,
      ErrorCategory.DATABASE
    )
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    context?: { [key: string]: unknown }
  ) {
    super(
      message,
      400,
      'VALIDATION_ERROR',
      context,
      undefined,
      ErrorCategory.VALIDATION
    )
  }

  /**
   * Add field validation error
   */
  addFieldError(field: string, message: string): ValidationError {
    const fieldErrors = (this.context?.fieldErrors as Record<string, string[]>) || {}
    fieldErrors[field] = [...(fieldErrors[field] || []), message]
    
    return new ValidationError(this.message, { ...this.context, fieldErrors })
  }
}

export class NotFoundError extends AppError {
  constructor(
    resource: string,
    contextOrId?: { [key: string]: unknown } | string | number
  ) {
    let context: Record<string, unknown> = { resource }
    
    if (typeof contextOrId === 'string' || typeof contextOrId === 'number') {
      context = { resource, resourceId: String(contextOrId) }
    } else if (contextOrId) {
      context = { resource, ...contextOrId }
    }
    
    super(
      `${resource} not found`,
      404,
      'NOT_FOUND',
      context,
      undefined,
      ErrorCategory.NOT_FOUND
    )
  }
}

export class ConflictError extends AppError {
  constructor(
    message: string,
    contextOrConflictType?: { [key: string]: unknown } | 'duplicate' | 'concurrency' | 'dependency'
  ) {
    let context: Record<string, unknown> = { conflictType: 'duplicate' }
    
    if (typeof contextOrConflictType === 'string') {
      context = { conflictType: contextOrConflictType }
    } else if (contextOrConflictType) {
      context = { ...contextOrConflictType, conflictType: contextOrConflictType.conflictType || 'duplicate' }
    }
    
    super(
      message,
      409,
      'CONFLICT',
      context,
      undefined,
      ErrorCategory.CONFLICT
    )
  }

  /**
   * Create duplicate conflict error
   */
  static duplicate(resource: string, field: string, value: string): ConflictError {
    return new ConflictError(
      `${resource} with ${field} '${value}' already exists`,
      { conflictType: 'duplicate', resource, field, value }
    )
  }
}

export class BusinessRuleError extends AppError {
  constructor(
    message: string,
    context?: { [key: string]: unknown }
  ) {
    super(
      message,
      422,
      'BUSINESS_RULE_VIOLATION',
      context,
      undefined,
      ErrorCategory.BUSINESS_RULE
    )
  }

  /**
   * Create invalid status transition error
   */
  static invalidStatusTransition(
    resource: string,
    currentStatus: string,
    targetStatus: string
  ): BusinessRuleError {
    return new BusinessRuleError(
      `Cannot transition ${resource} from '${currentStatus}' to '${targetStatus}'`,
      { rule: 'status_transition', currentState: currentStatus, targetState: targetStatus, resource }
    )
  }
}

export class PermissionError extends AppError {
  constructor(
    message: string = 'You do not have permission to perform this action',
    options?: {
      context?: Record<string, unknown>;
      permission?: string;
      resource?: string;
      resourceId?: string;
    }
  ) {
    super(
      message,
      403,
      'PERMISSION_DENIED',
      { permission: options?.permission, resource: options?.resource, resourceId: options?.resourceId, ...options?.context },
      undefined,
      ErrorCategory.PERMISSION
    )
  }

  /**
   * Create permission denied for specific action
   */
  static require(permission: string, resource?: string): PermissionError {
    return new PermissionError(
      `Permission '${permission}' is required`,
      { permission, resource }
    )
  }
}

export class AuthenticationError extends AppError {
  constructor(
    message: string = 'Authentication required',
    options?: {
      context?: Record<string, unknown>;
      authType?: 'jwt' | 'session' | 'api_key';
    }
  ) {
    super(
      message,
      401,
      'AUTHENTICATION_ERROR',
      { authType: options?.authType || 'jwt', ...options?.context },
      undefined,
      ErrorCategory.AUTHENTICATION
    )
  }

  /**
   * Create token expired error
   */
  static tokenExpired(): AuthenticationError {
    return new AuthenticationError('Token has expired', {
      authType: 'jwt',
      context: { reason: 'expired' }
    })
  }

  /**
   * Create invalid token error
   */
  static invalidToken(): AuthenticationError {
    return new AuthenticationError('Invalid token', {
      authType: 'jwt',
      context: { reason: 'invalid' }
    })
  }
}

export class ExternalServiceError extends AppError {
  constructor(
    service: string,
    message: string,
    options?: {
      context?: Record<string, unknown>;
      cause?: Error;
      retryable?: boolean;
    }
  ) {
    super(
      message,
      503,
      `EXTERNAL_SERVICE_ERROR_${service.toUpperCase()}`,
      { service, retryable: options?.retryable ?? true, ...options?.context },
      options?.cause,
      ErrorCategory.EXTERNAL_SERVICE
    )
  }

  /**
   * Create timeout error for external service
   */
  static timeout(service: string, duration?: number): ExternalServiceError {
    return new ExternalServiceError(
      service,
      `${service} request timed out`,
      { context: { timeoutDuration: duration } }
    )
  }

  /**
   * Create unavailable error for external service
   */
  static unavailable(service: string): ExternalServiceError {
    return new ExternalServiceError(
      service,
      `${service} is temporarily unavailable`,
      { retryable: true }
    )
  }
}

// ============================================================================
// ERROR UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if error is operational (expected)
 */
export function isOperationalError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.isOperational()
  }
  return false
}

/**
 * Get error category from error
 */
export function getErrorCategory(error: unknown): ErrorCategory {
  if (error instanceof AppError) {
    return error.category
  }
  return ErrorCategory.SYSTEM
}

/**
 * Wrap non-AppError dalam AppError
 */
export function wrapError(
  error: Error,
  statusCode: number = 500,
  code: string = 'INTERNAL_ERROR',
  category: ErrorCategory = ErrorCategory.SYSTEM
): AppError {
  return new AppError(
    error.message,
    statusCode,
    code,
    { originalError: error.message },
    error,
    category
  )
}

/**
 * Create error response dari error
 */
export function toErrorResponse(error: unknown): ErrorResponse {
  if (error instanceof AppError) {
    return error.toResponse()
  }
  
  if (error instanceof Error) {
    return {
      message: error.message || 'An unexpected error occurred',
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      category: ErrorCategory.SYSTEM,
    }
  }
  
  return {
    message: 'An unexpected error occurred',
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    category: ErrorCategory.SYSTEM,
  }
}

