import { Response } from 'express'
import { bankVouchersService } from './bank-vouchers.service'
import { sendSuccess, sendError } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { logInfo } from '../../config/logger'
import type { AuthenticatedRequest } from '../../types/request.types'
import type { BankVoucherPreviewQuery, BankVoucherSummaryQuery } from './bank-vouchers.schema'
import { BankVoucherMissingCompanyError } from './bank-vouchers.errors'

export class BankVouchersController {

  // ============================================
  // GET /bank-vouchers/preview
  // Query: period_month, period_year, branch_id?, bank_account_id?, voucher_type?
  // ============================================

  async preview(req: AuthenticatedRequest, res: Response) {
    try {
      const company_id = req.context?.company_id
      if (!company_id) {
        return sendError(res, 'Company context required', 400)
      }

      const query = req.query as unknown as BankVoucherPreviewQuery

      logInfo('Bank voucher preview requested', {
        company_id,
        branch_id: query.branch_id,
        period: `${query.period_month}/${query.period_year}`,
        user: req.user?.id,
      })

      const result = await bankVouchersService.getPreview({
        company_id,
        branch_id: query.branch_id,
        period_month: Number(query.period_month),
        period_year: Number(query.period_year),
        bank_account_id: query.bank_account_id ? Number(query.bank_account_id) : undefined,
        voucher_type: query.voucher_type,
      })

      sendSuccess(res, result, 'Bank voucher preview retrieved')
    } catch (error) {
      handleError(res, error)
    }
  }

  // ============================================
  // GET /bank-vouchers/summary
  // Query: period_month, period_year, branch_id?
  // ============================================

  async summary(req: AuthenticatedRequest, res: Response) {
    try {
      const company_id = req.context?.company_id
      if (!company_id) {
        return sendError(res, 'Company context required', 400)
      }

      const query = req.query as unknown as BankVoucherSummaryQuery

      const result = await bankVouchersService.getSummary({
        company_id,
        branch_id: query.branch_id,
        period_month: Number(query.period_month),
        period_year: Number(query.period_year),
      })

      sendSuccess(res, result, 'Bank voucher summary retrieved')
    } catch (error) {
      handleError(res, error)
    }
  }

  // ============================================
  // GET /bank-vouchers/bank-accounts
  // Dropdown list untuk filter UI
  // ============================================

  async getBankAccounts(req: AuthenticatedRequest, res: Response) {
    try {
      const company_id = req.context?.company_id
      if (!company_id) {
        return sendError(res, 'Company context required', 400)
      }

      const result = await bankVouchersService.getBankAccounts(company_id)
      sendSuccess(res, result, 'Bank accounts retrieved')
    } catch (error) {
      handleError(res, error)
    }
  }
}

export const bankVouchersController = new BankVouchersController()
