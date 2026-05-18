import type { Request, Response } from 'express'
import { marketplacePoService } from './marketplace-po.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import type { OwnerCreditCardWithSettlement } from './marketplace-po.types'
import type {
  ownerCreditCardListSchema,
  ownerCreditCardIdSchema,
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
} from './marketplace-po.schema'
import type { unreconciledStatementsSchema } from './marketplace-po.schema'

type UnreconciledStatementsReq = ValidatedAuthRequest<typeof unreconciledStatementsSchema>
type ListSessionsReq = ValidatedAuthRequest<typeof listMarketplaceSessionsSchema>
type SessionIdReq = ValidatedAuthRequest<typeof marketplaceSessionIdSchema>
type CreateSessionReq = ValidatedAuthRequest<typeof createMarketplaceSessionSchema>
type UpdateSessionReq = ValidatedAuthRequest<typeof updateMarketplaceSessionSchema>
type CancelSessionReq = ValidatedAuthRequest<typeof cancelMarketplaceSessionSchema>
type OrderSessionReq = ValidatedAuthRequest<typeof orderMarketplaceSessionSchema>
type ShipSessionReq = ValidatedAuthRequest<typeof shipMarketplaceSessionSchema>
type ReceiveSessionReq = ValidatedAuthRequest<typeof receiveMarketplaceSessionSchema>
type SettleSessionReq = ValidatedAuthRequest<typeof settleMarketplaceSessionSchema>
type BulkSettleSessionReq = ValidatedAuthRequest<typeof bulkSettleMarketplaceSessionSchema>

type ListCcReq = ValidatedAuthRequest<typeof ownerCreditCardListSchema>
type CcIdReq = ValidatedAuthRequest<typeof ownerCreditCardIdSchema>
type CreateCcReq = ValidatedAuthRequest<typeof createOwnerCreditCardSchema>
type UpdateCcReq = ValidatedAuthRequest<typeof updateOwnerCreditCardSchema>
type UploadAttachmentReq = ValidatedAuthRequest<typeof uploadMarketplaceAttachmentSchema>
type DeleteAttachmentReq = ValidatedAuthRequest<typeof deleteMarketplaceAttachmentSchema>
type PendingPoLinesReq = ValidatedAuthRequest<typeof pendingPoLinesSchema>

