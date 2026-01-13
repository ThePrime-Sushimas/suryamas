import { z } from 'zod'
import type { Side } from '../types/accounting-purpose-account.types'
import { MAX_PRIORITY, MAX_BULK_OPERATIONS, PRIORITY_THRESHOLDS } from '../constants/accounting-purpose-account.constants'

export const createAccountingPurposeAccountSchema = z.object({
  purpose_id: z.string().uuid('Invalid purpose'),
  account_id: z.string().uuid('Invalid account'),
  side: z.enum(['DEBIT', 'CREDIT'] as const, { required_error: 'Side is required' }),
  priority: z.number().int().min(1).max(MAX_PRIORITY).optional()
})

export const updateAccountingPurposeAccountSchema = z.object({
  side: z.enum(['DEBIT', 'CREDIT'] as const).optional(),
  priority: z.number().int().min(1).max(MAX_PRIORITY).optional(),
  is_active: z.boolean().optional()
})

export const bulkCreateAccountingPurposeAccountSchema = z.object({
  purpose_id: z.string().uuid('Invalid purpose'),
  accounts: z.array(z.object({
    account_id: z.string().uuid('Invalid account'),
    side: z.enum(['DEBIT', 'CREDIT'] as const),
    priority: z.number().int().min(1).max(MAX_PRIORITY).optional()
  })).min(1, 'At least one account required').max(MAX_BULK_OPERATIONS, `Maximum ${MAX_BULK_OPERATIONS} accounts allowed`)
})

export const validateSideBalance = (accountNormalBalance: Side, selectedSide: Side): { isValid: boolean; warning?: string } => {
  if (accountNormalBalance !== selectedSide) {
    return {
      isValid: true,
      warning: `Contra account: ${accountNormalBalance} account mapped to ${selectedSide} side`
    }
  }
  return { isValid: true }
}

export const getPriorityLevel = (priority: number): 'high' | 'medium' | 'low' => {
  if (priority <= PRIORITY_THRESHOLDS.high) return 'high'
  if (priority <= PRIORITY_THRESHOLDS.medium) return 'medium'
  return 'low'
}