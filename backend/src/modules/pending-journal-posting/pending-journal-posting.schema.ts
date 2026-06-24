import { z } from 'zod'
import { PENDING_POSTING_MODULES } from './pending-journal-posting.repository'

// Zod requires a tuple with at least 1 element for z.enum
const validModules = PENDING_POSTING_MODULES as unknown as readonly [string, ...string[]]

export const listPendingSchema = z.object({
  query: z.object({
    date_from: z.preprocess((v) => (v === '' ? undefined : v), z.string().date().optional()),
    date_to: z.preprocess((v) => (v === '' ? undefined : v), z.string().date().optional()),
    module: z.preprocess((v) => (v === '' ? undefined : v), z.enum(validModules).optional()),
    branch_id: z.preprocess((v) => (v === '' ? undefined : v), z.string().uuid().optional()),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
  }),
})

export const postSingleSchema = z.object({
  params: z.object({
    module: z.enum(validModules),
    id: z.string().uuid(),
  }),
})

export const postBulkSchema = z.object({
  body: z.object({
    module: z.enum(validModules),
    ids: z.array(z.string().uuid()).min(1).max(20),
  }),
})
