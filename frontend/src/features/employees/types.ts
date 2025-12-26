export interface Employee {
  id: string
  employee_id: string
  full_name: string
  email: string
  mobile_phone: string | null
  job_position: string
  branch_name: string
  is_active: boolean
  profile_picture_url: string | null
  created_at: string
  updated_at: string
}

export interface CreateEmployeeDto {
  employee_id: string
  full_name: string
  email: string
  mobile_phone?: string
  job_position: string
  branch_name: string
  is_active?: boolean
}

export type UpdateEmployeeDto = Partial<Omit<CreateEmployeeDto, 'employee_id'>>
