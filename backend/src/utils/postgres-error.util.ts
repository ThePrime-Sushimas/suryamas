/**
 * Safely check if an unknown error is a PostgreSQL error with a specific code.
 * Handles null, string, non-object errors gracefully.
 */
export function isPostgresError(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: unknown }).code === code
}
