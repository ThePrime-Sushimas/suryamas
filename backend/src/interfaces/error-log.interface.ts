/**
 * Error Logging Interfaces
 * TypeScript interfaces untuk structured error logging
 */

export interface ErrorLogContext {
  requestId?: string;
  userId?: string;
  timestamp: string;
  method: string;
  path: string;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  userAgent?: string;
  ip?: string;
  correlationId?: string;
  sessionId?: string;
  [key: string]: unknown;
}

export interface StructuredErrorLog {
  level: 'error' | 'warn' | 'info' | 'debug';
  timestamp: string;
  environment: string;
  version?: string;
  service?: string;
  error: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
    category?: string;
    cause?: string;
  };
  request: {
    method: string;
    path: string;
    params: Record<string, unknown>;
    query: Record<string, unknown>;
    userAgent?: string;
    ip?: string;
    requestId?: string;
  };
  user?: {
    id: string;
    email?: string;
    role?: string;
  };
  correlation?: {
    id?: string;
    parentId?: string;
  };
  response?: {
    statusCode: number;
    duration?: number;
  };
  metadata?: Record<string, unknown>;
}

export interface ErrorMetrics {
  errorCount: number;
  errorRate: number;
  errorByCategory: Record<string, number>;
  errorByCode: Record<string, number>;
  lastErrorAt?: string;
  lastErrorCode?: string;
}

export interface ErrorAlert {
  error: StructuredErrorLog;
  threshold: number;
  currentCount: number;
  shouldAlert: boolean;
  alertChannels: string[];
}

export interface LogEntry {
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  timestamp?: string;
  [key: string]: unknown;
}

