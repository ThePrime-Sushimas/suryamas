import { z } from 'zod'
import { defaultConfig, APPLIED_TO_TYPES } from './accounting-purposes.config'

const uuidSchema = z.string().uuid('Invalid UUID format')

// Input validation schemas
const purposeCodeSchema = z.string()
  .min(1, 'Purpose code is required')
  .max(defaultConfig.validation.purposeCodeMaxLength, `Purpose code must be ${defaultConfig.validation.purposeCodeMaxLength} characters or less`)
  .regex(/^[A-Z0-9_]+$/, 'Purpose code must contain only uppercase letters, numbers, and underscores')
  .transform(val => val.trim().toUpperCase())

const purposeNameSchema = z.string()
  .min(1, 'Purpose name is required')
  .max(defaultConfig.validation.purposeNameMaxLength, `Purpose name must be ${defaultConfig.validation.purposeNameMaxLength} characters or less`)
  .transform(val => val.trim())

const descriptionSchema = z.string()
  .max(defaultConfig.validation.descriptionMaxLength, `Description must be ${defaultConfig.validation.descriptionMaxLength} characters or less`)
  .optional()
  .nullable()
  .transform(val => val?.trim() || null)

export const accountingPurposeIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
})

export const createAccountingPurposeSchema = z.object({
  body: z.object({
    purpose_code: purposeCodeSchema,
    purpose_name: purposeNameSchema,
    applied_to: z.enum(APPLIED_TO_TYPES, {
      message: `Applied to must be one of: ${APPLIED_TO_TYPES.join(', ')}`
    }),
    description: descriptionSchema,
    is_active: z.boolean().default(true),
    branch_id: uuidSchema.optional().nullable(),
  }).strict(),
})

export const updateAccountingPurposeSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    purpose_name: purposeNameSchema.optional(),
    applied_to: z.enum(APPLIED_TO_TYPES, {
      message: `Applied to must be one of: ${APPLIED_TO_TYPES.join(', ')}`
    }).optional(),
    description: descriptionSchema,
    is_active: z.boolean().optional(),
    branch_id: uuidSchema.optional().nullable(),
  }).strict(),
})

export const bulkUpdateStatusSchema = z.object({
  body: z.object({
    ids: z.array(uuidSchema)
      .min(1, 'At least one ID is required')
      .max(defaultConfig.limits.bulkUpdate, `Cannot update more than ${defaultConfig.limits.bulkUpdate} records at once`),
    is_active: z.boolean(),
  }).strict(),
})

export const bulkDeleteSchema = z.object({
  body: z.object({
    ids: z.array(uuidSchema)
      .min(1, 'At least one ID is required')
      .max(defaultConfig.limits.bulkDelete, `Cannot delete more than ${defaultConfig.limits.bulkDelete} records at once`),
  }).strict(),
})

// Filter validation schema
export const filterParamsSchema = z.object({
  applied_to: z.enum(APPLIED_TO_TYPES).optional(),
  is_active: z.boolean().optional(),
  q: z.string().max(100, 'Search query must be 100 characters or less').optional(),
}).strict()

// Sort validation schema
export const sortParamsSchema = z.object({
  field: z.enum(['purpose_code', 'purpose_name', 'applied_to', 'is_active', 'created_at', 'updated_at']),
  order: z.enum(['asc', 'desc']),
}).strict()