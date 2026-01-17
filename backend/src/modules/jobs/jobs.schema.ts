/**
 * Jobs Module Validation Schemas
 */

import { z } from 'zod'

export const createJobSchema = z.object({
  type: z.enum(['export', 'import']),
  name: z.string().min(1).max(255),
  metadata: z.record(z.unknown()).optional()
})

export const getJobByIdSchema = z.object({
  id: z.string()
})

export const processJobSchema = z.object({
  id: z.string()
})

export const cancelJobSchema = z.object({
  id: z.string()
})

export const updateProgressSchema = z.object({
  id: z.string(),
  progress: z.number().int().min(0).max(100)
})
