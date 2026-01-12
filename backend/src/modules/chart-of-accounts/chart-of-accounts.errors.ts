export class ChartOfAccountError extends Error {
  public readonly code: string
  public readonly statusCode: number

  constructor(message: string, code: string, statusCode: number = 400) {
    super(message)
    this.name = 'ChartOfAccountError'
    this.code = code
    this.statusCode = statusCode
  }
}

export const ChartOfAccountErrors = {
  NOT_FOUND: (id?: string) => new ChartOfAccountError(
    'Account not found',
    'CHART_OF_ACCOUNT_NOT_FOUND',
    404
  ),
  
  CODE_EXISTS: (code?: string, companyId?: string) => new ChartOfAccountError(
    `Account code '${code}' already exists. Please use a different code.`,
    'ACCOUNT_CODE_EXISTS',
    409
  ),
  
  INVALID_PARENT: (parentId?: string, reason?: string) => new ChartOfAccountError(
    reason === 'Parent account not found' ? 'Selected parent account is not available' :
    reason === 'Cannot set self as parent' ? 'An account cannot be its own parent' :
    reason === 'Circular reference detected' ? 'This would create a circular reference in the account hierarchy' :
    'Invalid parent account selected',
    'INVALID_PARENT_ACCOUNT',
    400
  ),
  
  PARENT_COMPANY_MISMATCH: (parentCompany: string, childCompany: string) => new ChartOfAccountError(
    'Parent account must belong to the same company',
    'PARENT_COMPANY_MISMATCH',
    400
  ),
  
  PARENT_MUST_BE_HEADER: (parentCode?: string) => new ChartOfAccountError(
    'Only header accounts can have child accounts',
    'PARENT_MUST_BE_HEADER',
    400
  ),
  
  PARENT_TYPE_MISMATCH: (parentType: string, childType: string) => new ChartOfAccountError(
    'Parent and child accounts must have the same account type',
    'PARENT_TYPE_MISMATCH',
    400
  ),
  
  HEADER_CANNOT_BE_POSTABLE: () => new ChartOfAccountError(
    'Header accounts cannot be used for transactions',
    'HEADER_CANNOT_BE_POSTABLE',
    400
  ),
  
  INVALID_NORMAL_BALANCE: (accountType: string, normalBalance: string) => new ChartOfAccountError(
    `${accountType} accounts must have ${accountType === 'ASSET' || accountType === 'EXPENSE' ? 'DEBIT' : 'CREDIT'} normal balance`,
    'INVALID_NORMAL_BALANCE',
    400
  ),
  
  CANNOT_DELETE_WITH_CHILDREN: () => new ChartOfAccountError(
    'Cannot delete account that has child accounts. Delete child accounts first.',
    'CANNOT_DELETE_WITH_CHILDREN',
    400
  ),
  
  CANNOT_DELETE_WITH_TRANSACTIONS: (accountCode?: string) => new ChartOfAccountError(
    'Cannot delete account that has been used in transactions',
    'CANNOT_DELETE_WITH_TRANSACTIONS',
    400
  ),
  
  COMPANY_ACCESS_DENIED: (companyId: string) => new ChartOfAccountError(
    'You do not have permission to access this company data',
    'COMPANY_ACCESS_DENIED',
    403
  ),
  
  MAX_HIERARCHY_LEVEL_EXCEEDED: (maxLevel: number) => new ChartOfAccountError(
    `Account hierarchy cannot exceed ${maxLevel} levels`,
    'MAX_HIERARCHY_LEVEL_EXCEEDED',
    400
  ),
  
  CREATE_FAILED: () => new ChartOfAccountError(
    'Unable to create account. Please try again.',
    'CREATE_FAILED',
    500
  ),
  
  UPDATE_FAILED: () => new ChartOfAccountError(
    'Unable to update account. Please try again.',
    'UPDATE_FAILED',
    500
  )
}