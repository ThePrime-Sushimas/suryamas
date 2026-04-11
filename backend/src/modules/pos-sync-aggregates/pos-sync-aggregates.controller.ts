import { Request, Response } from "express";
import { posSyncAggregatesRepository } from "./pos-sync-aggregates.repository";
import { syncPosSyncToAggregated } from "./pos-sync-aggregates.service";
import {
  ListAggregatesParams,
  ReconcilePosSyncAggregateDto,
} from "./pos-sync-aggregates.types";
import { marketingFeeService } from "../reconciliation/fee-reconciliation/marketing-fee.service";
import { logError, logInfo, logWarn } from "../../config/logger";
import { AuditService } from "../monitoring/monitoring.service";

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
      // 1. Validate aggregate
      const aggregate = await posSyncAggregatesRepository.getById(id);
      if (!aggregate) {
        res.status(404).json({ success: false, message: "Aggregate not found" });
        return;
      }
      if (aggregate.is_reconciled) {
        res.status(400).json({ success: false, message: "Aggregate sudah direkonsiliasi" });
        return;
      }
      if (aggregate.status === "PENDING") {
        res.status(400).json({ success: false, message: "Aggregate masih PENDING, mapping belum lengkap" });
        return;
      }

      // 2. Validate bank statement
      let stmt: any;
      try {
        stmt = await posSyncAggregatesRepository.getBankStatementById(statementId);
      } catch {
        res.status(404).json({ success: false, message: "Bank statement not found" });
        return;
      }
      if (stmt.is_reconciled) {
        res.status(400).json({ success: false, message: "Bank statement sudah direkonsiliasi" });
        return;
      }

      // 3. Find aggregated_transactions record — auto-sync if missing (fixes race condition)
      let aggTx = await posSyncAggregatesRepository.findAggregatedTxByPosSyncId(id);
      if (!aggTx) {
        logInfo("reconcile: aggregated_tx missing, triggering inline sync", { id, salesDate: aggregate.sales_date });
        const syncResult = await syncPosSyncToAggregated(aggregate.sales_date);
        logInfo("reconcile: inline sync result", { id, ...syncResult });
        if (syncResult.synced === 0) {
          logWarn("reconcile: inline sync produced 0 records", { id, salesDate: aggregate.sales_date, aggregateStatus: aggregate.status });
        }
        aggTx = await posSyncAggregatesRepository.findAggregatedTxByPosSyncId(id);
      }
      if (!aggTx) {
        res.status(400).json({
          success: false,
          message: `Aggregated transaction tidak ditemukan untuk aggregate ${id}. Sync dipicu tapi record tetap tidak ada — periksa log dan pastikan status aggregate adalah READY atau RECALCULATED.`,
        });
        return;
      }

      // 4. Calculate fee discrepancy
      const actualFromBank = (stmt.credit_amount || 0) - (stmt.debit_amount || 0);
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

      // 5. Update pos_sync_aggregates
      await posSyncAggregatesRepository.markPosSyncReconciled(id, {
        bank_statement_id: statementId,
        actual_fee_amount: actualFeeAmount,
        fee_discrepancy: feeDiscrepancy,
        fee_discrepancy_note: feeDiscrepancyNote,
        reconciled_by: userId ?? null,
      });

      // 6. Mark bank statement reconciled via unified path
      try {
        await posSyncAggregatesRepository.markBankStatementReconciled(statementId, aggTx.id);
      } catch (stmtUpdateErr: any) {
        logError("Failed to mark bank statement as reconciled", {
          statementId,
          error: stmtUpdateErr.message,
        });
        // Rollback pos_sync_aggregates
        await posSyncAggregatesRepository.resetPosSyncReconciliation(id);
        throw stmtUpdateErr;
      }

      // 7. Update aggregated_transactions
      try {
        await posSyncAggregatesRepository.markAggregatedTxReconciled(aggTx.id, {
          actual_fee_amount: actualFeeAmount,
          fee_discrepancy: feeDiscrepancy,
          fee_discrepancy_note: feeDiscrepancyNote,
        });
      } catch (aggTxUpdateErr: any) {
        logError("Failed to update aggregated_transaction", {
          aggTxId: aggTx.id,
          error: aggTxUpdateErr.message,
        });
        // Rollback all three tables
        await posSyncAggregatesRepository.resetAggregatedTxReconciliation(id);
        await posSyncAggregatesRepository.resetBankStatementReconciliation(statementId);
        await posSyncAggregatesRepository.resetPosSyncReconciliation(id);
        throw aggTxUpdateErr;
      }

      logInfo("pos_sync_aggregate reconciled (unified)", {
        id,
        statementId,
        aggTxId: aggTx.id,
        feeDiscrepancy,
      });

      await AuditService.log(
        "RECONCILE",
        "pos_sync_aggregate",
        id,
        userId,
        { is_reconciled: false },
        {
          is_reconciled: true,
          bank_statement_id: statementId,
          aggregated_transaction_id: aggTx.id,
          fee_discrepancy: feeDiscrepancy,
        },
        req.ip,
        req.get("user-agent"),
      );

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
      // 1. Validate aggregate
      const aggregate = await posSyncAggregatesRepository.getById(id);
      if (!aggregate) {
        res.status(404).json({ success: false, message: "Aggregate not found" });
        return;
      }
      if (!aggregate.is_reconciled) {
        res.status(400).json({ success: false, message: "Aggregate belum direkonsiliasi" });
        return;
      }
      if (aggregate.status === "JOURNALED") {
        res.status(400).json({ success: false, message: "Tidak bisa undo — jurnal sudah dibuat" });
        return;
      }

      const statementId = aggregate.bank_statement_id;

      // Best-effort reset all three tables — collect errors instead of throwing sequentially
      const undoErrors: string[] = [];

      await posSyncAggregatesRepository.resetPosSyncReconciliation(id)
        .catch((e: any) => undoErrors.push(`pos_sync_aggregates: ${e.message}`));

      if (statementId) {
        await posSyncAggregatesRepository.resetBankStatementReconciliation(statementId)
          .catch((e: any) => undoErrors.push(`bank_statements: ${e.message}`));
      }

      await posSyncAggregatesRepository.resetAggregatedTxReconciliation(id)
        .catch((e: any) => undoErrors.push(`aggregated_transactions: ${e.message}`));

      if (undoErrors.length > 0) {
        logError("undoReconcile partial failure", { id, statementId, errors: undoErrors });
        // Partial undo — some tables may still be reconciled
        res.status(500).json({
          success: false,
          message: `Undo sebagian gagal: ${undoErrors.join("; ")}. Periksa data secara manual.`,
        });
        return;
      }

      logInfo("pos_sync_aggregate reconciliation undone (unified)", { id, statementId });

      const userId = (req as any).user?.id;
      await AuditService.log(
        "UNDO_RECONCILE",
        "pos_sync_aggregate",
        id,
        userId,
        { is_reconciled: true, bank_statement_id: statementId },
        { is_reconciled: false, bank_statement_id: null },
        req.ip,
        req.get("user-agent"),
      );

      res.json({ success: true });
    } catch (err: any) {
      logError("undoReconcile pos_sync_aggregate failed", { id, err });
      res.status(500).json({ success: false, message: err?.message });
    }
  },
};
