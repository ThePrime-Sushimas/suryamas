import { z } from 'zod'
import { METRIC_UNIT_CONFIG } from './metricUnits.constants'

export const MetricTypeEnum = z.enum(METRIC_UNIT_CONFIG.VALID_TYPES)

export const CreateMetricUnitSchema = z.object({
  metric_type: MetricTypeEnum,
  unit_name: z.string().min(1, 'Unit name is required').max(METRIC_UNIT_CONFIG.VALIDATION.UNIT_NAME_MAX_LENGTH).trim(),
  notes: z.string().max(METRIC_UNIT_CONFIG.VALIDATION.NOTES_MAX_LENGTH).optional().nullable(),
  is_active: z.boolean().default(true)
})

export const UpdateMetricUnitSchema = z.object({
  metric_type: MetricTypeEnum.optional(),
  unit_name: z.string().min(1).max(METRIC_UNIT_CONFIG.VALIDATION.UNIT_NAME_MAX_LENGTH).trim().optional(),
  notes: z.string().max(METRIC_UNIT_CONFIG.VALIDATION.NOTES_MAX_LENGTH).optional().nullable(),
  is_active: z.boolean().optional()
})

export const BulkUpdateStatusSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'At least one ID is required'),
  is_active: z.boolean()
})

export const UuidParamSchema = z.object({
  id: z.string().uuid('Invalid ID format')
})
