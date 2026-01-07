import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { createRateLimit, updateRateLimit } from '../../middleware/rateLimiter.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { bankAccountsController } from './bankAccounts.controller'
import { PermissionService } from '../../services/permission.service'
import { 
  createBankAccountSchema, 
  updateBankAccountSchema, 
  bankAccountIdSchema, 
  bankAccountListQuerySchema,
  ownerBankAccountsSchema 
} from './bankAccounts.schema'

const router = Router()

PermissionService.registerModule('bank_accounts', 'Bank Account Management').catch(() => {})

router.use(authenticate, resolveBranchContext)

router.get('/', canView('bank_accounts'), validateSchema(bankAccountListQuerySchema), bankAccountsController.list)
router.get('/:id', canView('bank_accounts'), validateSchema(bankAccountIdSchema), bankAccountsController.findById)
router.post('/', canInsert('bank_accounts'), createRateLimit, validateSchema(createBankAccountSchema), bankAccountsController.create)
router.put('/:id', canUpdate('bank_accounts'), updateRateLimit, validateSchema(updateBankAccountSchema), bankAccountsController.update)
router.delete('/:id', canDelete('bank_accounts'), validateSchema(bankAccountIdSchema), bankAccountsController.delete)

export default router

export const ownerBankAccountsRouter = Router()
ownerBankAccountsRouter.use(authenticate, resolveBranchContext)
ownerBankAccountsRouter.get(
  '/:owner_type(companies|suppliers)/:id/bank-accounts',
  canView('bank_accounts'),
  validateSchema(ownerBankAccountsSchema),
  bankAccountsController.getByOwner
)
