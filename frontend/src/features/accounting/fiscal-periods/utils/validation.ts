import { PERIOD_FORMAT_REGEX } from '../constants/fiscal-period.constants'

export function validatePeriodFormat(period: string): boolean {
  return PERIOD_FORMAT_REGEX.test(period)
}

export function validateDateRange(startDate: string, endDate: string): boolean {
  return new Date(startDate) <= new Date(endDate)
}

export function formatPeriod(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function getPeriodFromDate(date: string): string {
  return date.substring(0, 7)
}
