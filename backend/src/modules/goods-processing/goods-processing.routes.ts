import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { requireWriteAccess } from '../../middleware/write-guard.middleware'
import { canView, canUpdate, canApprove } from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { goodsProcessingController } from './goods-processing.controller'
import { ListQuerySchema, IdParamSchema, UpdateGoodsProcessingSchema, RejectSchema, BulkConfirmSchema } from './goods-processing.schema'
import { PermissionService } from '../../services/permission.service'

PermissionService.registerModule('goods_processing', 'Barang Masuk / Goods Processing').catch(() => {})

const router = Router()

router.use(authenticate, resolveBranchContext)

// Static routes WAJIB sebelum /:id
router.get('/', canView('goods_processing'), validateSchema(ListQuerySchema), (req, res) => goodsProcessingController.list(req, res))
router.post('/bulk-confirm', requireWriteAccess, canApprove('goods_processing'), validateSchema(BulkConfirmSchema), (req, res) => goodsProcessingController.bulkConfirm(req, res))
router.post('/bulk-confirm-lines', requireWriteAccess, canApprove('goods_processing'), (req, res) => goodsProcessingController.bulkConfirmLines(req, res))

// Per-line actions
router.post('/lines/:lineId/start', requireWriteAccess, canUpdate('goods_processing'), (req, res) => goodsProcessingController.startLine(req, res))
router.post('/lines/:lineId/submit-qc', requireWriteAccess, canUpdate('goods_processing'), (req, res) => goodsProcessingController.submitLineQc(req, res))
router.post('/lines/:lineId/confirm', requireWriteAccess, canApprove('goods_processing'), (req, res) => goodsProcessingController.confirmLine(req, res))
router.post('/lines/:lineId/reject', requireWriteAccess, canApprove('goods_processing'), (req, res) => goodsProcessingController.rejectLine(req, res))

// Dynamic routes
router.get('/:id', canView('goods_processing'), validateSchema(IdParamSchema), (req, res) => goodsProcessingController.getById(req, res))
router.put('/:id', requireWriteAccess, canUpdate('goods_processing'), validateSchema(UpdateGoodsProcessingSchema), (req, res) => goodsProcessingController.update(req, res))
router.post('/:id/start', requireWriteAccess, canUpdate('goods_processing'), validateSchema(IdParamSchema), (req, res) => goodsProcessingController.start(req, res))
router.post('/:id/submit-qc', requireWriteAccess, canUpdate('goods_processing'), validateSchema(IdParamSchema), (req, res) => goodsProcessingController.submitQc(req, res))
router.post('/:id/confirm', requireWriteAccess, canApprove('goods_processing'), validateSchema(IdParamSchema), (req, res) => goodsProcessingController.confirm(req, res))
router.post('/:id/reject', requireWriteAccess, canApprove('goods_processing'), validateSchema(RejectSchema), (req, res) => goodsProcessingController.reject(req, res))

export default router
