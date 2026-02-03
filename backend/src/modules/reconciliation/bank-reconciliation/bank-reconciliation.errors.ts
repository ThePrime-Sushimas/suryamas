/**
 * Custom error classes for the Bank Reconciliation module
 */

export class ReconciliationError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'ReconciliationError';
  }
}

export class AlreadyReconciledError extends ReconciliationError {
  constructor(statementId: string) {
    super(`Statement ${statementId} is already reconciled`, 'ALREADY_RECONCILED');
  }
}

export class DifferenceThresholdExceededError extends ReconciliationError {
  constructor(amount: number, threshold: number) {
    super(
      `Amount difference ${amount} exceeds threshold ${threshold}`,
      'DIFFERENCE_THRESHOLD_EXCEEDED'
    );
  }
}

export class NoMatchFoundError extends ReconciliationError {
  constructor(statementId: string) {
    super(`No match found for statement ${statementId}`, 'NO_MATCH_FOUND');
  }
}

/**
 * Error when fetching statement from database fails
 * Provides more informative message than generic "fetch failed"
 */
export class FetchStatementError extends ReconciliationError {
  constructor(statementId: string, reason?: string) {
    const message = reason 
      ? `Gagal mengambil statement ${statementId}: ${reason}`
      : `Gagal mengambil statement ${statementId}. Silakan coba lagi atau hubungi administrator jika masalah berlanjut.`;
    super(message, 'FETCH_STATEMENT_FAILED');
    this.name = 'FetchStatementError';
  }
}

/**
 * Error when statement is not found
 */
export class StatementNotFoundError extends ReconciliationError {
  constructor(statementId: string) {
    super(`Statement dengan ID ${statementId} tidak ditemukan`, 'STATEMENT_NOT_FOUND');
    this.name = 'StatementNotFoundError';
  }
}

/**
 * Error when database connection fails
 */
export class DatabaseConnectionError extends ReconciliationError {
  constructor(operation: string, reason?: string) {
    const message = reason
      ? `Database connection error saat ${operation}: ${reason}`
      : `Gagal terhubung ke database saat ${operation}. Silakan coba lagi.`;
    super(message, 'DATABASE_CONNECTION_ERROR');
    this.name = 'DatabaseConnectionError';
  }
}

/**
 * Helper function to handle Supabase errors and convert to appropriate error types
 */
export function handleSupabaseError(
  error: any,
  context: {
    operation: string;
    entityId?: string;
    entityType?: string;
  }
): never {
  // Check for network/fetch errors
  if (error.message?.includes('fetch') || error.code === 'FETCH_FAILED') {
    throw new FetchStatementError(
      context.entityId || 'unknown',
      'Koneksi ke database terputus. Periksa koneksi internet Anda.'
    );
  }

  // Check for PostgreSQL errors
  if (error.code === 'PGRST116') {
    // Record not found
    if (context.entityType === 'statement') {
      throw new StatementNotFoundError(context.entityId || 'unknown');
    }
  }

  // Check for connection errors
  if (error.message?.includes('connection') || error.code === 'ECONNREFUSED') {
    throw new DatabaseConnectionError(
      context.operation,
      'Tidak dapat terhubung ke database server.'
    );
  }

  // Default error
  throw new ReconciliationError(
    `${context.operation} gagal: ${error.message || 'Unknown error'}`,
    context.entityType === 'statement' ? 'STATEMENT_OPERATION_FAILED' : 'RECONCILIATION_FAILED'
  );
}

