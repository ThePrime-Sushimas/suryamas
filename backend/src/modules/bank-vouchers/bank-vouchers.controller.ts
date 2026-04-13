import { Response } from 'express'
import { bankVouchersService } from './bank-vouchers.service'
import { sendSuccess, sendError } from "../../utils/response.util";
import { handleError } from "../../utils/error-handler.util";
import { logInfo } from "../../config/logger";
import { withValidated } from "../../utils/handler";
import type { AuthenticatedRequest } from "../../types/request.types";
import type { ValidatedRequest } from "../../middleware/validation.middleware";
import {
  bankVoucherPreviewSchema,
  bankVoucherSummarySchema,
  bankVoucherConfirmSchema,
} from "./bank-vouchers.schema";

type PreviewReq = ValidatedRequest<typeof bankVoucherPreviewSchema>;
type SummaryReq = ValidatedRequest<typeof bankVoucherSummarySchema>;
type ConfirmReq = ValidatedRequest<typeof bankVoucherConfirmSchema>;

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

  preview = withValidated(async (req: PreviewReq, res: Response): Promise<void> => {
    try {
      const company_id = (req as any).context?.company_id;
      if (!company_id) {
        sendError(res, "Company context required", 400);
        return;
      }

      const { query } = req.validated;

      logInfo("Bank voucher preview requested", {
        company_id,
        branch_id: query.branch_id,
        period: `${query.period_month}/${query.period_year}`,
        user_id: (req as any).user?.id,
      });

      const result = await bankVouchersService.getPreview({
        company_id,
        branch_id: query.branch_id,
        period_month: query.period_month,
        period_year: query.period_year,
        bank_account_id: query.bank_account_id,
        voucher_type: query.voucher_type,
      });

      sendSuccess(res, result, "Bank voucher preview retrieved");
    } catch (error) {
      handleError(res, error);
    }
  });

  // ============================================
  // GET /bank-vouchers/summary
  // ============================================

  summary = withValidated(async (req: SummaryReq, res: Response): Promise<void> => {
    try {
      const company_id = (req as any).context?.company_id;
      if (!company_id) {
        sendError(res, "Company context required", 400);
        return;
      }

      const { query } = req.validated;

      logInfo("Bank voucher summary requested", {
        company_id,
        branch_id: query.branch_id,
        period: `${query.period_month}/${query.period_year}`,
        user_id: (req as any).user?.id,
      });

      const result = await bankVouchersService.getSummary({
        company_id,
        branch_id: query.branch_id,
        period_month: query.period_month,
        period_year: query.period_year,
      });

      sendSuccess(res, result, "Bank voucher summary retrieved");
    } catch (error) {
      handleError(res, error);
    }
  });

  // ============================================
  // POST /bank-vouchers/confirm
  // ============================================

  confirm = withValidated(async (req: ConfirmReq, res: Response): Promise<void> => {
    try {
      const company_id = (req as any).context?.company_id;
      if (!company_id) {
        sendError(res, "Company context required", 400);
        return;
      }

      const { transaction_dates, branch_id } = req.validated.body;

      logInfo("Bank voucher confirmation requested", {
        company_id,
        dates_count: transaction_dates.length,
        user_id: (req as any).user?.id,
      });

      const result = await bankVouchersService.confirmVouchers({
        company_id,
        transaction_dates,
        branch_id,
        user_id: (req as any).user?.id,
      });

      sendSuccess(res, result, "Bank vouchers confirmed successfully");
    } catch (error) {
      handleError(res, error);
    }
  });

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
