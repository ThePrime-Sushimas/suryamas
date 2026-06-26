export type BcaHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export const BCA_ENDPOINTS = {
  ACCESS_TOKEN: '/openapi/v1.0/access-token/b2b',
  BANK_STATEMENT: '/openapi/v1.0/bank-statement',
} as const

export function isBcaSuccessResponse(responseCode: string): boolean {
  return responseCode.startsWith('200')
}

export function isBcaTokenExpiredResponse(responseCode: string): boolean {
  return /^401\d{2}01$/.test(responseCode)
}

export function isBcaSignatureErrorResponse(responseCode: string): boolean {
  return /^401\d{2}00$/.test(responseCode)
}
