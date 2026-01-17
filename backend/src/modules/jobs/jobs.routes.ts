/**
 * Jobs Routes
 */

import { Router } from 'express'
import { jobsController } from './jobs.controller'
import { authenticate } from '@/middleware/auth.middleware'
import { canView, canInsert } from '@/middleware/permission.middleware'
import { validateSchema } from '@/middleware/validation.middleware'
import { getJobByIdSchema, processJobSchema, cancelJobSchema } from './jobs.schema'
import rateLimit from 'express-rate-limit'

const router = Router()

// Rate limiter for job operations
const jobRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: 'Too many job requests, please try again later'
})

// All routes require authentication and jobs view permission
router.use(authenticate)
router.use(canView('jobs'))

// Get recent jobs (last 3)
router.get('/recent', jobsController.getRecentJobs.bind(jobsController))

// Get job by ID
router.get('/:id', 
  validateSchema(getJobByIdSchema),
  jobsController.getJobById.bind(jobsController)
)

// Process job (requires insert permission)
router.post('/:id/process',
  validateSchema(processJobSchema),
  canInsert('jobs'),
  jobRateLimiter,
  jobsController.processJob.bind(jobsController)
)

// Cancel job
router.post('/:id/cancel',
  validateSchema(cancelJobSchema),
  jobsController.cancelJob.bind(jobsController)
)

export default router
