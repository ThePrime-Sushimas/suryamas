import { Router, Request, Response } from 'express'
import { authController } from './auth.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from './auth.schema'
import type { AuthenticatedRequest } from '../../types/request.types'
import './auth.openapi' // Register OpenAPI docs

const router = Router()

// Public routes (no authentication required)
router.post('/register', validateSchema(registerSchema), authController.register)

router.post('/login', validateSchema(loginSchema), authController.login)

router.post('/forgot-password', validateSchema(forgotPasswordSchema), authController.forgotPassword)

router.post('/reset-password', validateSchema(resetPasswordSchema), authController.resetPassword)

// Protected routes
router.post('/logout', authenticate, (req, res) => 
  authController.logout(req as AuthenticatedRequest, res))

export default router
