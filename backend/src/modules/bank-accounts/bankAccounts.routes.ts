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
  ownerBankAccountsSchema,
} from './bankAccounts.schema'

const router = Router()

PermissionService.registerModule('bank_accounts', 'Bank Account Management').catch(() => {})

router.use(authenticate, resolveBranchContext)

router.get('/', canView('bank_accounts'), validateSchema(bankAccountListQuerySchema), (req, res) => bankAccountsController.list(req, res))
router.get('/:id', canView('bank_accounts'), validateSchema(bankAccountIdSchema), (req, res) => bankAccountsController.findById(req, res))
router.post('/', canInsert('bank_accounts'), createRateLimit, validateSchema(createBankAccountSchema), (req, res) => bankAccountsController.create(req, res))
router.put('/:id', canUpdate('bank_accounts'), updateRateLimit, validateSchema(updateBankAccountSchema), (req, res) => bankAccountsController.update(req, res))
router.delete('/:id', canDelete('bank_accounts'), validateSchema(bankAccountIdSchema), (req, res) => bankAccountsController.delete(req, res))

export default router

export const ownerBankAccountsRouter = Router()
ownerBankAccountsRouter.use(authenticate, resolveBranchContext)
ownerBankAccountsRouter.get(
  '/:owner_type(companies|suppliers)/:id/bank-accounts',
  canView('bank_accounts'),
  validateSchema(ownerBankAccountsSchema),
  (req, res) => bankAccountsController.getByOwner(req, res)
)
