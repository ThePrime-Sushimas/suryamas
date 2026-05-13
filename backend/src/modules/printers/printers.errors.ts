import { NotFoundError, ExternalServiceError, ConflictError } from '../../utils/errors.base'

export class PrinterNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('printer', id)
  }
}

export class PrinterConnectionError extends ExternalServiceError {
  constructor(ip: string, port: number, reason?: string) {
    super('printer', `Cannot connect to printer at ${ip}:${port}${reason ? ` - ${reason}` : ''}`)
  }
}

export class PrinterDuplicateError extends ConflictError {
  constructor(name: string) {
    super(`Printer "${name}" already exists`)
  }
}
