
export const formatCode = (code: string): string => {
  if (!code) return ''
  return code.toUpperCase().trim()
}

export const formatAccountPath = (path: string | null): string => {
  if (!path) return ''
  return path.split('.').join(' > ')
}

export const getAccountLevel = (path: string | null): number => {
  if (!path) return 0
  return path.split('.').length
}

export const buildAccountDisplayName = (code: string, name: string): string => {
  if (!code || !name) return code || name || ''
  return `${code} - ${name}`
}