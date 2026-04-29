import { AppError } from '../../../utils/errors.base'

export class BalanceSheetQueryError extends AppError {
  constructor(message: string) {
    super(message, 500, 'BALANCE_SHEET_QUERY_ERROR')
  }
}
