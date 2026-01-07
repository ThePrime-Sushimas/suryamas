import { z } from 'zod'

const uuidSchema = z.string().uuid()

export const employeeBranchIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
})

export const employeeIdSchema = z.object({
  params: z.object({
    employeeId: uuidSchema,
  }),
})

export const branchIdSchema = z.object({
  params: z.object({
    branchId: uuidSchema,
  }),
})

export const CreateEmployeeBranchSchema = z.object({
  body: z.object({
    employee_id: uuidSchema,
    branch_id: uuidSchema,
    role_id: uuidSchema,
    is_primary: z.boolean().optional().default(false),
    approval_limit: z.number().min(0).optional().default(0),
    status: z.enum(['active', 'inactive', 'suspended']).optional().default('active'),
  }),
})

export const UpdateEmployeeBranchSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    role_id: uuidSchema.optional(),
    is_primary: z.boolean().optional(),
    approval_limit: z.number().min(0).optional(),
    status: z.enum(['active', 'inactive', 'suspended']).optional(),
  }),
})

export const BulkDeleteSchema = z.object({
  body: z.object({
    ids: z.array(uuidSchema).min(1),
  }),
})

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
})