export class MarketplacePoController {
  listPendingPoLines = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const { query } = (req as PendingPoLinesReq).validated
      const rows = await marketplacePoService.listPendingPoLines(companyId, {
        platform: query.platform,
        branch_id: query.branch_id,
      })
      sendSuccess(res, rows, 'Pending PO lines retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_pending_po_lines' })
    }
  }
  listUnreconciledStatements = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const { query } = (req as UnreconciledStatementsReq).validated
      const rows = await marketplacePoService.listUnreconciledStatements(
        companyId,
        query.bank_account_id,
        { date_from: query.date_from, date_to: query.date_to },
      )
      sendSuccess(res, rows, 'Unreconciled statements retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_unreconciled_statements' })
    }
  }
  listSessions = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const { query } = (req as ListSessionsReq).validated
      const page = query.page
      const limit = query.limit

      const filter = {
        platform: query.platform,
        status: query.status,
        branch_id: query.branch_id,
        cc_id: query.cc_id,
        date_from: query.date_from,
        date_to: query.date_to,
        search: query.search,
      }

      const result = await marketplacePoService.list(companyId, filter, { page, limit })
      sendSuccess(
        res,
        result.data,
        'Marketplace sessions retrieved',
        200,
        {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
          hasNext: page * limit < result.total,
          hasPrev: page > 1,
        },
      )
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_marketplace_sessions' })
    }
  }

  getSessionDetail = async (req: Request, res: Response) => {
    try {
      const { id } = (req as SessionIdReq).validated.params
      const companyId = req.context?.company_id ?? ''
      const detail = await marketplacePoService.getSessionDetail(id, companyId)
      sendSuccess(res, detail, 'Marketplace session detail')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_marketplace_session', id: req.params.id })
    }
  }

  createSession = async (req: Request, res: Response) => {
    try {
      const { body } = (req as CreateSessionReq).validated
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const session = await marketplacePoService.createSession(companyId, userId, body)
      sendSuccess(res, session, 'Marketplace session created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_marketplace_session' })
    }
  }

  updateSession = async (req: Request, res: Response) => {
    try {
      const { id } = (req as UpdateSessionReq).validated.params
      const { body } = (req as UpdateSessionReq).validated
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const session = await marketplacePoService.updateSessionHeader(companyId, userId, id, body)
      sendSuccess(res, session, 'Marketplace session updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_marketplace_session', id: req.params.id })
    }
  }

  cancelSession = async (req: Request, res: Response) => {
    try {
      const { id } = (req as CancelSessionReq).validated.params
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const session = await marketplacePoService.cancelSession(companyId, userId, id)
      sendSuccess(res, session, 'Marketplace session cancelled')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'cancel_marketplace_session', id: req.params.id })
    }
  }

  orderSession = async (req: Request, res: Response) => {
    try {
      const { id } = (req as OrderSessionReq).validated.params
      const body = (req as OrderSessionReq).validated.body ?? {}
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const employeeId = req.context?.employee_id ?? ''
      const detail = await marketplacePoService.orderSession(companyId, userId, employeeId, id, body)
      sendSuccess(res, detail, 'Marketplace session ordered')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'order_marketplace_session', id: req.params.id })
    }
  }

  shipSession = async (req: Request, res: Response) => {
    try {
      const { id } = (req as ShipSessionReq).validated.params
      const body = (req as ShipSessionReq).validated.body
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const detail = await marketplacePoService.shipSession(companyId, userId, id, body)
      sendSuccess(res, detail, 'Marketplace session shipped')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'ship_marketplace_session', id: req.params.id })
    }
  }

  receiveSession = async (req: Request, res: Response) => {
    try {
      const { id } = (req as ReceiveSessionReq).validated.params
      const body = (req as ReceiveSessionReq).validated.body ?? {}
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const employeeId = req.context?.employee_id ?? ''
      const detail = await marketplacePoService.receiveSession(companyId, userId, employeeId, id, body)
      sendSuccess(res, detail, 'Marketplace session received')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'receive_marketplace_session', id: req.params.id })
    }
  }

  settleSession = async (req: Request, res: Response) => {
    try {
      const { id } = (req as SettleSessionReq).validated.params
      const body = (req as SettleSessionReq).validated.body
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const employeeId = req.context?.employee_id ?? ''
      const detail = await marketplacePoService.settleSession(companyId, userId, employeeId, id, body)
      sendSuccess(res, detail, 'Marketplace session settled')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'settle_marketplace_session', id: req.params.id })
    }
  }

  listOwnerCreditCards = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const { query } = (req as ListCcReq).validated
      const rows: OwnerCreditCardWithSettlement[] = await marketplacePoService.listOwnerCreditCards(companyId, query)
      sendSuccess(res, rows, 'Owner credit cards retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_owner_credit_cards' })
    }
  }

  createOwnerCreditCard = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const { body } = (req as CreateCcReq).validated
      const row: OwnerCreditCardWithSettlement = await marketplacePoService.createOwnerCreditCard(companyId, userId, body)
      sendSuccess(res, row, 'Owner credit card created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_owner_credit_card' })
    }
  }

  updateOwnerCreditCard = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const { id } = (req as CcIdReq).validated.params
      const { body } = (req as UpdateCcReq).validated
      const row: OwnerCreditCardWithSettlement = await marketplacePoService.updateOwnerCreditCard(companyId, userId, id, body)
      sendSuccess(res, row, 'Owner credit card updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_owner_credit_card', id: req.params.id })
    }
  }

  deleteOwnerCreditCard = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const { id } = (req as CcIdReq).validated.params
      const row = await marketplacePoService.deleteOwnerCreditCard(companyId, userId, id)
      sendSuccess(res, row, 'Owner credit card deactivated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_owner_credit_card', id: req.params.id })
    }
  }

  uploadAttachment = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as UploadAttachmentReq).validated
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''

      const file = req.file
      if (!file) {
        res.status(400).json({ success: false, message: 'No file uploaded' })
        return
      }

      const attachment = await marketplacePoService.uploadAttachment(
        companyId,
        userId,
        params.id,
        file,
        body.file_type,
      )
      sendSuccess(res, attachment, 'Attachment uploaded', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'upload_marketplace_attachment', id: req.params.id })
    }
  }

  deleteAttachment = async (req: Request, res: Response) => {
    try {
      const { params } = (req as DeleteAttachmentReq).validated
      const companyId = req.context?.company_id ?? ''
      await marketplacePoService.deleteAttachment(companyId, params.id, params.attachmentId)
      sendSuccess(res, null, 'Attachment deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_marketplace_attachment', id: req.params.id })
    }
  }

  getSettlementSummary = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const summary = await marketplacePoService.getSettlementSummary(companyId)
      sendSuccess(res, summary, 'Settlement summary fetched')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_settlement_summary' })
    }
  }

  createBulkSettlement = async (req: Request, res: Response) => {
    try {
      const { body } = (req as BulkSettleSessionReq).validated
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const employeeId = req.context?.employee_id ?? ''
      const settlement = await marketplacePoService.createBulkSettlement(companyId, userId, employeeId, body)
      sendSuccess(res, settlement, 'Bulk settlement created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_bulk_settlement' })
    }
  }
}

export const marketplacePoController = new MarketplacePoController()