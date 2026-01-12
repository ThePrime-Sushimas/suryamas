import { z } from '@/lib/openapi'
import { ChartOfAccountConfig } from './chart-of-accounts.constants'

const uuidSchema = z.string().uuid()
const accountTypes = ChartOfAccountConfig.ACCOUNT_TYPES
const normalBalances = ChartOfAccountConfig.NORMAL_BALANCES

export const chartOfAccountIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
})

export const createChartOfAccountSchema = z.object({
  body: z.object({
    company_id: uuidSchema,
    branch_id: uuidSchema.optional().nullable(),
    account_code: z.string()
      .min(1)
      .max(ChartOfAccountConfig.VALIDATION.ACCOUNT_CODE_MAX_LENGTH)
      .trim()
      .regex(/^[A-Z0-9-_.]+$/, "Account code must contain only uppercase letters, numbers, hyphens, underscores, and dots"),
    account_name: z.string()
      .min(1)
      .max(ChartOfAccountConfig.VALIDATION.ACCOUNT_NAME_MAX_LENGTH)
      .trim()
      .transform(val => val.replace(/\s+/g, ' ')), // Normalize whitespace
    account_type: z.enum(accountTypes),
    account_subtype: z.string().max(50).optional().nullable(),
    parent_account_id: uuidSchema.optional().nullable(),
    is_header: z.boolean().default(false),
    is_postable: z.boolean().default(true),
    normal_balance: z.enum(normalBalances),
    currency_code: z.string().length(3).regex(/^[A-Z]{3}$/, "Currency code must be 3 uppercase letters").default(ChartOfAccountConfig.DEFAULT_CURRENCY),
    sort_order: z.number().int().min(0).max(999999).optional().nullable(),
  }).refine(data => {
    // Header accounts cannot be postable
    if (data.is_header && data.is_postable) {
      return false
    }
    return true
  }, {
    message: "Header accounts cannot be postable",
    path: ["is_postable"]
  }).refine(data => {
    // Validate normal balance for account type
    const debitAccounts = ChartOfAccountConfig.DEBIT_ACCOUNTS
    const creditAccounts = ChartOfAccountConfig.CREDIT_ACCOUNTS
    
    if (debitAccounts.includes(data.account_type) && data.normal_balance !== 'DEBIT') {
      return false
    }
    if (creditAccounts.includes(data.account_type) && data.normal_balance !== 'CREDIT') {
      return false
    }
    return true
  }, {
    message: "Invalid normal balance for account type",
    path: ["normal_balance"]
  }).refine(data => {
    // Parent account cannot be self
    if (data.parent_account_id && data.parent_account_id === data.company_id) {
      return false
    }
    return true
  }, {
    message: "Parent account cannot be the same as the account itself",
    path: ["parent_account_id"]
  }),
})

export const updateChartOfAccountSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    account_name: z.string()
      .min(1)
      .max(ChartOfAccountConfig.VALIDATION.ACCOUNT_NAME_MAX_LENGTH)
      .trim()
      .transform(val => val.replace(/\s+/g, ' '))
      .optional(),
    account_subtype: z.string().max(50).optional().nullable(),
    parent_account_id: uuidSchema.optional().nullable(),
    is_header: z.boolean().optional(),
    is_postable: z.boolean().optional(),
    currency_code: z.string().length(3).regex(/^[A-Z]{3}$/, "Currency code must be 3 uppercase letters").optional(),
    sort_order: z.number().int().min(0).max(999999).optional().nullable(),
    is_active: z.boolean().optional(),
  }).refine(data => {
    // Header accounts cannot be postable
    if (data.is_header !== undefined && data.is_postable !== undefined) {
      if (data.is_header && data.is_postable) {
        return false
      }
    }
    return true
  }, {
    message: "Header accounts cannot be postable",
    path: ["is_postable"]
  }),
})

export const bulkUpdateStatusSchema = z.object({
  body: z.object({
    ids: z.array(uuidSchema).min(1),
    is_active: z.boolean(),
  }).strict(),
})

export const bulkDeleteSchema = z.object({
  body: z.object({
    ids: z.array(uuidSchema).min(1),
  }).strict(),
})