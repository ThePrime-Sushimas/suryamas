/**
 * Monitoring Routes
 * 
 * Routes for audit trail and error monitoring
 */

import { Router } from 'express'
import { authenticate } from '@/middleware/auth.middleware'
import * as controller from './monitoring.controller'

const router = Router()

// Error logging (no auth required - for error reporting)
router.post('/errors', controller.logErrorReport)

// Audit logging (no auth required - for audit trail)
router.post('/audit', controller.logAuditEntry)

// Protected routes (require authentication)
router.get('/errors/stats', authenticate, controller.getErrorStats)
router.get('/audit', authenticate, controller.getAuditLogs)

export default router
