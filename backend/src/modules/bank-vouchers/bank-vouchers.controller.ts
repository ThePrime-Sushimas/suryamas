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
  bankVoucherManualCreateSchema,
  bankVoucherVoidSchema,
  bankVoucherOpeningBalanceSchema,
  bankVoucherGetOpeningBalanceSchema,
  bankVoucherListSchema,
} from "./bank-vouchers.schema";
import { uuidSchema } from "./bank-vouchers.schema";

type PreviewReq = ValidatedRequest<typeof bankVoucherPreviewSchema>;
type SummaryReq = ValidatedRequest<typeof bankVoucherSummarySchema>;
type ConfirmReq = ValidatedRequest<typeof bankVoucherConfirmSchema>;
type ManualCreateReq = ValidatedRequest<typeof bankVoucherManualCreateSchema>;
type VoidReq = ValidatedRequest<typeof bankVoucherVoidSchema>;
type OpeningBalanceReq = ValidatedRequest<typeof bankVoucherOpeningBalanceSchema>;
type GetOpeningBalanceReq = ValidatedRequest<typeof bankVoucherGetOpeningBalanceSchema>;
type ListReq = ValidatedRequest<typeof bankVoucherListSchema>;

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

      const { transaction_dates, branch_id, bank_account_id } = req.validated.body;

      logInfo("Bank voucher confirmation requested", {
        company_id,
        dates_count: transaction_dates.length,
        user_id: (req as any).user?.id,
      });

      const result = await bankVouchersService.confirmVouchers({
        company_id,
        transaction_dates,
        branch_id,
        bank_account_id,
        user_id: (req as any).user?.id,
      });

      sendSuccess(res, result, "Bank vouchers confirmed successfully");
    } catch (error) {
      handleError(res, error);
    }
  });

  // ============================================
  // GET /bank-vouchers/:id
  // ============================================

  async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const company_id = req.context?.company_id;
      if (!company_id) { sendError(res, "Company context required", 400); return; }

      const voucherId = uuidSchema.parse(req.params.id);
      const result = await bankVouchersService.getVoucherDetail(voucherId);
      sendSuccess(res, result, "Voucher detail retrieved");
    } catch (error) {
      handleError(res, error);
    }
  }

  // ============================================
  // GET /bank-vouchers/list
  // ============================================

  list = withValidated(async (req: ListReq, res: Response): Promise<void> => {
    try {
      const company_id = (req as any).context?.company_id;
      if (!company_id) { sendError(res, "Company context required", 400); return; }

      const { query } = req.validated;
      const result = await bankVouchersService.listVouchers({
        company_id,
        period_month: query.period_month,
        period_year: query.period_year,
        branch_id: query.branch_id,
        bank_account_id: query.bank_account_id,
        status: query.status,
      });
      sendSuccess(res, result, "Voucher list retrieved");
    } catch (error) {
      handleError(res, error);
    }
  });

  // ============================================
  // POST /bank-vouchers/manual
  // ============================================

  createManual = withValidated(async (req: ManualCreateReq, res: Response): Promise<void> => {
    try {
      const company_id = (req as any).context?.company_id;
      if (!company_id) { sendError(res, "Company context required", 400); return; }

      const result = await bankVouchersService.createManualVoucher({
        company_id,
        user_id: (req as any).user?.id,
        data: req.validated.body,
      });
      sendSuccess(res, result, "Manual voucher created", 201);
    } catch (error) {
      handleError(res, error);
    }
  });

  // ============================================
  // POST /bank-vouchers/:id/void
  // ============================================

  voidVoucher = withValidated(async (req: VoidReq, res: Response): Promise<void> => {
    try {
      const company_id = (req as any).context?.company_id;
      if (!company_id) { sendError(res, "Company context required", 400); return; }

      const voucherId = uuidSchema.parse(req.params.id);
      const result = await bankVouchersService.voidVoucher({
        company_id,
        voucher_id: voucherId,
        reason: req.validated.body.reason,
        user_id: (req as any).user?.id,
      });
      sendSuccess(res, result, "Voucher voided");
    } catch (error) {
      handleError(res, error);
    }
  });

  // ============================================
  // POST /bank-vouchers/opening-balance
  // ============================================

  setOpeningBalance = withValidated(async (req: OpeningBalanceReq, res: Response): Promise<void> => {
    try {
      const company_id = (req as any).context?.company_id;
      if (!company_id) { sendError(res, "Company context required", 400); return; }

      const result = await bankVouchersService.setOpeningBalance({
        company_id,
        ...req.validated.body,
        user_id: (req as any).user?.id,
      });
      sendSuccess(res, result, "Opening balance set");
    } catch (error) {
      handleError(res, error);
    }
  });

  // ============================================
  // GET /bank-vouchers/opening-balance
  // ============================================

  getOpeningBalance = withValidated(async (req: GetOpeningBalanceReq, res: Response): Promise<void> => {
    try {
      const company_id = (req as any).context?.company_id;
      if (!company_id) { sendError(res, "Company context required", 400); return; }

      const { query } = req.validated;
      const result = await bankVouchersService.getOpeningBalance({
        company_id,
        bank_account_id: query.bank_account_id,
        period_month: query.period_month,
        period_year: query.period_year,
      });
      sendSuccess(res, result, "Opening balance retrieved");
    } catch (error) {
      handleError(res, error);
    }
  });

  // ============================================
  // GET /bank-vouchers/:id/print
  // Returns HTML for browser printing
  // ============================================

  async print(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const company_id = req.context?.company_id;
      if (!company_id) {
        sendError(res, "Company context required", 400);
        return;
      }

      const voucherId = uuidSchema.parse(req.params.id);
      const format = req.query.format as string | undefined;

      const printData = await bankVouchersService.getVoucherPrintData(voucherId);

      if (format === "json") {
        sendSuccess(res, printData, "Voucher print data retrieved");
        return;
      }

      // Default: return HTML
      const html = bankVouchersService.generatePrintHtml(printData);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } catch (error) {
      handleError(res, error);
    }
  }

  // ============================================
  // GET /bank-vouchers/bank-accounts
  // ============================================

  async getBankAccounts(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const company_id = req.context?.company_id
      if (!company_id) { sendError(res, 'Company context required', 400); return }
      const result = await bankVouchersService.getBankAccounts(company_id)
      sendSuccess(res, result, 'Bank accounts retrieved')
    } catch (error) {
      handleError(res, error)
    }
  }

  async getPaymentMethods(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const company_id = req.context?.company_id
      if (!company_id) { sendError(res, 'Company context required', 400); return }
      const result = await bankVouchersService.getPaymentMethods(company_id)
      sendSuccess(res, result, 'Payment methods retrieved')
    } catch (error) {
      handleError(res, error)
    }
  }
}

export const bankVouchersController = new BankVouchersController()
