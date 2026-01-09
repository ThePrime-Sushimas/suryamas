export type PTKPStatus = 'TK/0' | 'TK/1' | 'TK/2' | 'TK/3' | 'K/0' | 'K/1' | 'K/2' | 'K/3'
export type Religion = 'Islam' | 'Christian' | 'Catholic' | 'Hindu' | 'Buddha' | 'Other'
export type StatusEmployee = 'Permanent' | 'Contract'
export type Gender = 'Male' | 'Female'
export type MaritalStatus = 'Single' | 'Married' | 'Divorced' | 'Widow'

export interface EmployeeDB {
  id: string
  employee_id: string
  full_name: string
  job_position: string
  join_date: string
  resign_date: string | null
  status_employee: StatusEmployee
  end_date: string | null
  sign_date: string | null
  email: string | null
  birth_date: string | null
  birth_place: string | null
  citizen_id_address: string | null
  ptkp_status: PTKPStatus
  bank_name: string | null
  bank_account: string | null
  bank_account_holder: string | null
  nik: string | null
  mobile_phone: string | null
  brand_name: string | null
  religion: Religion | null
  gender: Gender | null
  marital_status: MaritalStatus | null
  profile_picture: string | null
  created_at: string
  updated_at: string
  user_id: string | null
  is_active: boolean
  deleted_at: string | null
}

export interface EmployeeWithBranch extends EmployeeDB {
  branch_code: string | null
  branch_city: string | null
  branch_name: string | null
}

export interface EmployeeResponse extends EmployeeWithBranch {
  age: number | null
  years_of_service: { years: number; months: number; days: number } | null
}

export interface EmployeeCreatePayload {
  employee_id?: string
  full_name: string
  job_position: string
  brand_name: string
  join_date: string
  resign_date?: string | null
  sign_date?: string | null
  end_date?: string | null
  status_employee: StatusEmployee
  email?: string | null
  mobile_phone?: string | null
  nik?: string | null
  birth_date?: string | null
  birth_place?: string | null
  gender?: Gender | null
  religion?: Religion | null
  marital_status?: MaritalStatus | null
  citizen_id_address?: string | null
  ptkp_status: PTKPStatus
  bank_name?: string | null
  bank_account?: string | null
  bank_account_holder?: string | null
  user_id?: string | null
}

export interface EmployeeUpdatePayload {
  full_name?: string
  job_position?: string
  brand_name?: string
  join_date?: string
  resign_date?: string | null
  sign_date?: string | null
  end_date?: string | null
  status_employee?: StatusEmployee
  email?: string | null
  mobile_phone?: string | null
  nik?: string | null
  birth_date?: string | null
  birth_place?: string | null
  gender?: Gender | null
  religion?: Religion | null
  marital_status?: MaritalStatus | null
  citizen_id_address?: string | null
  ptkp_status?: PTKPStatus
  bank_name?: string | null
  bank_account?: string | null
  bank_account_holder?: string | null
}

export interface EmployeeProfileUpdatePayload {
  full_name?: string
  email?: string | null
  mobile_phone?: string | null
  birth_date?: string | null
  birth_place?: string | null
  gender?: Gender | null
  religion?: Religion | null
  marital_status?: MaritalStatus | null
  citizen_id_address?: string | null
}

export interface EmployeeFilter {
  search?: string
  branch_name?: string
  job_position?: string
  status_employee?: StatusEmployee
  is_active?: boolean
  include_deleted?: boolean
}

export interface PaginationParams {
  page: number
  limit: number
  sort?: string
  order?: 'asc' | 'desc'
}
