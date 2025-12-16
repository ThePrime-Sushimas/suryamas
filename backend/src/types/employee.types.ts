export type PTKPStatus = 'TK/0' | 'TK/1' | 'TK/2' | 'TK/3' | 'K/0' | 'K/1' | 'K/2' | 'K/3'
export type Religion = 'Islam' | 'Christian' | 'Catholic' | 'Hindu' | 'Buddha' | 'Other'
export type StatusEmployee = 'Permanent' | 'Contract'
export type Gender = 'Male' | 'Female'
export type MaritalStatus = 'Single' | 'Married' | 'Divorced' | 'Widow'

export type EmployeeWithBranch = Employee & {
  branch_name?: string | null
  branch_code?: string | null
  branch_city?: string | null
}

export interface Employee {
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
  age?: number | null  // computed, tidak disimpan di DB
  years_of_service?: { years: number; months: number; days: number } | null  // computed, tidak disimpan di DB
  birth_place: string | null
  citizen_id_address: string | null
  ptkp_status: PTKPStatus
  bank_name: string | null
  bank_account: string | null
  bank_account_holder: string | null
  nik: string | null
  mobile_phone: string | null
  branch_name?: string | null
  brand_name: string | null
  religion: Religion | null
  gender: Gender | null
  marital_status: MaritalStatus | null
  profile_picture: string | null
  created_at: string
  updated_at: string
  user_id: string | null
  is_active?: boolean
}