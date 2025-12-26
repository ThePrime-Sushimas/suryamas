export interface User {
  employee_id: string
  full_name: string
  email: string
  branch: string
  has_account: boolean
  role_id: string | null
  role_name: string | null
  role_description: string | null
}
