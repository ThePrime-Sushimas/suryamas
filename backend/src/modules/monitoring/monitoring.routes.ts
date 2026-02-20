/**
 * Monitoring Routes
 * 
 * Routes for audit trail and error monitoring
 * Following standard module pattern
 */

import { Router } from 'express'
import { authenticate } from '@/middleware/auth.middleware'
import { resolveBranchContext } from '@/middleware/branch-context.middleware'
import { canView } from '@/middleware/permission.middleware'
import { queryMiddleware } from '@/middleware/query.middleware'
import { PermissionService } from '@/services/permission.service'
import * as controller from './monitoring.controller'

const router = Router()

// Register module
PermissionService.registerModule('monitoring', 'Monitoring & Audit').catch(() => {})

// All routes require authentication
router.use(authenticate, resolveBranchContext)

// Error logging endpoints (no permission check - for error reporting from frontend)
router.post('/errors', controller.logErrorReport)

// Audit logging endpoint (no permission check - for audit trail from frontend)
router.post('/audit', controller.logAuditEntry)

// Protected routes (require authentication and permission)
router.get('/errors/stats', canView('monitoring'), controller.getErrorStats)
router.get('/errors', canView('monitoring'), queryMiddleware({}), controller.getErrorLogs)
router.get('/audit', canView('monitoring'), queryMiddleware({}), controller.getAuditLogs)

export default router
