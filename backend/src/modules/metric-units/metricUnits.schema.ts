import { z } from 'zod'
import { METRIC_UNIT_CONFIG } from './metricUnits.constants'

const uuidSchema = z.string().uuid()
export const UuidParamSchema = z.object({
  id: uuidSchema,
})
export const MetricTypeEnum = z.enum(METRIC_UNIT_CONFIG.VALID_TYPES)

export const metricUnitIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
})

export const CreateMetricUnitSchema = z.object({
  body: z.object({
    metric_type: MetricTypeEnum,
    unit_name: z.string().min(1).max(METRIC_UNIT_CONFIG.VALIDATION.UNIT_NAME_MAX_LENGTH),
    notes: z.string().max(METRIC_UNIT_CONFIG.VALIDATION.NOTES_MAX_LENGTH).optional().nullable(),
    is_active: z.boolean().default(true),
  }),
})

export const UpdateMetricUnitSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    metric_type: MetricTypeEnum.optional(),
    unit_name: z.string().min(1).max(METRIC_UNIT_CONFIG.VALIDATION.UNIT_NAME_MAX_LENGTH).optional(),
    notes: z.string().max(METRIC_UNIT_CONFIG.VALIDATION.NOTES_MAX_LENGTH).optional().nullable(),
    is_active: z.boolean().optional(),
  }),
})

export const BulkUpdateStatusSchema = z.object({
  body: z.object({
    ids: z.array(uuidSchema).min(1),
    is_active: z.boolean(),
  }),
})
