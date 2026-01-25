/**
 * Jobs Routes
 */

import { Router } from 'express'
import { jobsController } from './jobs.controller'
import { authenticate } from '@/middleware/auth.middleware'
import { resolveBranchContext } from '@/middleware/branch-context.middleware'
import { canView, canInsert } from '@/middleware/permission.middleware'
import { validateSchema } from '@/middleware/validation.middleware'
import { getJobByIdSchema, cancelJobSchema, createJobSchema, createJobFullSchema } from './jobs.schema'
import rateLimit from 'express-rate-limit'
import { PermissionService } from '@/services/permission.service'
import multer from 'multer'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

PermissionService.registerModule('jobs', 'Job Management').catch(() => {})

// Rate limiter for job operations
const jobRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: 'Too many job requests, please try again later'
})

// Rate limiter for job creation (stricter)
const createJobRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 job creations per minute
  message: 'Too many job creation requests, please try again later'
})

// All routes require authentication and branch context
router.use(authenticate)
router.use(resolveBranchContext)

// Get recent jobs (last 10)
router.get('/recent', jobsController.getRecentJobs.bind(jobsController))

// Get available modules for a job type
router.get('/modules', jobsController.getAvailableModules.bind(jobsController))

// Get job by ID (requires jobs view permission)
router.get('/:id', 
  canView('jobs'),
  validateSchema(getJobByIdSchema),
  jobsController.getJobById.bind(jobsController)
)

// Create a new job (requires insert permission)
// Use createJobFullSchema to accept optional user_id/company_id from frontend
router.post('/',
  canInsert('jobs'),
  validateSchema(createJobFullSchema),
  createJobRateLimiter,
  jobsController.createJob.bind(jobsController)
)

// Upload file for import job (requires insert permission)
router.post('/:id/upload',
  canInsert('jobs'),
  upload.single('file'),
  jobRateLimiter,
  jobsController.uploadJobFile.bind(jobsController)
)

// Cancel job
router.post('/:id/cancel',
  validateSchema(cancelJobSchema),
  jobsController.cancelJob.bind(jobsController)
)

// Clear all completed jobs
router.post('/clear-all',
  jobsController.clearAllJobs.bind(jobsController)
)

export default router

