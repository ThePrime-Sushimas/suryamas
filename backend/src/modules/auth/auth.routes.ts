import { Router, Request, Response } from 'express'
import { authController } from './auth.controller'
import { authenticate } from '../../middleware/auth.middleware'
import type { AuthenticatedRequest } from '../../types/request.types'

const router = Router()

// Public routes (no authentication required)
router.post('/register', (req: Request, res: Response) => 
  authController.register(req, res))

router.post('/login', (req: Request, res: Response) => 
  authController.login(req, res))

router.post('/forgot-password', (req: Request, res: Response) => 
  authController.forgotPassword(req, res))

router.post('/reset-password', (req: Request, res: Response) => 
  authController.resetPassword(req, res))

// Protected routes
router.post('/logout', authenticate, (req, res) => 
  authController.logout(req as AuthenticatedRequest, res))

export default router
