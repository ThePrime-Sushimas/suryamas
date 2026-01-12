import type { AccountType } from '../types/chart-of-account.types'
import { MAX_ACCOUNT_CODE_LENGTH, MAX_ACCOUNT_NAME_LENGTH, ACCOUNT_TYPES } from '../constants/chart-of-account.constants'

export const validateAccountCode = (code: string): string => {
  if (!code.trim()) return 'Account code is required'
  if (code.length > MAX_ACCOUNT_CODE_LENGTH) return `Account code must be max ${MAX_ACCOUNT_CODE_LENGTH} characters`
  if (!/^[A-Z0-9-_]+$/.test(code.toUpperCase())) return 'Account code can only contain letters, numbers, hyphens, and underscores'
  return ''
}

export const validateAccountName = (name: string): string => {
  if (!name.trim()) return 'Account name is required'
  if (name.length > MAX_ACCOUNT_NAME_LENGTH) return `Account name must be max ${MAX_ACCOUNT_NAME_LENGTH} characters`
  return ''
}

export const validateAccountType = (type: AccountType): string => {
  if (!ACCOUNT_TYPES.includes(type)) return 'Invalid account type'
  return ''
}

export const validateCurrencyCode = (code: string): string => {
  if (!code.trim()) return 'Currency code is required'
  if (code.length !== 3) return 'Currency code must be exactly 3 characters'
  if (!/^[A-Z]{3}$/.test(code.toUpperCase())) return 'Currency code must be 3 uppercase letters'
  return ''
}

export const validateParentAccount = (parentId: string | null, accountType: AccountType, parentAccountType?: AccountType, parentIsHeader?: boolean): string => {
  if (!parentId) return ''
  
  if (!parentIsHeader) return 'Parent account must be a header account'
  
  if (parentAccountType && parentAccountType !== accountType) {
    return 'Parent account must have the same account type'
  }
  
  return ''
}

export const validateHeaderAccount = (isHeader: boolean, isPostable: boolean): string => {
  if (isHeader && isPostable) return 'Header accounts cannot be postable'
  return ''
}



export const validateSortOrder = (sortOrder: number | null): string => {
  if (sortOrder !== null && (sortOrder < 0 || sortOrder > 9999)) {
    return 'Sort order must be between 0 and 9999'
  }
  return ''
}