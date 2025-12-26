export type CompanyStatus = 'active' | 'inactive' | 'suspended' | 'closed'
export type CompanyType = 'PT' | 'CV' | 'Firma' | 'Koperasi' | 'Yayasan'

export interface Company {
  id: string
  company_code: string
  company_name: string
  company_type: CompanyType
  npwp: string | null
  website: string | null
  email: string | null
  phone: string | null
  status: CompanyStatus
  created_at: string
  updated_at: string
}

export type CreateCompanyDto = Pick<Company, 'company_code' | 'company_name'> &
  Partial<Pick<Company, 'company_type' | 'npwp' | 'website' | 'email' | 'phone' | 'status'>>

export type UpdateCompanyDto = Partial<
  Pick<Company, 'company_name' | 'company_type' | 'npwp' | 'website' | 'email' | 'phone' | 'status'>
>
