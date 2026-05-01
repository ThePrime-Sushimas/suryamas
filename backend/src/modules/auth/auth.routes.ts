import { Router } from 'express'
import { authController } from './auth.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from './auth.schema'
import './auth.openapi'

const router = Router()

// Public routes
router.post('/register', validateSchema(registerSchema), (req, res) => authController.register(req, res))
router.post('/login', validateSchema(loginSchema), (req, res) => authController.login(req, res))
router.post('/forgot-password', validateSchema(forgotPasswordSchema), (req, res) => authController.forgotPassword(req, res))
router.post('/reset-password', validateSchema(resetPasswordSchema), (req, res) => authController.resetPassword(req, res))

// Protected routes
router.post('/logout', authenticate, (req, res) => authController.logout(req, res))

export default router
