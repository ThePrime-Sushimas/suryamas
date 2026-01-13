// accounting-purpose-accounts.errors.ts

export class AccountingPurposeAccountError extends Error {
  public readonly code: string
  public readonly statusCode: number

  constructor(message: string, code: string, statusCode: number = 400) {
    super(message)
    this.name = 'AccountingPurposeAccountError'
    this.code = code
    this.statusCode = statusCode
  }
}

export const AccountingPurposeAccountErrors = {
  NOT_FOUND: (id?: string) => new AccountingPurposeAccountError(
    'Purpose account mapping not found',
    'PURPOSE_ACCOUNT_NOT_FOUND',
    404
  ),

  PURPOSE_NOT_FOUND: (purposeId: string) => new AccountingPurposeAccountError(
    'Accounting purpose not found',
    'PURPOSE_NOT_FOUND',
    404
  ),

  ACCOUNT_NOT_FOUND: (accountId: string) => new AccountingPurposeAccountError(
    'Chart of account not found',
    'ACCOUNT_NOT_FOUND',
    404
  ),

  ACCOUNT_NOT_POSTABLE: (accountCode: string) => new AccountingPurposeAccountError(
    `Account '${accountCode}' is not postable and cannot be used for transactions`,
    'ACCOUNT_NOT_POSTABLE',
    400
  ),

  DUPLICATE_MAPPING: (purposeId: string, accountId: string, side: string) => new AccountingPurposeAccountError(
    'This account is already mapped to this purpose with the same side',
    'DUPLICATE_MAPPING',
    409
  ),

  INVALID_BALANCE_SIDE: (accountType: string, normalBalance: string, side: string) => new AccountingPurposeAccountError(
    `${accountType} accounts with ${normalBalance} normal balance cannot be mapped to ${side} side`,
    'INVALID_BALANCE_SIDE',
    400
  ),

  COMPANY_ACCESS_DENIED: (companyId: string) => new AccountingPurposeAccountError(
    'You do not have permission to access this company data',
    'COMPANY_ACCESS_DENIED',
    403
  ),

  CREATE_FAILED: () => new AccountingPurposeAccountError(
    'Unable to create purpose account mapping. Please try again.',
    'CREATE_FAILED',
    500
  ),

  UPDATE_FAILED: () => new AccountingPurposeAccountError(
    'Unable to update purpose account mapping. Please try again.',
    'UPDATE_FAILED',
    500
  ),

  BULK_OPERATION_FAILED: (operation: string) => new AccountingPurposeAccountError(
    `Bulk ${operation} operation failed. Please try again.`,
    'BULK_OPERATION_FAILED',
    500
  ),
}
