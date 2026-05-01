import { Request, Response } from 'express'
import type { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import { handleError } from '../../../utils/error-handler.util'
import { settlementGroupService, SettlementGroupService } from './bank-settlement-group.service'
import type {
  createSettlementGroupSchema,
  getSettlementGroupByIdSchema,
  getSettlementGroupListSchema,
  undoSettlementGroupSchema,
  getSettlementGroupAggregatesSchema,
  getAvailableAggregatesSchema,
  getSuggestionsSchema,
} from './bank-settlement-group.schema'
import { logInfo } from '../../../config/logger'

export class SettlementGroupController {
  constructor(private readonly service: SettlementGroupService) {}

  async create(req: Request, res: Response): Promise<void> {
    try {
      const { body } = (req as ValidatedAuthRequest<typeof createSettlementGroupSchema>).validated
      const userId = req.user?.id
      const companyId = req.context?.company_id

      const result = await this.service.createSettlementGroup({
        companyId: companyId || '',
        bankStatementId: body.bankStatementId,
        aggregateIds: body.aggregateIds,
        notes: body.notes,
        overrideDifference: body.overrideDifference,
        userId,
      })

      logInfo('Settlement group created', { groupId: result.groupId })

      res.status(201).json({
        success: true,
        data: result,
        message: 'Settlement group berhasil dibuat',
      })
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_settlement_group' })
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { params } = (req as ValidatedAuthRequest<typeof getSettlementGroupByIdSchema>).validated
      const result = await this.service.getSettlementGroup(params.id)

      res.status(200).json({ success: true, data: result })
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_settlement_group' })
    }
  }

  async getList(req: Request, res: Response): Promise<void> {
    try {
      const { query } = (req as ValidatedAuthRequest<typeof getSettlementGroupListSchema>).validated

      const result = await this.service.listSettlementGroups({
        startDate: query.startDate,
        endDate: query.endDate,
        status: query.status as unknown as import('./bank-settlement-group.types').SettlementGroupStatus,
        search: query.search,
        limit: query.limit,
        offset: query.offset,
      })

      res.status(200).json({
        success: true,
        data: result.data,
        total: result.total,
      })
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_settlement_groups' })
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { params } = (req as ValidatedAuthRequest<typeof undoSettlementGroupSchema>).validated
      const userId = req.user?.id

      await this.service.deleteSettlementGroup(params.id, userId)
      logInfo('Settlement group deleted', { groupId: params.id })

      res.status(200).json({
        success: true,
        message: 'Settlement group berhasil dihapus',
      })
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_settlement_group' })
    }
  }

  async getAvailableAggregates(req: Request, res: Response): Promise<void> {
    try {
      const { query } = (req as ValidatedAuthRequest<typeof getAvailableAggregatesSchema>).validated

      const result = await this.service.getAvailableAggregates({
        startDate: query.startDate,
        endDate: query.endDate,
        bankAccountId: query.bankAccountId,
        search: query.search,
        limit: query.limit,
        offset: query.offset,
      })

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          page: Math.floor((query.offset || 0) / (query.limit || 100)) + 1,
          pageSize: query.limit || 100,
          totalPages: Math.ceil(result.total / (query.limit || 100)),
        },
      })
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_available_aggregates' })
    }
  }

  async getSettlementAggregates(req: Request, res: Response): Promise<void> {
    try {
      const { params } = (req as ValidatedAuthRequest<typeof getSettlementGroupAggregatesSchema>).validated
      const result = await this.service.getSettlementAggregates(params.id)

      res.status(200).json({ success: true, data: result })
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_settlement_aggregates' })
    }
  }

  async getSuggestedAggregates(req: Request, res: Response): Promise<void> {
    try {
      const { query } = (req as ValidatedAuthRequest<typeof getSuggestionsSchema>).validated

      const result = await this.service.getSuggestedAggregates(query.targetAmount, {
        tolerancePercent: query.tolerancePercent,
        maxAggregates: query.maxResults,
      })

      res.status(200).json({ success: true, data: result })
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_suggested_aggregates' })
    }
  }
}

export const settlementGroupController = new SettlementGroupController(settlementGroupService)
