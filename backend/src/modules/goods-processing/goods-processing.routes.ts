import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { requireWriteAccess } from '../../middleware/write-guard.middleware'
import { canView, canUpdate, canApprove, requireAnyPermission } from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { goodsProcessingController } from './goods-processing.controller'
import { ListQuerySchema, IdParamSchema, UpdateGoodsProcessingSchema, RejectSchema, BulkConfirmSchema, ResolveReturnSchema } from './goods-processing.schema'
import { PermissionService } from '../../services/permission.service'

PermissionService.registerModule('goods_processing', 'Barang Masuk / Goods Processing').catch(() => {})

const router = Router()

router.use(authenticate, resolveBranchContext)

// Static routes WAJIB sebelum /:id
router.get('/',              canView('goods_processing'),    validateSchema(ListQuerySchema),              (req, res) => goodsProcessingController.list(req, res))
router.post('/bulk-confirm', requireWriteAccess, canApprove('goods_processing'), validateSchema(BulkConfirmSchema), (req, res) => goodsProcessingController.bulkConfirm(req, res))

// Dynamic routes
router.get('/:id',                             canView('goods_processing'),    validateSchema(IdParamSchema),                (req, res) => goodsProcessingController.getById(req, res))
router.put('/:id',                             requireWriteAccess, canUpdate('goods_processing'),  validateSchema(UpdateGoodsProcessingSchema), (req, res) => goodsProcessingController.update(req, res))
router.post('/:id/start',                      requireWriteAccess, canUpdate('goods_processing'),  validateSchema(IdParamSchema),               (req, res) => goodsProcessingController.start(req, res))
router.post('/:id/reopen',                     requireWriteAccess, canApprove('goods_processing'), validateSchema(IdParamSchema),               (req, res) => goodsProcessingController.reopen(req, res))
router.post('/:id/unconfirm',                  requireWriteAccess, canApprove('goods_processing'), validateSchema(IdParamSchema),               (req, res) => goodsProcessingController.unconfirm(req, res))
router.post('/:id/confirm',                    requireWriteAccess, canApprove('goods_processing'), validateSchema(IdParamSchema),               (req, res) => goodsProcessingController.confirm(req, res))
router.post('/:id/reject',                     requireWriteAccess, canApprove('goods_processing'), validateSchema(RejectSchema),                (req, res) => goodsProcessingController.reject(req, res))
router.post('/:id/outputs/:outputId/resolve-return', requireWriteAccess, requireAnyPermission('goods_processing', ['approve', 'release']), validateSchema(ResolveReturnSchema), (req, res) => goodsProcessingController.resolveReturn(req, res))
router.patch('/:id/inputs/:inputId/confirm', requireWriteAccess, canUpdate('goods_processing'), (req, res) => goodsProcessingController.confirmInput(req, res))

export default router