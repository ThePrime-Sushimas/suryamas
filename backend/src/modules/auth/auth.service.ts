import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { authRepository } from './auth.repository'
import { AuthErrors } from './auth.errors'
import { AuthUser, AuthSession } from './auth.types'
import { AuditService } from '../monitoring/monitoring.service'
import { logInfo, logWarn } from '../../config/logger'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required')
const JWT_SECRET_KEY: string = JWT_SECRET
const JWT_EXPIRES_IN = Number(process.env.JWT_EXPIRES_IN_SECONDS) || 86400 // 24h in seconds
const SALT_ROUNDS = 12
const DEFAULT_ROLE = 'staff'

export class AuthService {
  async register(email: string, password: string, employeeId: string): Promise<{ user: AuthUser; employeeName: string }> {
    const employee = await authRepository.findEmployeeByEmployeeId(employeeId)
    if (!employee) throw AuthErrors.EMPLOYEE_NOT_FOUND()
    if (employee.user_id) throw AuthErrors.EMPLOYEE_ALREADY_HAS_ACCOUNT()

    const isResigned = employee.resign_date && new Date(employee.resign_date) < new Date()
    if (isResigned) throw AuthErrors.EMPLOYEE_RESIGNED()

    const existing = await authRepository.findUserByEmail(email)
    if (existing) throw AuthErrors.USER_ALREADY_EXISTS()

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS)
    const userId = crypto.randomUUID()

    const authUser = await authRepository.createUser(userId, email, hashedPassword)
    await authRepository.linkEmployeeToUser(employeeId, userId)

    const staffRole = await authRepository.findRoleByName(DEFAULT_ROLE)
    if (staffRole) {
      await authRepository.createUserProfile(userId, staffRole.id)
    }

    logInfo('User registered successfully', { user_id: userId, employee_id: employeeId, email })

    try {
      await AuditService.log('REGISTER', 'auth', userId, userId, null, { email, employee_id: employeeId })
    } catch (e) {
      logWarn('Audit logging failed for register', { error: e instanceof Error ? e.message : 'Unknown' })
    }

    return { user: { id: authUser.id, email: authUser.email }, employeeName: employee.full_name }
  }

  async login(email: string, password: string): Promise<AuthSession> {
    const user = await authRepository.findUserByEmail(email)
    if (!user) throw AuthErrors.INVALID_CREDENTIALS()

    const valid = await bcrypt.compare(password, user.encrypted_password)
    if (!valid) throw AuthErrors.INVALID_CREDENTIALS()

    const employee = await authRepository.findEmployeeByUserId(user.id)
    const isResigned = employee?.resign_date && new Date(employee.resign_date) < new Date()
    if (isResigned) throw AuthErrors.ACCOUNT_DEACTIVATED()

    const token = jwt.sign(
      { sub: user.id, email: user.email, role: 'authenticated' },
      JWT_SECRET_KEY,
      { expiresIn: JWT_EXPIRES_IN }
    )

    logInfo('User logged in', { user_id: user.id, email })

    try {
      await AuditService.log('LOGIN', 'auth', user.id, user.id, null, { email })
    } catch (e) {
      logWarn('Audit logging failed for login', { error: e instanceof Error ? e.message : 'Unknown' })
    }

    return { access_token: token, user: { id: user.id, email: user.email } }
  }

  async logout(userId: string): Promise<void> {
    logInfo('User logged out', { user_id: userId })

    try {
      await AuditService.log('LOGOUT', 'auth', userId, userId, null, null)
    } catch (e) {
      logWarn('Audit logging failed for logout', { error: e instanceof Error ? e.message : 'Unknown' })
    }
  }

  async forgotPassword(email: string): Promise<void> {
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    const updated = await authRepository.setResetToken(email, token, expiresAt)
    if (!updated) return // silently ignore if email not found (security)

    // TODO: send email with reset link
    // For now, log the token (remove in production)
    logInfo('Password reset token generated', { email, resetUrl: `${process.env.FRONTEND_URL}/reset-password?token=${token}` })

    try {
      await AuditService.log('FORGOT_PASSWORD', 'auth', email, null, null, { email })
    } catch (e) {
      logWarn('Audit logging failed for forgotPassword', { error: e instanceof Error ? e.message : 'Unknown' })
    }
  }

  async resetPassword(recoveryToken: string, newPassword: string): Promise<void> {
    if (!recoveryToken) throw AuthErrors.RECOVERY_TOKEN_REQUIRED()

    const user = await authRepository.findUserByResetToken(recoveryToken)
    if (!user) throw AuthErrors.INVALID_RECOVERY_TOKEN()

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS)
    await authRepository.updatePassword(user.id, hashedPassword)

    logInfo('Password reset successful', { user_id: user.id })

    try {
      await AuditService.log('RESET_PASSWORD', 'auth', user.id, user.id, null, null)
    } catch (e) {
      logWarn('Audit logging failed for resetPassword', { error: e instanceof Error ? e.message : 'Unknown' })
    }
  }

  async verifyToken(token: string): Promise<AuthUser | null> {
    try {
      const payload = jwt.verify(token, JWT_SECRET_KEY) as { sub: string; email: string }
      return { id: payload.sub, email: payload.email }
    } catch {
      return null
    }
  }
}

export const authService = new AuthService()
