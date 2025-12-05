import { Router } from 'express'
import { authController } from './auth.controller'
import { authenticate } from '../../middleware/auth.middleware'

const router = Router()

// Public routes
router.post('/register', (req, res) => authController.register(req, res))
router.post('/login', (req, res) => authController.login(req, res))
router.post('/forgot-password', (req, res) => authController.forgotPassword(req, res))
router.post('/reset-password', (req, res) => authController.resetPassword(req, res))

// Protected routes
router.post('/logout', authenticate, (req, res) => authController.logout(req, res))

export default router