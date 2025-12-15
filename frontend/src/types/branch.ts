export type BranchStatus = 'active' | 'inactive' | 'maintenance' | 'closed'

export interface Branch {
  id: string
  company_id: string
  branch_code: string
  branch_name: string
  status: BranchStatus
  manager_id: string | null
  address: string
  city: string
  province: string
  postal_code: string | null
  country: string
  phone: string | null
  whatsapp: string | null
  email: string | null
  is_24_jam: boolean
  latitude: number | null
  longitude: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CreateBranchDto {
  company_id: string
  branch_code: string
  branch_name: string
  address: string
  city: string
  province?: string
  postal_code?: string
  country?: string
  phone?: string
  whatsapp?: string
  email?: string
  is_24_jam?: boolean
  latitude?: number
  longitude?: number
  status?: BranchStatus
  manager_id?: string | null
  notes?: string
}

export type UpdateBranchDto = Partial<Omit<CreateBranchDto, 'branch_code'>>
