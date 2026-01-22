export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function validateUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

export function normalizePhone(phone: string): string {
  // Remove all non-digit characters except +
  let normalized = phone.replace(/[^\d+]/g, '')
  
  // If starts with 0, replace with +62
  if (normalized.startsWith('0')) {
    normalized = '+62' + normalized.slice(1)
  }
  
  // If doesn't start with +, add +62
  if (!normalized.startsWith('+')) {
    normalized = '+62' + normalized
  }
  
  return normalized
}

export function validatePhone(phone: string): boolean {
  const phoneRegex = /^[\d\-\+\(\)\s]+$/
  const digits = phone.replace(/\D/g, '')
  return phoneRegex.test(phone) && digits.length >= 10
}

/**
 * Safely extract string value from Express request parameters
 * Express params can be string | string[], this ensures we get a string
 */
export function getParamString(param: string | string[] | undefined): string {
  if (Array.isArray(param)) {
    return param[0] || ''
  }
  return param || ''
}

/**
 * Safely extract string value from Express query parameters
 * Express query can be string | string[] | ParsedQs | ParsedQs[], this ensures we get a string
 */
export function getQueryString(query: any): string {
  if (Array.isArray(query)) {
    return query[0] || ''
  }
  if (typeof query === 'object' && query !== null) {
    return ''
  }
  return query || ''
}
