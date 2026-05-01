import { Router } from 'express'
import { jobsController } from './jobs.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { getJobByIdSchema, cancelJobSchema, createJobFullSchema } from './jobs.schema'
import rateLimit from 'express-rate-limit'
import { PermissionService } from '../../services/permission.service'
import multer from 'multer'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

PermissionService.registerModule('jobs', 'Job Management').catch((err) => {
  console.error('Failed to register jobs module:', err instanceof Error ? err.message : err)
})

const jobRateLimiter = rateLimit({ windowMs: 60_000, max: 10, message: 'Too many job requests, please try again later' })
const createJobRateLimiter = rateLimit({ windowMs: 60_000, max: 5, message: 'Too many job creation requests, please try again later' })

router.use(authenticate, resolveBranchContext)

router.get('/recent', canView('jobs'), (req, res) => jobsController.getRecentJobs(req, res))
router.get('/modules', canView('jobs'), (req, res) => jobsController.getAvailableModules(req, res))
router.get('/:id', canView('jobs'), validateSchema(getJobByIdSchema), (req, res) => jobsController.getJobById(req, res))
router.post('/', canInsert('jobs'), validateSchema(createJobFullSchema), createJobRateLimiter, (req, res) => jobsController.createJob(req, res))
router.post('/:id/upload', canInsert('jobs'), validateSchema(getJobByIdSchema), upload.single('file'), jobRateLimiter, (req, res) => jobsController.uploadJobFile(req, res))
router.post('/:id/cancel', canUpdate('jobs'), validateSchema(cancelJobSchema), (req, res) => jobsController.cancelJob(req, res))
router.post('/clear-all', canDelete('jobs'), (req, res) => jobsController.clearAllJobs(req, res))

export default router
