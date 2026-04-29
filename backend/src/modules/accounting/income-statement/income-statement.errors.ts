import { AppError } from '../../../utils/errors.base'

export class IncomeStatementQueryError extends AppError {
  constructor(message: string) {
    super(message, 500, 'INCOME_STATEMENT_QUERY_ERROR')
  }
}
