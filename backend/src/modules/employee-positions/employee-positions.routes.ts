import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { requireWriteAccess } from '../../middleware/write-guard.middleware'
import { canView, canUpdate } from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { employeePositionsController } from './employee-positions.controller'
import { assignPositionSchema, removePositionSchema, setPrimarySchema, listEmployeePositionsSchema } from './employee-positions.schema'

const router = Router({ mergeParams: true })

router.use(authenticate, resolveBranchContext)

// GET /api/v1/employees/:employeeId/positions
router.get('/', canView('employees'), validateSchema(listEmployeePositionsSchema), (req, res) => employeePositionsController.list(req, res))

// POST /api/v1/employees/:employeeId/positions
router.post('/', requireWriteAccess, canUpdate('employees'), validateSchema(assignPositionSchema), (req, res) => employeePositionsController.assign(req, res))

// DELETE /api/v1/employees/:employeeId/positions/:positionId
router.delete('/:positionId', requireWriteAccess, canUpdate('employees'), validateSchema(removePositionSchema), (req, res) => employeePositionsController.remove(req, res))

// PUT /api/v1/employees/:employeeId/positions/:positionId/primary
router.put('/:positionId/primary', requireWriteAccess, canUpdate('employees'), validateSchema(setPrimarySchema), (req, res) => employeePositionsController.setPrimary(req, res))

export default router
