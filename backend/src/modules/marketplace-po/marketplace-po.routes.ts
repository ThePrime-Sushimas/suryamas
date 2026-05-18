import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { upload } from '../../middleware/upload.middleware'
import { PermissionService } from '../../services/permission.service'
import { marketplacePoController } from './marketplace-po.controller'
import {
  ownerCreditCardIdSchema,
  ownerCreditCardListSchema,
  createOwnerCreditCardSchema,
  updateOwnerCreditCardSchema,
  listMarketplaceSessionsSchema,
  marketplaceSessionIdSchema,
  createMarketplaceSessionSchema,
  updateMarketplaceSessionSchema,
  cancelMarketplaceSessionSchema,
  orderMarketplaceSessionSchema,
  shipMarketplaceSessionSchema,
  receiveMarketplaceSessionSchema,
  settleMarketplaceSessionSchema,
  uploadMarketplaceAttachmentSchema,
  deleteMarketplaceAttachmentSchema,
  pendingPoLinesSchema,
  bulkSettleMarketplaceSessionSchema,
  cancelOrderedSessionSchema,
  cancelShippedSessionSchema,
} from './marketplace-po.schema'
import { unreconciledStatementsSchema } from './marketplace-po.schema'

PermissionService.registerModule('marketplace_po', 'Marketplace PO / Checkout (Shopee & Tokopedia)').catch((err) => {
  console.error('Failed to register marketplace_po module:', err instanceof Error ? err.message : err)
})

PermissionService.registerModule('owner_credit_cards', 'Owner Credit Cards').catch((err) => {
  console.error('Failed to register owner_credit_cards module:', err instanceof Error ? err.message : err)
})

PermissionService.registerModule('cc_owner_settlements', 'CC Owner Settlements / Pelunasan CC').catch((err) => {
  console.error('Failed to register cc_owner_settlements module:', err instanceof Error ? err.message : err)
})


const router = Router()
router.use(authenticate, resolveBranchContext)

router.get('/owner-credit-cards', canView('owner_credit_cards'), validateSchema(ownerCreditCardListSchema), (req, res) => marketplacePoController.listOwnerCreditCards(req, res))
router.post('/owner-credit-cards', canInsert('owner_credit_cards'), validateSchema(createOwnerCreditCardSchema), (req, res) => marketplacePoController.createOwnerCreditCard(req, res))
router.put('/owner-credit-cards/:id', canUpdate('owner_credit_cards'), validateSchema(updateOwnerCreditCardSchema), (req, res) => marketplacePoController.updateOwnerCreditCard(req, res))
router.delete('/owner-credit-cards/:id', canDelete('owner_credit_cards'), validateSchema(ownerCreditCardIdSchema), (req, res) => marketplacePoController.deleteOwnerCreditCard(req, res))

router.get('/marketplace-sessions', canView('marketplace_po'), validateSchema(listMarketplaceSessionsSchema), (req, res) => marketplacePoController.listSessions(req, res))
router.get('/marketplace-sessions/pending-po-lines', canView('marketplace_po'), validateSchema(pendingPoLinesSchema), (req, res) => marketplacePoController.listPendingPoLines(req, res))
router.get('/marketplace-sessions/:id', canView('marketplace_po'), validateSchema(marketplaceSessionIdSchema), (req, res) => marketplacePoController.getSessionDetail(req, res))
router.post('/marketplace-sessions', canInsert('marketplace_po'), validateSchema(createMarketplaceSessionSchema), (req, res) => marketplacePoController.createSession(req, res))
router.put('/marketplace-sessions/:id', canUpdate('marketplace_po'), validateSchema(updateMarketplaceSessionSchema), (req, res) => marketplacePoController.updateSession(req, res))
router.delete('/marketplace-sessions/:id', canDelete('marketplace_po'), validateSchema(cancelMarketplaceSessionSchema), (req, res) => marketplacePoController.cancelSession(req, res))

router.post('/marketplace-sessions/:id/attachments', canUpdate('marketplace_po'), upload.single('file'), validateSchema(uploadMarketplaceAttachmentSchema), (req, res) => marketplacePoController.uploadAttachment(req, res))
router.delete('/marketplace-sessions/:id/attachments/:attachmentId', canUpdate('marketplace_po'), validateSchema(deleteMarketplaceAttachmentSchema), (req, res) => marketplacePoController.deleteAttachment(req, res))

router.post('/marketplace-sessions/:id/order', canUpdate('marketplace_po'), validateSchema(orderMarketplaceSessionSchema), (req, res) => marketplacePoController.orderSession(req, res))
router.post('/marketplace-sessions/:id/shipments',canUpdate('marketplace_po'), validateSchema(shipMarketplaceSessionSchema), (req, res) => marketplacePoController.shipSession(req, res))
router.post('/marketplace-sessions/:id/receive', canUpdate('marketplace_po'), validateSchema(receiveMarketplaceSessionSchema), (req, res) => marketplacePoController.receiveSession(req, res))
router.post('/marketplace-sessions/:id/settle', canUpdate('marketplace_po'), validateSchema(settleMarketplaceSessionSchema), (req, res) => marketplacePoController.settleSession(req, res))
router.get(
  '/marketplace-settlements/unreconciled-statements',
  canView('cc_owner_settlements'),
  validateSchema(unreconciledStatementsSchema),
  (req, res) => marketplacePoController.listUnreconciledStatements(req, res),
)
// CC Owner Settlements
router.get('/marketplace-settlements/summary', canView('cc_owner_settlements'), (req, res) => marketplacePoController.getSettlementSummary(req, res))
router.post('/marketplace-settlements/bulk', canUpdate('cc_owner_settlements'), validateSchema(bulkSettleMarketplaceSessionSchema), (req, res) => marketplacePoController.createBulkSettlement(req, res))

// Cancel session with reason
router.post(
  '/marketplace-sessions/:id/cancel-ordered',
  canUpdate('marketplace_po'),
  validateSchema(cancelOrderedSessionSchema),
  (req, res) => marketplacePoController.cancelOrderedSession(req, res),
)

router.post(
  '/marketplace-sessions/:id/cancel-shipped',
  canUpdate('marketplace_po'),
  validateSchema(cancelShippedSessionSchema),
  (req, res) => marketplacePoController.cancelShippedSession(req, res),
)

export default router
