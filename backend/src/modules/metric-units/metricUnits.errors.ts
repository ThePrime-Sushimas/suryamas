export class MetricUnitError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message)
    this.name = 'MetricUnitError'
  }
}

export class MetricUnitNotFoundError extends MetricUnitError {
  constructor(id: string) {
    super(`Metric unit not found: ${id}`, 404, 'METRIC_UNIT_NOT_FOUND')
  }
}

export class DuplicateMetricUnitError extends MetricUnitError {
  constructor(metricType?: string, unitName?: string) {
    const detail = metricType && unitName ? `: ${metricType} - ${unitName}` : ''
    super(`Duplicate metric_type and unit_name combination${detail}`, 409, 'DUPLICATE_METRIC_UNIT')
  }
}

export class InvalidMetricUnitError extends MetricUnitError {
  constructor(message: string) {
    super(message, 400, 'INVALID_METRIC_UNIT')
  }
}
