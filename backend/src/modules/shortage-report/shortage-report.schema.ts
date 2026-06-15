import { z } from '@/lib/openapi'

const resolveStatuses = ['UNRESOLVED', 'RESOLVED', 'CONVERTED_TO_WASTE'] as const

export const shortageReportQuerySchema = z.object({
  query: z.object({
    branch_id: z.string().uuid().optional(),
    position_id: z.string().uuid().optional(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
    item_id: z.string().uuid().optional(),
    category_id: z.string().uuid().optional(),
    resolve_status: z.enum(resolveStatuses).optional(),
    summary_only: z.enum(['true', 'false']).optional(),
  }).refine(
    (d) => d.start_date <= d.end_date,
    { message: 'start_date must be <= end_date' },
  ),
})

export const shortageReportByEmployeeSchema = z.object({
  query: z.object({
    branch_id: z.string().uuid().optional(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  }).refine(
    (d) => d.start_date <= d.end_date,
    { message: 'start_date must be <= end_date' },
  ),
})

export const shortageDepartmentEmployeesSchema = z.object({
  query: z.object({
    branch_id: z.string().uuid(),
    department_id: z.string().uuid(),
  }),
})

export const shortageResolveSchema = z.object({
  body: z.object({
    vcl_ids: z.array(z.string().uuid()).min(1, 'Minimal 1 baris shortage'),
    action: z.enum(['RESOLVE', 'CONVERT_TO_WASTE']),
    allocation_mode: z.enum(['INDIVIDUAL', 'DIVISION']).optional(),
    department_id: z.string().uuid().nullable().optional(),
    resolved_notes: z.string().nullable().optional(),
    deducted_employee_id: z.string().uuid().nullable().optional(),
    deduction_amount: z.number().nonnegative().nullable().optional(),
    deduction_notes: z.string().nullable().optional(),
  }).superRefine((b, ctx) => {
    if (b.action === 'CONVERT_TO_WASTE' && !b.resolved_notes?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Alasan konversi wajib diisi',
        path: ['resolved_notes'],
      })
    }
  }),
})

export const shortageDeductionPaidSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    paid: z.boolean(),
  }),
})
