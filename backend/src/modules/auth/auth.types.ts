export interface AuthUser {
  id: string
  email: string
}

export interface AuthSession {
  access_token: string
  user: AuthUser
}

export interface AuthUserRow {
  id: string
  email: string
  encrypted_password: string
  reset_token: string | null
  reset_token_expires_at: string | null
  created_at: string
  updated_at: string
}

export interface RegisterDto {
  email: string
  password: string
  employee_id: string
}

export interface LoginDto {
  email: string
  password: string
}

export interface ResetPasswordDto {
  password: string
  recovery_token?: string
}
