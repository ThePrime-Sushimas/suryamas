import { Response } from 'express'
import { bankVouchersService } from './bank-vouchers.service'
import { sendSuccess, sendError } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { logInfo } from '../../config/logger'
import type { AuthenticatedRequest } from '../../types/request.types'
import type { BankVoucherPreviewQuery, BankVoucherSummaryQuery } from './bank-vouchers.schema'

export class BankVouchersController {

  // ============================================
  // GET /bank-vouchers/health
  // ============================================

  async health(_req: AuthenticatedRequest, res: Response): Promise<void> {
    sendSuccess(res, { status: 'ok' }, 'Bank vouchers service is healthy')
  }

  // ============================================
  // GET /bank-vouchers/preview
  // ============================================

  async preview(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const company_id = req.context?.company_id
      if (!company_id) {
        sendError(res, 'Company context required', 400)
        return
      }

      const query = req.query as unknown as BankVoucherPreviewQuery

      logInfo('Bank voucher preview requested', {
        company_id,
        branch_id: query.branch_id,
        period: `${query.period_month}/${query.period_year}`,
        user_id: req.user?.id,
      })

      const result = await bankVouchersService.getPreview({
        company_id,
        branch_id: query.branch_id,
        period_month: query.period_month,
        period_year: query.period_year,
        bank_account_id: query.bank_account_id,
        voucher_type: query.voucher_type,
      })

      sendSuccess(res, result, 'Bank voucher preview retrieved')
    } catch (error) {
      handleError(res, error)
    }
  }

  // ============================================
  // GET /bank-vouchers/summary
  // ============================================

  async summary(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const company_id = req.context?.company_id
      if (!company_id) {
        sendError(res, 'Company context required', 400)
        return
      }

      const query = req.query as unknown as BankVoucherSummaryQuery

      logInfo('Bank voucher summary requested', {
        company_id,
        branch_id: query.branch_id,
        period: `${query.period_month}/${query.period_year}`,
        user_id: req.user?.id,
      })

      const result = await bankVouchersService.getSummary({
        company_id,
        branch_id: query.branch_id,
        period_month: query.period_month,
        period_year: query.period_year,
      })

      sendSuccess(res, result, 'Bank voucher summary retrieved')
    } catch (error) {
      handleError(res, error)
    }
  }

  // ============================================
  // GET /bank-vouchers/bank-accounts
  // ============================================

  async getBankAccounts(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const company_id = req.context?.company_id
      if (!company_id) {
        sendError(res, 'Company context required', 400)
        return
      }

      const result = await bankVouchersService.getBankAccounts(company_id)
      sendSuccess(res, result, 'Bank accounts retrieved')
    } catch (error) {
      handleError(res, error)
    }
  }
}

export const bankVouchersController = new BankVouchersController()
