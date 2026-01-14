import { z } from 'zod'
import { defaultConfig } from './fiscal-periods.config'
import { PERIOD_FORMAT_REGEX } from './fiscal-periods.constants'

const uuidSchema = z.string().uuid('Invalid UUID format')

const periodSchema = z.preprocess(
  val => typeof val === 'string' ? val.trim() : val,
  z.string()
    .min(1, 'Period is required')
    .regex(PERIOD_FORMAT_REGEX, 'Period format must be YYYY-MM (e.g., 2024-01)')
)

// Date format validation only - logical date validation (e.g., Feb 31) is handled in service layer
const dateSchema = z.preprocess(
  val => typeof val === 'string' ? val.trim() : val,
  z.string()
    .min(1, 'Date is required')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD')
)

export const fiscalPeriodIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
})

export const createFiscalPeriodSchema = z.object({
  body: z.object({
    period: periodSchema,
    period_start: dateSchema,
    period_end: dateSchema,
    is_adjustment_allowed: z.boolean().default(true),
    is_year_end: z.boolean().default(false),
  }).strict(),
}).refine(
  data => data.body.period_start <= data.body.period_end,
  {
    message: 'Period start date must be before or equal to end date',
    path: ['body', 'period_end'],
  }
)

export const updateFiscalPeriodSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    is_adjustment_allowed: z.boolean().optional(),
  }).strict(),
})

export const closePeriodSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    close_reason: z.string().max(500, 'Close reason must be 500 characters or less').optional().nullable(),
  }).strict(),
})

export const bulkDeleteSchema = z.object({
  body: z.object({
    ids: z.array(uuidSchema)
      .min(1, 'At least one ID is required')
      .max(defaultConfig.limits.bulkDelete, `Cannot delete more than ${defaultConfig.limits.bulkDelete} records at once`),
  }).strict(),
})

export const bulkRestoreSchema = z.object({
  body: z.object({
    ids: z.array(uuidSchema)
      .min(1, 'At least one ID is required')
      .max(defaultConfig.limits.bulkDelete, `Cannot restore more than ${defaultConfig.limits.bulkDelete} records at once`),
  }).strict(),
})

// filterParamsSchema is applied on req.query
export const filterParamsSchema = z.object({
  fiscal_year: z.number().int().min(1900).max(2100).optional(),
  is_open: z.boolean().optional(),
  period: periodSchema.optional(),
  show_deleted: z.boolean().optional(),
  q: z.string().max(100, 'Search query must be 100 characters or less').optional(),
}).strict()

export const sortParamsSchema = z.object({
  field: z.enum(['period', 'fiscal_year', 'is_open', 'created_at', 'updated_at']),
  order: z.enum(['asc', 'desc']),
}).strict()
