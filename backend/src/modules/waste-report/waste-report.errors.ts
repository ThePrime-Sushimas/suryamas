import { BusinessRuleError } from '../../utils/errors.base'

export class WasteReportError extends BusinessRuleError {
  constructor(message: string) {
    super(message)
  }
}
