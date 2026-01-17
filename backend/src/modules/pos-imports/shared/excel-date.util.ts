/**
 * Excel Date Parsing Utilities
 * Handles Excel serial dates and string dates without timezone issues
 */

/**
 * Convert Excel serial number to local date string (YYYY-MM-DD)
 * Excel stores dates as days since 1900-01-01
 */
export function excelSerialToLocalDate(serial: number): string {
  // Excel epoch: 1900-01-01 (but Excel incorrectly treats 1900 as leap year)
  const excelEpoch = new Date(Date.UTC(1899, 11, 30))
  const days = Math.floor(serial)
  const milliseconds = days * 24 * 60 * 60 * 1000
  const date = new Date(excelEpoch.getTime() + milliseconds)
  
  // Get local date components (no timezone conversion)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  
  return `${year}-${month}-${day}`
}

/**
 * Convert Excel serial number to local datetime string (ISO format)
 */
export function excelSerialToLocalDateTime(serial: number): string {
  const excelEpoch = new Date(Date.UTC(1899, 11, 30))
  const milliseconds = serial * 24 * 60 * 60 * 1000
  const date = new Date(excelEpoch.getTime() + milliseconds)
  
  // Format as local datetime without 'Z' suffix
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  const seconds = String(date.getUTCSeconds()).padStart(2, '0')
  const ms = String(date.getUTCMilliseconds()).padStart(3, '0')
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`
}

/**
 * Parse any date value (Excel serial, Date object, or string) to local date string
 */
export function parseToLocalDate(value: unknown): string {
  if (typeof value === 'number') {
    return excelSerialToLocalDate(value)
  }
  if (value instanceof Date) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  // String date - parse and format
  const date = new Date(value as string)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Parse any datetime value to local datetime string
 */
export function parseToLocalDateTime(value: unknown): string {
  if (typeof value === 'number') {
    return excelSerialToLocalDateTime(value)
  }
  if (value instanceof Date) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    const hours = String(value.getHours()).padStart(2, '0')
    const minutes = String(value.getMinutes()).padStart(2, '0')
    const seconds = String(value.getSeconds()).padStart(2, '0')
    const ms = String(value.getMilliseconds()).padStart(3, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`
  }
  // String datetime
  const date = new Date(value as string)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  const ms = String(date.getMilliseconds()).padStart(3, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`
}
