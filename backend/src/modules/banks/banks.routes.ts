import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { createRateLimit, updateRateLimit } from '../../middleware/rateLimiter.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { banksController } from './banks.controller'
import { PermissionService } from '../../services/permission.service'
import { createBankSchema, updateBankSchema, bankIdSchema, bankListQuerySchema } from './banks.schema'

const router = Router()

PermissionService.registerModule('banks', 'Bank Management').catch(() => {})

router.use(authenticate, resolveBranchContext)

router.get('/options', canView('banks'), banksController.getOptions)
router.get('/', canView('banks'), validateSchema(bankListQuerySchema), banksController.list)
router.get('/:id', canView('banks'), validateSchema(bankIdSchema), banksController.findById)
router.post('/', canInsert('banks'), createRateLimit, validateSchema(createBankSchema), banksController.create)
router.put('/:id', canUpdate('banks'), updateRateLimit, validateSchema(updateBankSchema), banksController.update)
router.delete('/:id', canDelete('banks'), validateSchema(bankIdSchema), banksController.delete)

export default router
