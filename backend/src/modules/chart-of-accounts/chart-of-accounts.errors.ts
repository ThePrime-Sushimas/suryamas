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
    `Chart of account not found${id ? ` (ID: ${id})` : ''}`,
    'CHART_OF_ACCOUNT_NOT_FOUND',
    404
  ),
  
  CODE_EXISTS: (code?: string, companyId?: string) => new ChartOfAccountError(
    `Account code already exists${code ? ` (Code: ${code})` : ''}${companyId ? ` for company ${companyId}` : ''}`,
    'ACCOUNT_CODE_EXISTS',
    409
  ),
  
  INVALID_PARENT: (parentId?: string, reason?: string) => new ChartOfAccountError(
    `Invalid parent account${parentId ? ` (ID: ${parentId})` : ''}${reason ? `: ${reason}` : ' or circular reference detected'}`,
    'INVALID_PARENT_ACCOUNT',
    400
  ),
  
  PARENT_COMPANY_MISMATCH: (parentCompany: string, childCompany: string) => new ChartOfAccountError(
    `Parent account company (${parentCompany}) does not match child account company (${childCompany})`,
    'PARENT_COMPANY_MISMATCH',
    400
  ),
  
  PARENT_MUST_BE_HEADER: (parentCode?: string) => new ChartOfAccountError(
    `Parent account${parentCode ? ` (${parentCode})` : ''} must be a header account`,
    'PARENT_MUST_BE_HEADER',
    400
  ),
  
  PARENT_TYPE_MISMATCH: (parentType: string, childType: string) => new ChartOfAccountError(
    `Parent account type (${parentType}) must match child account type (${childType})`,
    'PARENT_TYPE_MISMATCH',
    400
  ),
  
  HEADER_CANNOT_BE_POSTABLE: () => new ChartOfAccountError(
    'Header accounts cannot be postable',
    'HEADER_CANNOT_BE_POSTABLE',
    400
  ),
  
  INVALID_NORMAL_BALANCE: (accountType: string, normalBalance: string) => new ChartOfAccountError(
    `Invalid normal balance ${normalBalance} for account type ${accountType}`,
    'INVALID_NORMAL_BALANCE',
    400
  ),
  
  CANNOT_DELETE_WITH_CHILDREN: () => new ChartOfAccountError(
    'Cannot delete account that has child accounts',
    'CANNOT_DELETE_WITH_CHILDREN',
    400
  ),
  
  CANNOT_DELETE_WITH_TRANSACTIONS: (accountCode?: string) => new ChartOfAccountError(
    `Cannot delete account${accountCode ? ` (${accountCode})` : ''} that has transactions`,
    'CANNOT_DELETE_WITH_TRANSACTIONS',
    400
  ),
  
  COMPANY_ACCESS_DENIED: (companyId: string) => new ChartOfAccountError(
    `Access denied to company ${companyId}`,
    'COMPANY_ACCESS_DENIED',
    403
  ),
  
  MAX_HIERARCHY_LEVEL_EXCEEDED: (maxLevel: number) => new ChartOfAccountError(
    `Maximum hierarchy level of ${maxLevel} exceeded`,
    'MAX_HIERARCHY_LEVEL_EXCEEDED',
    400
  ),
  
  CREATE_FAILED: () => new ChartOfAccountError(
    'Failed to create chart of account',
    'CREATE_FAILED',
    500
  ),
  
  UPDATE_FAILED: () => new ChartOfAccountError(
    'Failed to update chart of account',
    'UPDATE_FAILED',
    500
  )
}