/**
 * Error Context Utility
 * Context enrichment untuk error logging
 */

import { Request } from 'express';
import { randomUUID } from 'crypto';
import { ErrorLogContext, StructuredErrorLog } from '../interfaces/error-log.interface';
import { logError, logWarn, logInfo } from '../config/logger';
import { matchErrorPattern } from '../config/error-patterns.config';

/**
 * Generate UUID menggunakan crypto module (built-in Node.js)
 */
function generateUUID(): string {
  return randomUUID();
}

/**
 * Enrich error dengan request context
 */
export function enrichErrorContext(
  error: Error,
  req: Request,
  additionalContext?: Record<string, unknown>
): ErrorLogContext {
  return {
    timestamp: new Date().toISOString(),
    requestId: getRequestId(req) || generateUUID(),
    method: req.method,
    path: req.path,
    params: req.params as Record<string, unknown>,
    query: req.query as Record<string, unknown>,
    body: sanitizeBody(req.body),
    userAgent: req.get('user-agent') || undefined,
    ip: req.ip || req.socket.remoteAddress || undefined,
    userId: (req as any).user?.id,
    correlationId: (req as any).correlationId,
    sessionId: (req as any).sessionId,
    ...additionalContext,
  };
}

/**
 * Get request ID dari request object
 */
function getRequestId(req: Request): string | undefined {
  return (req as any).id || 
         (req.headers['x-request-id'] as string) ||
         (req.headers['x-correlation-id'] as string);
}

/**
 * Sanitize body untuk logging (hapus sensitive data)
 */
function sanitizeBody(body: unknown): Record<string, unknown> | undefined {
  if (!body || typeof body !== 'object') {
    return undefined;
  }

  const sanitized: Record<string, unknown> = {};
  const sensitiveFields = [
    'password', 'token', 'secret', 'api_key', 'authorization',
    'credit_card', 'card_number', 'cvv', 'pin'
  ];

  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeBody(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Create structured error log
 */
export function createStructuredErrorLog(
  error: Error,
  context: ErrorLogContext,
  statusCode: number
): StructuredErrorLog {
  const pattern = matchErrorPattern(error);
  
  return {
    level: statusCode >= 500 ? 'error' : 'warn',
    timestamp: context.timestamp,
    environment: process.env.NODE_ENV || 'development',
    version: process.env.APP_VERSION || '1.0.0',
    service: 'bank-reconciliation-api',
    error: {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
      code: (error as any).code || pattern?.code,
      category: pattern?.category,
      cause: (error as any).cause,
    },
    request: {
      method: context.method,
      path: context.path,
      params: context.params || {},
      query: context.query || {},
      userAgent: context.userAgent,
      ip: context.ip,
      requestId: context.requestId,
    },
    user: context.userId ? { id: context.userId } : undefined,
    correlation: {
      id: context.correlationId,
    },
    response: {
      statusCode,
    },
metadata: context,
  };
}

/**
 * Log structured error
 */
export function logStructuredError(
  error: Error,
  context: ErrorLogContext,
  statusCode: number
): void {
  const log = createStructuredErrorLog(error, context, statusCode);

  switch (log.level) {
    case 'error':
      logError(JSON.stringify(log));
      break;
    case 'warn':
      logWarn(JSON.stringify(log));
      break;
    case 'info':
      logInfo(JSON.stringify(log));
      break;
    default:
      logInfo(JSON.stringify(log));
  }
}

/**
 * Get error fingerprint untuk grouping similar errors
 */
export function getErrorFingerprint(error: Error): string {
  const pattern = matchErrorPattern(error);
  const code = (error as any).code || pattern?.code || 'UNKNOWN';
  const name = error.name;
  const category = pattern?.category || 'unknown';
  
  return `${category}:${code}:${name}`;
}

/**
 * Calculate error duration
 */
export function getErrorDuration(startTime: [number, number]): number {
  const [seconds, nanoseconds] = process.hrtime(startTime);
  return seconds * 1000 + Math.floor(nanoseconds / 1000000);
}
