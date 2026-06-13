import type { Request, Response } from 'express'
import { marketplacePoService } from './marketplace-po.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import type { OwnerCreditCardWithSettlement } from './marketplace-po.types'
import { getAccessibleBranchIds, getAccessibleCompanyIds, resolveContextCompanyId } from '../../utils/branch-access.util'

async function mpScope(req: Request) {
  const userId = req.user?.id ?? ''
  const [branchIds, companyIds] = await Promise.all([
    getAccessibleBranchIds(userId),
    getAccessibleCompanyIds(userId),
  ])
  return {
    userId,
    branchIds,
    companyIds,
    companyId: resolveContextCompanyId(req.context?.company_id ?? '', companyIds),
  }
}
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
  settleMarketplaceSessionSchema,
  uploadMarketplaceAttachmentSchema,
  deleteMarketplaceAttachmentSchema,
  pendingPoLinesSchema,
  bulkSettleMarketplaceSessionSchema,
} from './marketplace-po.schema'
import type { unreconciledStatementsSchema } from './marketplace-po.schema'
import type {
  cancelOrderedSessionSchema,
  cancelShippedSessionSchema,
  cancelSessionLineSchema,
  marketplaceSessionLineIdSchema,
} from './marketplace-po.schema'

type CancelOrderedReq = ValidatedAuthRequest<typeof cancelOrderedSessionSchema>
type CancelShippedReq = ValidatedAuthRequest<typeof cancelShippedSessionSchema>
type CancelSessionLineReq = ValidatedAuthRequest<typeof cancelSessionLineSchema>
type SessionLineIdReq = ValidatedAuthRequest<typeof marketplaceSessionLineIdSchema>
type UnreconciledStatementsReq = ValidatedAuthRequest<typeof unreconciledStatementsSchema>
type ListSessionsReq = ValidatedAuthRequest<typeof listMarketplaceSessionsSchema>
type SessionIdReq = ValidatedAuthRequest<typeof marketplaceSessionIdSchema>
type CreateSessionReq = ValidatedAuthRequest<typeof createMarketplaceSessionSchema>
type UpdateSessionReq = ValidatedAuthRequest<typeof updateMarketplaceSessionSchema>
type CancelSessionReq = ValidatedAuthRequest<typeof cancelMarketplaceSessionSchema>
type OrderSessionReq = ValidatedAuthRequest<typeof orderMarketplaceSessionSchema>
type ShipSessionReq = ValidatedAuthRequest<typeof shipMarketplaceSessionSchema>
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
      const { branchIds } = await mpScope(req)
      const { query } = (req as PendingPoLinesReq).validated
      const rows = await marketplacePoService.listPendingPoLines(branchIds, {
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
      const { companyIds } = await mpScope(req)
      const { query } = (req as UnreconciledStatementsReq).validated
      const rows = await marketplacePoService.listUnreconciledStatements(
        companyIds,
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
      const { companyIds } = await mpScope(req)
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

      const result = await marketplacePoService.list(companyIds, filter, { page, limit })
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
      const { companyIds, branchIds } = await mpScope(req)
      const detail = await marketplacePoService.getSessionDetail(id, companyIds, branchIds)
      sendSuccess(res, detail, 'Marketplace session detail')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_marketplace_session', id: req.params.id })
    }
  }
  cancelOrderedSession = async (req: Request, res: Response) => {
    try {
      const { id } = (req as CancelOrderedReq).validated.params
      const { body } = (req as CancelOrderedReq).validated
      const { companyIds, branchIds, userId } = await mpScope(req)
      const detail = await marketplacePoService.cancelOrderedSession(companyIds, branchIds, userId, id, body)
      sendSuccess(res, detail, 'Marketplace session cancelled (was ORDERED)')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'cancel_ordered_session', id: req.params.id })
    }
  }
  postReceiveJournal = async (req: Request, res: Response) => {
    try {
      const { id } = (req as any).validated.params
      const body = (req as any).validated.body ?? {}
      const { companyIds, branchIds, userId } = await mpScope(req)
      const detail = await marketplacePoService.postReceiveJournal(companyIds, branchIds, userId, id, body)
      sendSuccess(res, detail, 'Journal receive berhasil di-post')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'post_receive_journal', id: req.params.id })
    }
  }
  cancelShippedSession = async (req: Request, res: Response) => {
    try {
      const { id } = (req as CancelShippedReq).validated.params
      const { body } = (req as CancelShippedReq).validated
      const { companyIds, branchIds, userId } = await mpScope(req)
      const detail = await marketplacePoService.cancelShippedSession(companyIds, branchIds, userId, id, body)
      sendSuccess(res, detail, 'Marketplace session cancelled (was SHIPPED)')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'cancel_shipped_session', id: req.params.id })
    }
  }
  createSession = async (req: Request, res: Response) => {
    try {
      const { body } = (req as CreateSessionReq).validated
      const { companyIds, branchIds, userId } = await mpScope(req)
      const session = await marketplacePoService.createSession(companyIds, branchIds, userId, body)
      sendSuccess(res, session, 'Marketplace session created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_marketplace_session' })
    }
  }

  updateSession = async (req: Request, res: Response) => {
    try {
      const { id } = (req as UpdateSessionReq).validated.params
      const { body } = (req as UpdateSessionReq).validated
      const { companyIds, branchIds, userId } = await mpScope(req)
      const session = await marketplacePoService.updateSessionHeader(companyIds, branchIds, userId, id, body)
      sendSuccess(res, session, 'Marketplace session updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_marketplace_session', id: req.params.id })
    }
  }

  removeLineFromDraftSession = async (req: Request, res: Response) => {
    try {
      const { id, lineId } = (req as SessionLineIdReq).validated.params
      const { companyIds, branchIds, userId } = await mpScope(req)
      const detail = await marketplacePoService.removeLineFromDraftSession(
        companyIds,
        branchIds,
        userId,
        id,
        lineId,
      )
      sendSuccess(res, detail, 'Item berhasil dihapus dari session')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'remove_session_line', id: req.params.id })
    }
  }

  cancelLineFromShippedSession = async (req: Request, res: Response) => {
    try {
      const { id, lineId } = (req as CancelSessionLineReq).validated.params
      const { body } = (req as CancelSessionLineReq).validated
      const { companyIds, branchIds, userId } = await mpScope(req)
      const detail = await marketplacePoService.cancelLineFromShippedSession(
        companyIds,
        branchIds,
        userId,
        id,
        lineId,
        body,
      )
      sendSuccess(res, detail, 'Item berhasil dibatalkan')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'cancel_session_line', id: req.params.id })
    }
  }

  cancelSession = async (req: Request, res: Response) => {
    try {
      const { id } = (req as CancelSessionReq).validated.params
      const { companyIds, branchIds, userId } = await mpScope(req)
      const session = await marketplacePoService.cancelSession(companyIds, branchIds, userId, id)
      sendSuccess(res, session, 'Marketplace session cancelled')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'cancel_marketplace_session', id: req.params.id })
    }
  }

  orderSession = async (req: Request, res: Response) => {
    try {
      const { id } = (req as OrderSessionReq).validated.params
      const body = (req as OrderSessionReq).validated.body ?? {}
      const { companyIds, branchIds, userId } = await mpScope(req)
      const detail = await marketplacePoService.orderSession(companyIds, branchIds, userId, id, body)
      sendSuccess(res, detail, 'Marketplace session ordered')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'order_marketplace_session', id: req.params.id })
    }
  }

  shipSession = async (req: Request, res: Response) => {
    try {
      const { id } = (req as ShipSessionReq).validated.params
      const body = (req as ShipSessionReq).validated.body
      const { companyIds, branchIds, userId } = await mpScope(req)
      const detail = await marketplacePoService.shipSession(companyIds, branchIds, userId, id, body)
      sendSuccess(res, detail, 'Marketplace session shipped')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'ship_marketplace_session', id: req.params.id })
    }
  }

  settleSession = async (req: Request, res: Response) => {
    try {
      const { id } = (req as SettleSessionReq).validated.params
      const body = (req as SettleSessionReq).validated.body
      const { companyIds, branchIds, userId } = await mpScope(req)
      const detail = await marketplacePoService.settleSession(companyIds, branchIds, userId, id, body)
      sendSuccess(res, detail, 'Marketplace session settled')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'settle_marketplace_session', id: req.params.id })
    }
  }

  listOwnerCreditCards = async (req: Request, res: Response) => {
    try {
      const { companyIds } = await mpScope(req)
      const { query } = (req as ListCcReq).validated
      const rows: OwnerCreditCardWithSettlement[] = await marketplacePoService.listOwnerCreditCards(companyIds, query)
      sendSuccess(res, rows, 'Owner credit cards retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_owner_credit_cards' })
    }
  }

  createOwnerCreditCard = async (req: Request, res: Response) => {
    try {
      const { companyId, companyIds, userId } = await mpScope(req)
      const { body } = (req as CreateCcReq).validated
      const row: OwnerCreditCardWithSettlement = await marketplacePoService.createOwnerCreditCard(companyId, companyIds, userId, body)
      sendSuccess(res, row, 'Owner credit card created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_owner_credit_card' })
    }
  }

  updateOwnerCreditCard = async (req: Request, res: Response) => {
    try {
      const { companyId, companyIds, userId } = await mpScope(req)
      const { id } = (req as CcIdReq).validated.params
      const { body } = (req as UpdateCcReq).validated
      const row: OwnerCreditCardWithSettlement = await marketplacePoService.updateOwnerCreditCard(companyId, companyIds, userId, id, body)
      sendSuccess(res, row, 'Owner credit card updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_owner_credit_card', id: req.params.id })
    }
  }

  deleteOwnerCreditCard = async (req: Request, res: Response) => {
    try {
      const { companyId, companyIds, userId } = await mpScope(req)
      const { id } = (req as CcIdReq).validated.params
      const row = await marketplacePoService.deleteOwnerCreditCard(companyId, companyIds, userId, id)
      sendSuccess(res, row, 'Owner credit card deactivated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_owner_credit_card', id: req.params.id })
    }
  }

  uploadAttachment = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as UploadAttachmentReq).validated
      const { companyIds, branchIds, userId } = await mpScope(req)

      const file = req.file
      if (!file) {
        res.status(400).json({
          success: false,
          message:
            'File tidak diterima. Gunakan JPG, PNG, WEBP, PDF, atau HEIC (maks. 10MB).',
        })
        return
      }

      const attachment = await marketplacePoService.uploadAttachment(
        companyIds,
        branchIds,
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
      const { companyIds, branchIds } = await mpScope(req)
      await marketplacePoService.deleteAttachment(companyIds, branchIds, params.id, params.attachmentId)
      sendSuccess(res, null, 'Attachment deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_marketplace_attachment', id: req.params.id })
    }
  }

  getSettlementSummary = async (req: Request, res: Response) => {
    try {
      const { companyIds } = await mpScope(req)
      const summary = await marketplacePoService.getSettlementSummary(companyIds)
      sendSuccess(res, summary, 'Settlement summary fetched')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_settlement_summary' })
    }
  }

  getPendingCcOwnerGeneralInvoicePayments = async (req: Request, res: Response) => {
    try {
      const { companyIds } = await mpScope(req)
      const data = await marketplacePoService.getPendingCcOwnerGeneralInvoicePayments(companyIds)
      sendSuccess(res, data, 'Pending CC owner general invoice payments fetched')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_pending_cc_owner_gi_payments' })
    }
  }

  createBulkSettlement = async (req: Request, res: Response) => {
    try {
      const { body } = (req as BulkSettleSessionReq).validated
      const { companyIds, branchIds, userId } = await mpScope(req)
      const settlement = await marketplacePoService.createBulkSettlement(companyIds, branchIds, userId, body)
      sendSuccess(res, settlement, 'Bulk settlement created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_bulk_settlement' })
    }
  }
}

export const marketplacePoController = new MarketplacePoController()
