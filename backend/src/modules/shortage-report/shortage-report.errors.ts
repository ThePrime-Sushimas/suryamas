import { BusinessRuleError } from '../../utils/errors.base'

export class ShortageReportError extends BusinessRuleError {
  constructor(message: string) {
    super(message)
  }
}
