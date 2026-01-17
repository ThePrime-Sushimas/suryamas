/**
 * POS Transactions Controller
 */

import { Response } from 'express'
import { AuthRequest } from '../../../types/common.types'
import { posTransactionsService } from './pos-transactions.service'
import { sendSuccess, sendError } from '../../../utils/response.util'
import { logInfo } from '../../../config/logger'
import { jobsService } from '../../jobs'

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
      branches: req.query.branches as string, // comma-separated
      area: req.query.area as string,
      brand: req.query.brand as string,
      city: req.query.city as string,
      menuName: req.query.menuName as string,
      paymentMethods: req.query.paymentMethods as string, // comma-separated
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

export const exportToExcel = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.context?.company_id
    const userId = req.user?.id
    
    if (!companyId || !userId) {
      return sendError(res, 'Company ID and User ID required', 400)
    }

    const filters = {
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      salesNumber: req.query.salesNumber as string,
      billNumber: req.query.billNumber as string,
      branches: req.query.branches as string,
      area: req.query.area as string,
      brand: req.query.brand as string,
      city: req.query.city as string,
      menuName: req.query.menuName as string,
      paymentMethods: req.query.paymentMethods as string,
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

    // Create job
    const job = await jobsService.createJob({
      user_id: userId,
      company_id: companyId,
      type: 'export',
      name: 'POS Transactions Export',
      metadata: { companyId, filters }
    })

    // Trigger processing in background
    const { jobWorker } = await import('../../jobs')
    jobWorker.processJob(job.id).catch(error => {
      logInfo('Background job processing error', { job_id: job.id, error })
    })

    logInfo('PosTransactionsController export job created', { 
      job_id: job.id,
      company_id: companyId 
    })

    sendSuccess(res, { job_id: job.id }, 'Export job created successfully')
  } catch (error) {
    sendError(res, error instanceof Error ? error.message : 'Failed to create export job', 500)
  }
}
