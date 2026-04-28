import { BusinessRuleError, NotFoundError } from '../../utils/error-handler.util'

export const AuthErrors = {
  EMPLOYEE_NOT_FOUND: () => new NotFoundError('Employee not found'),
  EMPLOYEE_ALREADY_HAS_ACCOUNT: () => new BusinessRuleError('Employee already has an account'),
  EMPLOYEE_RESIGNED: () => new BusinessRuleError('Cannot register resigned employee'),
  USER_ALREADY_EXISTS: () => new BusinessRuleError('User already registered'),
  INVALID_CREDENTIALS: () => new BusinessRuleError('Invalid credentials'),
  ACCOUNT_DEACTIVATED: () => new BusinessRuleError('Account has been deactivated'),
  RECOVERY_TOKEN_REQUIRED: () => new BusinessRuleError('Recovery token is required'),
  INVALID_RECOVERY_TOKEN: () => new BusinessRuleError('Invalid or expired recovery token'),
}
