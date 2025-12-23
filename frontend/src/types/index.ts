// Re-export product types
export type { Product, ProductUom, ProductStatus, UomStatus, CreateProductDto, UpdateProductDto, CreateProductUomDto, UpdateProductUomDto } from './product'

export interface Employee {
  id: string
  employee_id: string
  full_name: string
  job_position: string
  join_date: string
  resign_date: string | null
  status_employee: 'Permanent' | 'Contract'
  end_date: string | null
  sign_date: string | null
  email: string | null
  birth_date: string | null
  age: number | null
  years_of_service?: { years: number; months: number; days: number } | null
  birth_place: string | null
  citizen_id_address: string | null
  ptkp_status: 'TK/0' | 'TK/1' | 'TK/2' | 'TK/3' | 'K/0' | 'K/1' | 'K/2' | 'K/3'
  bank_name: string | null
  bank_account: string | null
  bank_account_holder: string | null
  nik: string | null
  mobile_phone: string | null
  branch_name?: string | null
  branch_code?: string | null
  branch_city?: string | null
  brand_name: string | null
  religion: 'Islam' | 'Christian' | 'Catholic' | 'Hindu' | 'Buddha' | 'Other' | null
  gender: 'Male' | 'Female' | null
  marital_status: 'Single' | 'Married' | 'Divorced' | 'Widow' | null
  profile_picture: string | null
  created_at: string
  updated_at: string
  user_id: string | null
  is_active: boolean
}

export interface User {
  id: string
  email: string
  full_name: string
  job_position: string
  created_at: string
  is_active?: boolean
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
  error?: string
}
