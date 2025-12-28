export class CompanyError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'CompanyError'
  }
}

export const CompanyErrors = {
  NOT_FOUND: () => new CompanyError('COMPANY_NOT_FOUND', 'Company not found', 404),
  CODE_EXISTS: () => new CompanyError('COMPANY_CODE_EXISTS', 'Company code already exists', 409),
  NPWP_EXISTS: () => new CompanyError('NPWP_EXISTS', 'NPWP already registered', 409),
  INVALID_TYPE: (types: string[]) => new CompanyError('INVALID_TYPE', `Invalid company type. Must be one of: ${types.join(', ')}`, 400),
  INVALID_STATUS: (statuses: string[]) => new CompanyError('INVALID_STATUS', `Invalid status. Must be one of: ${statuses.join(', ')}`, 400),
  INVALID_EMAIL: () => new CompanyError('INVALID_EMAIL', 'Invalid email format', 400),
  INVALID_PHONE: () => new CompanyError('INVALID_PHONE', 'Invalid phone format', 400),
  INVALID_URL: () => new CompanyError('INVALID_URL', 'Invalid website URL format', 400),
  REQUIRED_FIELD: (field: string) => new CompanyError('REQUIRED_FIELD', `${field} is required`, 400),
  CREATE_FAILED: () => new CompanyError('CREATE_FAILED', 'Failed to create company', 500),
  UPDATE_FAILED: () => new CompanyError('UPDATE_FAILED', 'Failed to update company', 500),
}
