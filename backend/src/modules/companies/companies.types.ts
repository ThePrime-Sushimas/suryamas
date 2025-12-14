export interface Company {
  id: string
  company_code: string
  company_name: string
  company_type: 'PT' | 'CV' | 'Firma' | 'Koperasi' | 'Yayasan'
  npwp: string | null
  website: string | null
  email: string | null
  phone: string | null
  status: 'active' | 'inactive' | 'suspended' | 'closed'
  created_at: string
  updated_at: string
}

export interface CreateCompanyDTO {
  company_code: string
  company_name: string
  company_type?: 'PT' | 'CV' | 'Firma' | 'Koperasi' | 'Yayasan'
  npwp?: string | null
  website?: string | null
  email?: string | null
  phone?: string | null
  status?: 'active' | 'inactive' | 'suspended' | 'closed'
}

export interface UpdateCompanyDTO {
  company_name?: string
  company_type?: 'PT' | 'CV' | 'Firma' | 'Koperasi' | 'Yayasan'
  npwp?: string | null
  website?: string | null
  email?: string | null
  phone?: string | null
  status?: 'active' | 'inactive' | 'suspended' | 'closed'
}

export interface CompanyFilterParams {
  status?: 'active' | 'inactive' | 'suspended' | 'closed'
  company_type?: 'PT' | 'CV' | 'Firma' | 'Koperasi' | 'Yayasan'
}
