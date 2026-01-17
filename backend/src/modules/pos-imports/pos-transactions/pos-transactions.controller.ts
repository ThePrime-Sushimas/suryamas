/**
 * POS Transactions Controller
 */

import { Response } from 'express'
import { AuthRequest } from '../../../types/common.types'
import { posTransactionsService } from './pos-transactions.service'
import { sendSuccess, sendError } from '../../../utils/response.util'
import { logInfo } from '../../../config/logger'

export const list = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.context?.company_id
    if (!companyId) {
      return sendError(res, 'Company ID required', 400)
    }

    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 50

    const filters = {
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      salesNumber: req.query.salesNumber as string,
      billNumber: req.query.billNumber as string,
      branch: req.query.branch as string,
      area: req.query.area as string,
      brand: req.query.brand as string,
      city: req.query.city as string,
      menuName: req.query.menuName as string,
      regularMemberName: req.query.regularMemberName as string,
      customerName: req.query.customerName as string,
      visitPurpose: req.query.visitPurpose as string,
      salesType: req.query.salesType as string,
      menuCategory: req.query.menuCategory as string,
      menuCategoryDetail: req.query.menuCategoryDetail as string,
      menuCode: req.query.menuCode as string,
      customMenuName: req.query.customMenuName as string,
      tableSection: req.query.tableSection as string,
      tableName: req.query.tableName as string
    }

    const result = await posTransactionsService.list(companyId, { page, limit }, filters)

    logInfo('PosTransactionsController list success', { 
      company_id: companyId, 
      count: result.data.length,
      total: result.total 
    })

    sendSuccess(res, result, 'Transactions retrieved successfully')
  } catch (error) {
    sendError(res, error instanceof Error ? error.message : 'Failed to fetch transactions', 500)
  }
}
