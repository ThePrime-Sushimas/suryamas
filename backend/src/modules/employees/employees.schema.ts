import { z } from '@/lib/openapi'

const uuidSchema = z.string().uuid()
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
const nullableDate = isoDate.nullable()

const GenderEnum = z.enum(['Male', 'Female'])
const ReligionEnum = z.enum(['Islam', 'Christian', 'Catholic', 'Hindu', 'Buddha', 'Other'])
const MaritalStatusEnum = z.enum(['Single', 'Married', 'Divorced', 'Widow'])
const StatusEmployeeEnum = z.enum(['Permanent', 'Contract'])
const PTKPStatusEnum = z.enum(['TK/0', 'TK/1', 'TK/2', 'TK/3', 'K/0', 'K/1', 'K/2', 'K/3'])

export const CreateEmployeeSchema = z.object({
  body: z.object({
    employee_id: z.string().max(50).optional(),
    full_name: z.string().min(1).max(255),
    job_position: z.string().min(1).max(100),
    brand_name: z.string().min(1).max(100),
    join_date: isoDate,
    resign_date: nullableDate.optional(),
    sign_date: nullableDate.optional(),
    end_date: nullableDate.optional(),
    status_employee: StatusEmployeeEnum,
    email: z.string().email().optional().nullable(),
    mobile_phone: z.string().max(20).optional().nullable(),
    nik: z.string().max(20).optional().nullable(),
    birth_date: nullableDate.optional(),
    birth_place: z.string().max(255).optional().nullable(),
    gender: GenderEnum.optional().nullable(),
    religion: ReligionEnum.optional().nullable(),
    marital_status: MaritalStatusEnum.optional().nullable(),
    citizen_id_address: z.string().optional().nullable(),
    ptkp_status: PTKPStatusEnum,
    bank_name: z.string().max(100).optional().nullable(),
    bank_account: z.string().max(50).optional().nullable(),
    bank_account_holder: z.string().max(255).optional().nullable(),
    user_id: uuidSchema.optional().nullable(),
  }).superRefine((data, ctx) => {
    if (data.status_employee === 'Contract' && !data.end_date) {
      ctx.addIssue({ path: ['end_date'], message: 'end_date is required for Contract employee', code: z.ZodIssueCode.custom })
    }
    if (data.resign_date && data.resign_date < data.join_date) {
      ctx.addIssue({ path: ['resign_date'], message: 'resign_date cannot be before join_date', code: z.ZodIssueCode.custom })
    }
    if (data.end_date && data.end_date < data.join_date) {
      ctx.addIssue({ path: ['end_date'], message: 'end_date cannot be before join_date', code: z.ZodIssueCode.custom })
    }
    if (data.sign_date && data.sign_date < data.join_date) {
      ctx.addIssue({ path: ['sign_date'], message: 'sign_date cannot be before join_date', code: z.ZodIssueCode.custom })
    }
  }),
})

export const UpdateEmployeeSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    employee_id: z.string().max(50).optional(),
    full_name: z.string().min(1).max(255).optional(),
    job_position: z.string().min(1).max(100).optional(),
    brand_name: z.string().min(1).max(100).optional(),
    join_date: isoDate.optional(),
    resign_date: nullableDate.optional(),
    sign_date: nullableDate.optional(),
    end_date: nullableDate.optional(),
    status_employee: StatusEmployeeEnum.optional(),
    email: z.string().email().optional().nullable(),
    mobile_phone: z.string().max(20).optional().nullable(),
    nik: z.string().max(20).optional().nullable(),
    birth_date: nullableDate.optional(),
    birth_place: z.string().max(255).optional().nullable(),
    gender: GenderEnum.optional().nullable(),
    religion: ReligionEnum.optional().nullable(),
    marital_status: MaritalStatusEnum.optional().nullable(),
    citizen_id_address: z.string().optional().nullable(),
    ptkp_status: PTKPStatusEnum.optional(),
    bank_name: z.string().max(100).optional().nullable(),
    bank_account: z.string().max(50).optional().nullable(),
    bank_account_holder: z.string().max(255).optional().nullable(),
  }),
})

export const UpdateProfileSchema = z.object({
  body: z.object({
    full_name: z.string().min(1).max(255).optional(),
    email: z.string().email().optional().nullable(),
    mobile_phone: z.string().max(20).optional().nullable(),
    birth_date: nullableDate.optional(),
    birth_place: z.string().max(255).optional().nullable(),
    gender: GenderEnum.optional().nullable(),
    religion: ReligionEnum.optional().nullable(),
    marital_status: MaritalStatusEnum.optional().nullable(),
    citizen_id_address: z.string().optional().nullable(),
  }),
})

export const EmployeeSearchSchema = z.object({
  q: z.string().optional(),
})

export const BulkUpdateActiveSchema = z.object({
  body: z.object({
    ids: z.array(uuidSchema).min(1),
    is_active: z.boolean(),
  }),
})

export const UpdateActiveSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    is_active: z.boolean(),
  }),
})

export const BulkDeleteSchema = z.object({
  body: z.object({
    ids: z.array(uuidSchema).min(1),
  }),
})
