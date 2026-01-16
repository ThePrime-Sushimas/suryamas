/**
 * POS Imports Validation Schemas
 * Following journal-headers.schema.ts pattern
 */

import { z } from 'zod'

export const posImportIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid import ID format')
  })
})

export const uploadPosFileSchema = z.object({
  body: z.object({
    branch_id: z.string().uuid('Invalid branch ID format')
  })
})

export const confirmImportSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid import ID format')
  }),
  body: z.object({
    skip_duplicates: z.boolean().default(true)
  })
})

export const updateStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid import ID format')
  }),
  body: z.object({
    status: z.enum(['PENDING', 'ANALYZED', 'IMPORTED', 'MAPPED', 'POSTED', 'FAILED']),
    error_message: z.string().optional()
  })
})

export const listPosImportsSchema = z.object({
  query: z.object({
    branch_id: z.string().uuid().optional(),
    status: z.enum(['PENDING', 'ANALYZED', 'IMPORTED', 'MAPPED', 'POSTED', 'FAILED']).optional(),
    date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    search: z.string().optional()
  }).optional()
})

export type UploadPosFileInput = z.infer<typeof uploadPosFileSchema>
export type ConfirmImportInput = z.infer<typeof confirmImportSchema>
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>
export type ListPosImportsInput = z.infer<typeof listPosImportsSchema>
