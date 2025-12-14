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

export function validatePhone(phone: string): boolean {
  const phoneRegex = /^[\d\-\+\(\)\s]+$/
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10
}
