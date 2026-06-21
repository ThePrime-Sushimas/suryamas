import { Router, Request, Response } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { queryMiddleware } from '../../middleware/query.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { branchesController } from './branches.controller'
import { PermissionService } from '../../services/permission.service'
import { CreateBranchSchema, UpdateBranchSchema, BulkUpdateStatusSchema, branchIdSchema } from './branches.schema'
import { getAccessibleCompanyIds, requireCompanyAccess, getCentralBranches } from '../../utils/branch-access.util'
import { sendSuccess, sendError } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'

const router = Router()

PermissionService.registerModule('branches', 'Branch Management').catch((err) => {
  console.error('Failed to register branches module:', err instanceof Error ? err.message : err)
})

const sortFields = ['branch_name', 'branch_code', 'city', 'status', 'created_at', 'updated_at', 'id']

router.use(authenticate, resolveBranchContext)

// Central branches for dropdown (company-wide expense attribution)
router.get('/central', canView('branches'), async (req: Request, res: Response) => {
  try {
    const companyId = req.query.company_id as string || req.context?.company_id || ''
    if (!companyId) {
      sendError(res, 'company_id is required', 400)
      return
    }
    const companyIds = await getAccessibleCompanyIds(req.user?.id ?? '')
    requireCompanyAccess(companyId, companyIds)
    const centrals = await getCentralBranches(companyId)
    sendSuccess(res, centrals, 'Central branches retrieved')
  } catch (error: unknown) {
    await handleError(res, error, req, { action: 'get_central_branches' })
  }
})

router.get('/filter-options', canView('branches'), (req, res) => branchesController.getFilterOptions(req, res))
router.get('/minimal/active', canView('branches'), (req, res) => branchesController.minimalActive(req, res))
router.get('/search', canView('branches'), queryMiddleware({ allowedSortFields: sortFields }), (req, res) => branchesController.search(req, res))
router.get('/', canView('branches'), queryMiddleware({ allowedSortFields: sortFields }), (req, res) => branchesController.list(req, res))
router.get('/:id', canView('branches'), validateSchema(branchIdSchema), (req, res) => branchesController.getById(req, res))
router.post('/', canInsert('branches'), validateSchema(CreateBranchSchema), (req, res) => branchesController.create(req, res))
router.put('/:id', canUpdate('branches'), validateSchema(UpdateBranchSchema), (req, res) => branchesController.update(req, res))
router.delete('/:id', canDelete('branches'), validateSchema(branchIdSchema), (req, res) => branchesController.delete(req, res))
router.post('/bulk/update-status', canUpdate('branches'), validateSchema(BulkUpdateStatusSchema), (req, res) => branchesController.bulkUpdateStatus(req, res))

// Close branch permanently — NOT behind write-guard (see BRANCH_CLOSURE_DESIGN.md Note 2)
router.post('/:id/close', canDelete('branches'), validateSchema(branchIdSchema), (req, res) => branchesController.closeBranch(req, res))

export default router
