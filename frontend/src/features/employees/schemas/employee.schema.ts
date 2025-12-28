import { z } from 'zod'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format')

export const employeeFormSchema = z.object({
  employee_id: z.string().max(50).optional(),
  full_name: z.string().min(1, 'Name is required').max(255),
  job_position: z.string().min(1, 'Position is required').max(100),
  brand_name: z.string().min(1, 'Brand is required').max(100),
  join_date: isoDate,
  resign_date: isoDate.optional().or(z.literal('')),
  sign_date: isoDate.optional().or(z.literal('')),
  end_date: isoDate.optional().or(z.literal('')),
  status_employee: z.enum(['Permanent', 'Contract']),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  mobile_phone: z.string().max(20).optional().or(z.literal('')),
  nik: z.string().max(20).optional().or(z.literal('')),
  birth_date: isoDate.optional().or(z.literal('')),
  birth_place: z.string().max(255).optional().or(z.literal('')),
  gender: z.enum(['Male', 'Female']).optional().or(z.literal('')),
  religion: z.enum(['Islam', 'Christian', 'Catholic', 'Hindu', 'Buddha', 'Other']).optional().or(z.literal('')),
  marital_status: z.enum(['Single', 'Married', 'Divorced', 'Widow']).optional().or(z.literal('')),
  citizen_id_address: z.string().optional().or(z.literal('')),
  ptkp_status: z.enum(['TK/0', 'TK/1', 'TK/2', 'TK/3', 'K/0', 'K/1', 'K/2', 'K/3']),
  bank_name: z.string().max(100).optional().or(z.literal('')),
  bank_account: z.string().max(50).optional().or(z.literal('')),
  bank_account_holder: z.string().max(255).optional().or(z.literal('')),
}).refine(data => {
  if (data.status_employee === 'Contract' && !data.end_date) {
    return false
  }
  return true
}, { message: 'Contract employee must have end date', path: ['end_date'] })
.refine(data => {
  if (data.resign_date && data.resign_date < data.join_date) {
    return false
  }
  return true
}, { message: 'Resign date cannot be before join date', path: ['resign_date'] })

export const profileUpdateSchema = z.object({
  full_name: z.string().min(1).max(255).optional(),
  email: z.string().email().optional().or(z.literal('')),
  mobile_phone: z.string().max(20).optional().or(z.literal('')),
  birth_date: isoDate.optional().or(z.literal('')),
  birth_place: z.string().max(255).optional().or(z.literal('')),
  gender: z.enum(['Male', 'Female']).optional().or(z.literal('')),
  religion: z.enum(['Islam', 'Christian', 'Catholic', 'Hindu', 'Buddha', 'Other']).optional().or(z.literal('')),
  marital_status: z.enum(['Single', 'Married', 'Divorced', 'Widow']).optional().or(z.literal('')),
  citizen_id_address: z.string().optional().or(z.literal('')),
})

export type EmployeeFormInput = z.infer<typeof employeeFormSchema>
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>
