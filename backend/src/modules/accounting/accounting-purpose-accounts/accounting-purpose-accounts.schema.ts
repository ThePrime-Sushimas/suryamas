// accounting-purpose-accounts.schema.ts

import { z } from '@/lib/openapi'
import { AccountingPurposeAccountsConfig } from './accounting-purpose-accounts.constants'

const uuidSchema = z.string().uuid()
const sides = AccountingPurposeAccountsConfig.SIDES

export const accountingPurposeAccountIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
})

export const createAccountingPurposeAccountSchema = z.object({
  body: z.object({
    purpose_id: uuidSchema,
    account_id: uuidSchema,
    side: z.enum(sides),
    is_required: z.boolean().optional().default(true),
    is_auto: z.boolean().optional().default(true),
    priority: z.number().int().min(AccountingPurposeAccountsConfig.VALIDATION.MIN_PRIORITY)
                    .max(AccountingPurposeAccountsConfig.VALIDATION.MAX_PRIORITY)
                    .optional(),
  }),
})

export const updateAccountingPurposeAccountSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    side: z.enum(sides).optional(),
    is_required: z.boolean().optional(),
    is_auto: z.boolean().optional(),
    is_active: z.boolean().optional(),
    priority: z.number().int().min(AccountingPurposeAccountsConfig.VALIDATION.MIN_PRIORITY)
                    .max(AccountingPurposeAccountsConfig.VALIDATION.MAX_PRIORITY)
                    .optional(),
  }),
})

export const bulkCreateAccountingPurposeAccountSchema = z.object({
  body: z.object({
    purpose_id: uuidSchema,
    accounts: z.array(z.object({
      account_id: uuidSchema,
      side: z.enum(sides),
      is_required: z.boolean().optional().default(true),
      is_auto: z.boolean().optional().default(true),
      priority: z.number().int().min(AccountingPurposeAccountsConfig.VALIDATION.MIN_PRIORITY)
                      .max(AccountingPurposeAccountsConfig.VALIDATION.MAX_PRIORITY)
                      .optional(),
    }))
    .min(1)
    .max(AccountingPurposeAccountsConfig.VALIDATION.MAX_BULK_OPERATIONS),
  }),
})

export const bulkRemoveAccountingPurposeAccountSchema = z.object({
  body: z.object({
    purpose_id: uuidSchema,
    account_ids: z.array(uuidSchema)
                  .min(1)
                  .max(AccountingPurposeAccountsConfig.VALIDATION.MAX_BULK_OPERATIONS),
  }),
})

export const bulkUpdateStatusSchema = z.object({
  body: z.object({
    ids: z.array(uuidSchema)
           .min(1)
           .max(AccountingPurposeAccountsConfig.VALIDATION.MAX_BULK_OPERATIONS),
    is_active: z.boolean(),
  }),
})
