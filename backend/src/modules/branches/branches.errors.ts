export class BranchError extends Error {
    constructor(
      public code: string,
      message: string,
      public statusCode: number = 400
    ) {
      super(message)
      this.name = 'BranchError'
    }
  }
  
  export const BranchErrors = {
    NOT_FOUND: () => new BranchError('BRANCH_NOT_FOUND', 'Branch not found', 404),
    CODE_EXISTS: () => new BranchError('BRANCH_CODE_EXISTS', 'Branch code already exists', 409),
    INVALID_STATUS: (status: string) => new BranchError('INVALID_STATUS', `Invalid status: ${status}`, 400),
    INVALID_EMAIL: () => new BranchError('INVALID_EMAIL', 'Invalid email format', 400),
    INVALID_PHONE: () => new BranchError('INVALID_PHONE', 'Invalid phone format', 400),
    INVALID_COORDINATES: () => new BranchError('INVALID_COORDINATES', 'Invalid coordinates', 400),
  }
  