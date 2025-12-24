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
