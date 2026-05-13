import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { upload } from '../../middleware/upload.middleware'
import { goodsReceiptsController } from './goods-receipts.controller'
import { createGoodsReceiptSchema, updateGoodsReceiptSchema, confirmGoodsReceiptSchema, goodsReceiptIdSchema, goodsReceiptListSchema, pendingQtySchema, attachmentParamsSchema, createAttachmentSchema, deleteAttachmentSchema } from './goods-receipts.schema'
import { PermissionService } from '../../services/permission.service'

PermissionService.registerModule('goods_receipts', 'Goods Receipt / Penerimaan Barang').catch((err) => {
  console.error('Failed to register goods_receipts module:', err instanceof Error ? err.message : err)
})

const router = Router()

router.use(authenticate, resolveBranchContext)

router.get('/', canView('goods_receipts'), validateSchema(goodsReceiptListSchema), (req, res) => goodsReceiptsController.list(req, res))
router.get('/pending-qty', canView('goods_receipts'), validateSchema(pendingQtySchema), (req, res) => goodsReceiptsController.pendingQty(req, res))
router.post('/', canInsert('goods_receipts'), validateSchema(createGoodsReceiptSchema), (req, res) => goodsReceiptsController.create(req, res))
router.get('/:id', canView('goods_receipts'), validateSchema(goodsReceiptIdSchema), (req, res) => goodsReceiptsController.getById(req, res))
router.put('/:id', canUpdate('goods_receipts'), validateSchema(updateGoodsReceiptSchema), (req, res) => goodsReceiptsController.update(req, res))
router.post('/:id/confirm', canUpdate('goods_receipts'), validateSchema(confirmGoodsReceiptSchema), (req, res) => goodsReceiptsController.confirm(req, res))
router.delete('/:id', canDelete('goods_receipts'), validateSchema(goodsReceiptIdSchema), (req, res) => goodsReceiptsController.delete(req, res))

// Attachment routes
router.get('/:id/attachments', canView('goods_receipts'), validateSchema(attachmentParamsSchema), (req, res) => goodsReceiptsController.listAttachments(req, res))
router.post('/:id/attachments', canInsert('goods_receipts'), upload.single('file'), validateSchema(createAttachmentSchema), (req, res) => goodsReceiptsController.uploadAttachment(req, res))
router.delete('/:id/attachments/:attachmentId', canDelete('goods_receipts'), validateSchema(deleteAttachmentSchema), (req, res) => goodsReceiptsController.deleteAttachment(req, res))

export default router
