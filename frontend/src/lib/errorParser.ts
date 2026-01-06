/**
 * Parse API error response to extract user-friendly error message
 * @param err - Unknown error object from catch block
 * @param fallbackMessage - Fallback message if error cannot be parsed
 * @returns User-friendly error message
 */
export function parseApiError(err: unknown, fallbackMessage: string): string {
  // Check for Axios error response
  if (err && typeof err === 'object' && 'response' in err) {
    const axiosError = err as { response?: { data?: { error?: string } } }
    return axiosError.response?.data?.error || fallbackMessage
  }
  // Check for standard Error instance
  if (err instanceof Error) {
    return err.message
  }
  return fallbackMessage
}
