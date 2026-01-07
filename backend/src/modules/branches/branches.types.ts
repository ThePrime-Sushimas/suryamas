export type BranchStatus = 'active' | 'inactive'
export type HariOperasional = string[]

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
  jam_buka: string
  jam_tutup: string
  hari_operasional: HariOperasional
  notes: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export interface CreateBranchDto {
  company_id: string
  branch_code: string
  branch_name: string
  address: string
  city: string
  province?: string | null
  postal_code?: string | null
  country?: string
  phone?: string | null
  whatsapp?: string | null
  email?: string | null
  jam_buka?: string
  jam_tutup?: string
  hari_operasional: HariOperasional
  notes?: string | null
  status?: BranchStatus
  manager_id?: string | null
}

export interface UpdateBranchDto {
  branch_name?: string
  status?: BranchStatus
  manager_id?: string | null
  address?: string
  city?: string
  province?: string | null
  postal_code?: string | null
  country?: string
  phone?: string | null
  whatsapp?: string | null
  email?: string | null
  jam_buka?: string
  jam_tutup?: string
  hari_operasional?: HariOperasional
  notes?: string | null
}
