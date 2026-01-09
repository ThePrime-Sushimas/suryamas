export type PTKPStatus = 'TK/0' | 'TK/1' | 'TK/2' | 'TK/3' | 'K/0' | 'K/1' | 'K/2' | 'K/3'
export type Religion = 'Islam' | 'Christian' | 'Catholic' | 'Hindu' | 'Buddha' | 'Other'
export type StatusEmployee = 'Permanent' | 'Contract'
export type Gender = 'Male' | 'Female'
export type MaritalStatus = 'Single' | 'Married' | 'Divorced' | 'Widow'

export interface YearsOfService {
  years: number
  months: number
  days: number
}

export interface EmployeeBase {
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

export interface EmployeeWithBranch extends EmployeeBase {
  branch_name: string | null
  branch_code: string | null
  branch_city: string | null
}

export interface EmployeeResponse extends EmployeeWithBranch {
  age: number | null
  years_of_service: YearsOfService | null
}

export interface EmployeeFormData {
  employee_id?: string
  full_name: string
  job_position: string
  brand_name: string
  join_date: string
  resign_date?: string
  sign_date?: string
  end_date?: string
  status_employee: StatusEmployee
  email?: string
  mobile_phone?: string
  nik?: string
  birth_date?: string
  birth_place?: string
  gender?: Gender
  religion?: Religion
  marital_status?: MaritalStatus
  citizen_id_address?: string
  ptkp_status: PTKPStatus
  bank_name?: string
  bank_account?: string
  bank_account_holder?: string
}

export interface EmployeeProfileUpdate {
  full_name?: string
  email?: string
  mobile_phone?: string
  birth_date?: string
  birth_place?: string
  gender?: Gender
  religion?: Religion
  marital_status?: MaritalStatus
  citizen_id_address?: string
}

export interface FilterOptions {
  branches: Array<{ id: string; branch_name: string }>
  positions: string[]
  statuses: string[]
}

export interface PaginationData {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

export interface PaginatedApiResponse<T> extends ApiResponse<T[]> {
  pagination: PaginationData
}
