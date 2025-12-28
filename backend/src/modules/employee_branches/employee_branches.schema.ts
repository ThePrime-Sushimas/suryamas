import { z } from 'zod'

// Create employee branch assignment
export const CreateEmployeeBranchSchema = z.object({
  employee_id: z.string().uuid('Invalid employee ID format'),
  branch_id: z.string().uuid('Invalid branch ID format'),
  is_primary: z.boolean().optional().default(false),
})

// Update employee branch assignment
export const UpdateEmployeeBranchSchema = z.object({
  is_primary: z.boolean(),
})

// Set primary branch
export const SetPrimaryBranchSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID format'),
  branchId: z.string().uuid('Invalid branch ID format'),
})

// Bulk delete
export const BulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid('Invalid ID format')).min(1, 'At least one ID required'),
})

// Query params for pagination
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(1000).default(10),
})

// Export types
export type CreateEmployeeBranchInput = z.infer<typeof CreateEmployeeBranchSchema>
export type UpdateEmployeeBranchInput = z.infer<typeof UpdateEmployeeBranchSchema>
export type SetPrimaryBranchInput = z.infer<typeof SetPrimaryBranchSchema>
export type BulkDeleteInput = z.infer<typeof BulkDeleteSchema>
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>
