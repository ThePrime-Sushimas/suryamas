import { Request, Response } from "express";
import { posSyncAggregatesRepository } from "./pos-sync-aggregates.repository";
import {
  ListAggregatesParams,
  ReconcilePosSyncAggregateDto,
} from "./pos-sync-aggregates.types";
import { supabase } from "@/config/supabase";
import { marketingFeeService } from "../reconciliation/fee-reconciliation/marketing-fee.service";
import { logError, logInfo } from "../../config/logger";

export const posSyncAggregatesController = {
  list: async (req: Request, res: Response): Promise<void> => {
    try {
      const params: ListAggregatesParams = {
        date_from: req.query.date_from as string,
        date_to: req.query.date_to as string,
        branch_id: req.query.branch_id as string,
        branch_ids: req.query.branch_ids as string,
        payment_method_id: req.query.payment_method_id as string,
        payment_method_ids: req.query.payment_method_ids as string,
        status: req.query.status as string,
        is_reconciled: req.query.is_reconciled as string,
        has_journal: req.query.has_journal as string,
        search: req.query.search as string,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 50,
      };
      const result = await posSyncAggregatesRepository.list(params);
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message });
    }
  },

  getById: async (req: Request, res: Response): Promise<void> => {
    try {
      const data = await posSyncAggregatesRepository.getById(
        req.params.id as string,
      );
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message });
    }
  },

  getLines: async (req: Request, res: Response): Promise<void> => {
    try {
      const data = await posSyncAggregatesRepository.getLines(
        req.params.id as string,
      );
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message });
    }
  },

  reconcile: async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const { statementId, notes } = req.body as ReconcilePosSyncAggregateDto;
    const userId = (req as any).user?.id;

    try {
      // 1. Get aggregate
      const aggregate = await posSyncAggregatesRepository.getById(id);
      if (!aggregate) {
        res
          .status(404)
          .json({ success: false, message: "Aggregate not found" });
        return;
      }
      if (aggregate.is_reconciled) {
        res
          .status(400)
          .json({ success: false, message: "Aggregate sudah direkonsiliasi" });
        return;
      }
      if (aggregate.status === "PENDING") {
        res.status(400).json({
          success: false,
          message: "Aggregate masih PENDING, mapping belum lengkap",
        });
        return;
      }

      // 2. Get bank statement
      const { data: stmt, error: stmtErr } = await supabase
        .from("bank_statements")
        .select("id, credit_amount, debit_amount, is_reconciled")
        .eq("id", statementId)
        .single();

      if (stmtErr || !stmt) {
        res
          .status(404)
          .json({ success: false, message: "Bank statement not found" });
        return;
      }
      if (stmt.is_reconciled) {
        res.status(400).json({
          success: false,
          message: "Bank statement sudah direkonsiliasi",
        });
        return;
      }

      // 3. Calculate fee discrepancy — reuse marketingFeeService logic
      const actualFromBank =
        (stmt.credit_amount || 0) - (stmt.debit_amount || 0);
      const expectedNet = Number(aggregate.nett_amount);
      const expectedFee = Number(aggregate.total_fee_amount);

      const feeResult = marketingFeeService.identifyMarketingFee({
        expectedNet,
        actualFromBank,
        paymentMethodCode: String(aggregate.payment_method_id),
        transactionDate: new Date(),
      });

      const feeDiscrepancy = feeResult.difference;
      const actualFeeAmount = expectedFee + feeDiscrepancy;

      let feeDiscrepancyNote: string | null = null;
      if (Math.abs(feeDiscrepancy) >= 1) {
        feeDiscrepancyNote =
          feeDiscrepancy > 0
            ? `Bank bayar kurang Rp ${feeDiscrepancy.toLocaleString("id-ID")} dari expected`
            : `Bank bayar lebih Rp ${Math.abs(feeDiscrepancy).toLocaleString("id-ID")} dari expected`;
      }

      const now = new Date().toISOString();

      // 4. Update pos_sync_aggregates
      const { error: aggErr } = await supabase
        .from("pos_sync_aggregates")
        .update({
          is_reconciled: true,
          bank_statement_id: statementId,
          actual_fee_amount: actualFeeAmount,
          fee_discrepancy: feeDiscrepancy,
          fee_discrepancy_note: feeDiscrepancyNote,
          reconciled_at: now,
          reconciled_by: userId ?? null,
          updated_at: now,
        })
        .eq("id", id);

      if (aggErr) throw aggErr;

      // 5. Mark bank statement as reconciled
      // Jadi ini:
      const { error: stmtUpdateErr } = await supabase
        .from("bank_statements")
        .update({
          is_reconciled: true,
          pos_sync_aggregate_id: id, // ← kolom baru
          updated_at: now,
        })
        .eq("id", statementId);
      if (stmtUpdateErr) {
        logError("Failed to mark bank statement as reconciled", {
          statementId,
          error: stmtUpdateErr.message,
        });
        // Rollback aggregate update
        await supabase
          .from("pos_sync_aggregates")
          .update({
            is_reconciled: false,
            bank_statement_id: null,
            reconciled_at: null,
            reconciled_by: null,
            actual_fee_amount: null,
            fee_discrepancy: null,
            fee_discrepancy_note: null,
            updated_at: now,
          })
          .eq("id", id);
        throw stmtUpdateErr;
      }

      logInfo("pos_sync_aggregate reconciled", {
        id,
        statementId,
        feeDiscrepancy,
      });

      res.json({
        success: true,
        data: { id, statementId, feeDiscrepancy, actualFeeAmount },
      });
    } catch (err: any) {
      logError("reconcile pos_sync_aggregate failed", { id, err });
      res.status(500).json({ success: false, message: err?.message });
    }
  },

  undoReconcile: async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;

    try {
      // 1. Get aggregate
      const aggregate = await posSyncAggregatesRepository.getById(id);
      if (!aggregate) {
        res
          .status(404)
          .json({ success: false, message: "Aggregate not found" });
        return;
      }
      if (!aggregate.is_reconciled) {
        res
          .status(400)
          .json({ success: false, message: "Aggregate belum direkonsiliasi" });
        return;
      }
      if (aggregate.status === "JOURNALED") {
        res.status(400).json({
          success: false,
          message: "Tidak bisa undo — jurnal sudah dibuat",
        });
        return;
      }

      const statementId = aggregate.bank_statement_id;
      const now = new Date().toISOString();

      // 2. Reset aggregate
      const { error: aggErr } = await supabase
        .from("pos_sync_aggregates")
        .update({
          is_reconciled: false,
          bank_statement_id: null,
          actual_fee_amount: null,
          fee_discrepancy: null,
          fee_discrepancy_note: null,
          reconciled_at: null,
          reconciled_by: null,
          updated_at: now,
        })
        .eq("id", id);

      if (aggErr) throw aggErr;

      // 3. Reset bank statement
      if (statementId) {
        const { error: stmtErr } = await supabase
          .from("bank_statements")
          .update({
            is_reconciled: false,
            pos_sync_aggregate_id: null,
            updated_at: now,
          })
          .eq("id", statementId);

        if (stmtErr) {
          logError("Failed to reset bank statement", {
            statementId,
            error: stmtErr.message,
          });
        }
      }

      logInfo("pos_sync_aggregate reconciliation undone", { id, statementId });
      res.json({ success: true });
    } catch (err: any) {
      logError("undoReconcile pos_sync_aggregate failed", { id, err });
      res.status(500).json({ success: false, message: err?.message });
    }
  },
};
