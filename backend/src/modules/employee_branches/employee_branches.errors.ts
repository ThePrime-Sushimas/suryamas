export class EmployeeBranchError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number
  ) {
    super(message)
    this.name = 'EmployeeBranchError'
  }
}

export const EmployeeBranchErrors = {
  NOT_FOUND: () =>
    new EmployeeBranchError(
      'EMPLOYEE_BRANCH_NOT_FOUND',
      'Employee branch assignment not found',
      404
    ),

  ALREADY_EXISTS: () =>
    new EmployeeBranchError(
      'EMPLOYEE_BRANCH_EXISTS',
      'Employee is already assigned to this branch',
      409
    ),

  EMPLOYEE_NOT_FOUND: () =>
    new EmployeeBranchError(
      'EMPLOYEE_NOT_FOUND',
      'Employee not found',
      404
    ),

  BRANCH_NOT_FOUND: () =>
    new EmployeeBranchError(
      'BRANCH_NOT_FOUND',
      'Branch not found',
      404
    ),

  CANNOT_DELETE_PRIMARY: () =>
    new EmployeeBranchError(
      'CANNOT_DELETE_PRIMARY',
      'Cannot delete primary branch assignment. Set another branch as primary first',
      400
    ),

  NO_ASSIGNMENT: () =>
    new EmployeeBranchError(
      'NO_BRANCH_ASSIGNMENT',
      'Employee is not assigned to this branch',
      404
    ),
}
