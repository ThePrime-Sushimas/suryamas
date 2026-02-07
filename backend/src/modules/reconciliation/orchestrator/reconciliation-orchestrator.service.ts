import { supabase } from "../../../config/supabase";
import { logInfo, logError, logDebug } from "../../../config/logger";
import {
  AggregatedTransaction,
  ReconciliationAggregate,
  IReconciliationOrchestratorService,
} from "./reconciliation-orchestrator.types";

export class ReconciliationOrchestratorService implements IReconciliationOrchestratorService {
  async getAggregatesForDate(
    date: Date,
  ): Promise<ReconciliationAggregate[]> {
    const dateStr = date.toISOString().split("T")[0];
    logInfo("Fetching aggregated transactions for reconciliation", {
      date: dateStr,
      action: "get_aggregates_for_date",
    });

    try {
      const { data, error } = await supabase
        .from("aggregated_transactions")
        .select(
          `
          *,
          payment_methods:payment_method_id (
            id,
            name,
            code
          )
        `,
        )
        .eq("transaction_date", dateStr)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) {
        logError("Database error fetching aggregated transactions", {
          error: error.message,
          date: dateStr,
          query: "aggregated_transactions.select",
        });
        throw new Error(
          `Failed to fetch aggregated transactions: ${error.message}`,
        );
      }

      if (!data || data.length === 0) {
        logInfo("No aggregated transactions found for date", { date: dateStr });
        return [];
      }

      return data.map((agg) => this.transformToReconciliationAggregate(agg));
    } catch (error) {
      logError("Failed to get aggregated transactions", {
        date: dateStr,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      throw error;
    }
  }

  async getAggregatesByDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<ReconciliationAggregate[]> {
    const startDateStr = startDate.toISOString().split("T")[0];
    const endDateStr = endDate.toISOString().split("T")[0];

    logInfo("Fetching aggregated transactions for date range", {
      startDate: startDateStr,
      endDate: endDateStr,
    });

    try {
      const { data, error } = await supabase
        .from("aggregated_transactions")
        .select(
          `
          *,
          payment_methods:payment_method_id (
            name,
            code
          )
        `,
        )
        .gte("transaction_date", startDateStr)
        .lte("transaction_date", endDateStr)
        .is("deleted_at", null)
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        logError("Error fetching aggregated transactions by date range", {
          error: error.message,
          startDate: startDateStr,
          endDate: endDateStr,
        });
        throw new Error(
          `Failed to fetch aggregated transactions by date range: ${error.message}`,
        );
      }

      return (data || []).map((agg) =>
        this.transformToReconciliationAggregate(agg),
      );
    } catch (error) {
      logError("Failed to get aggregated transactions by date range", {
        startDate: startDateStr,
        endDate: endDateStr,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async getAggregate(id: string): Promise<AggregatedTransaction> {
    logDebug("Fetching single aggregated transaction", { aggregateId: id });

    try {
      const { data, error } = await supabase
        .from("aggregated_transactions")
        .select(
          `
          *,
          payment_methods:payment_method_id (
            name,
            code
          )
        `,
        )
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          logError("Aggregated transaction not found", { aggregateId: id });
          throw new Error(`Aggregated transaction ${id} not found`);
        }
        logError("Database error fetching single aggregated transaction", {
          aggregateId: id,
          error: error.message,
        });
        throw new Error(`Failed to fetch aggregate: ${error.message}`);
      }

      return data;
    } catch (error) {
      logError("Failed to get single aggregated transaction", {
        aggregateId: id,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async updateReconciliationStatus(
    aggregateId: string,
    status: "PENDING" | "RECONCILED" | "DISCREPANCY",
    statementId?: string,
    reconciledBy?: string,
  ): Promise<void> {
    logInfo("Updating aggregated transaction reconnaissance status", {
      aggregateId,
      status,
      statementId,
      reconciledBy,
    });

    try {
      const updateData: any = {
        is_reconciled: status === "RECONCILED",
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("aggregated_transactions")
        .update(updateData)
        .eq("id", aggregateId);

      if (error) {
        logError("Failed to update reconciliation status", {
          aggregateId,
          status,
          error: error.message,
        });
        throw new Error(
          `Failed to update reconciliation status: ${error.message}`,
        );
      }

      logInfo(
        "Successfully updated aggregated transaction reconciliation status",
        {
          aggregateId,
          status,
        },
      );
    } catch (error) {
      logError("Error updating reconciliation status", {
        aggregateId,
        status,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async getReconciliationSummary(
    startDate: Date,
    endDate: Date,
  ): Promise<any> {
    const startDateStr = startDate.toISOString().split("T")[0];
    const endDateStr = endDate.toISOString().split("T")[0];

    try {
      return await this.getSummaryFallback(startDateStr, endDateStr);
    } catch (error) {
      logError("Error getting reconciliation summary", {
        startDate: startDateStr,
        endDate: endDateStr,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private async getSummaryFallback(
    startDate: string,
    endDate: string,
  ): Promise<any> {
    try {
      const { data: aggData, error: aggError } = await supabase
        .from("aggregated_transactions")
        .select("is_reconciled, nett_amount")
        .gte("transaction_date", startDate)
        .lte("transaction_date", endDate)
        .is("deleted_at", null);

      if (aggError) throw aggError;

      const { data: stmtData, error: stmtError } = await supabase
        .from("bank_statements")
        .select("id, is_reconciled, credit_amount, debit_amount, reconciliation_id")
        .gte("transaction_date", startDate)
        .lte("transaction_date", endDate)
        .is("deleted_at", null);

      if (stmtError) throw stmtError;

      // Try to get audit data for autoMatched count (may fail if table doesn't exist)
      let autoMatched = 0;
      let manuallyMatched = 0;
      try {
        const { data: auditData, error: auditError } = await supabase
          .from("audit_log")
          .select("action")
          .gte("created_at", startDate + "T00:00:00")
          .lte("created_at", endDate + "T23:59:59")
          .in("action", ["AUTO_MATCH", "MANUAL_RECONCILE"]);

        if (!auditError && auditData) {
          autoMatched = auditData.filter(a => a.action === "AUTO_MATCH").length || 0;
          manuallyMatched = auditData.filter(a => a.action === "MANUAL_RECONCILE").length || 0;
        }
      } catch (e) {
        logDebug("Audit log table not available, defaulting autoMatched to 0");
      }

      // Try to get discrepancies data (may fail if join doesn't work)
      let discrepancies = 0;
      try {
        const { data: discData, error: discError } = await supabase
          .from("bank_statements")
          .select("credit_amount, debit_amount, aggregated_transactions!reconciliation_id(nett_amount)")
          .gte("transaction_date", startDate)
          .lte("transaction_date", endDate)
          .is("deleted_at", null)
          .eq("is_reconciled", true);

        if (!discError && discData) {
          const threshold = 100; // difference threshold
          discrepancies = discData.filter(stmt => {
            const bankAmount = (stmt.credit_amount || 0) - (stmt.debit_amount || 0);
            const nett = stmt.aggregated_transactions?.[0]?.nett_amount;
            if (!nett) return false;
            const diff = Math.abs(bankAmount - nett);
            return diff > threshold;
          }).length || 0;
        }
      } catch (e) {
        logDebug("Discrepancies join not available, defaulting to 0");
      }

      const totalAggregates = aggData?.length || 0;
      const reconciledAggregates =
        aggData?.filter((agg) => agg.is_reconciled).length || 0;
      const totalStatements = stmtData?.length || 0;
      const reconciledStatements =
        stmtData?.filter((stmt) => stmt.is_reconciled).length || 0;

      const unreconciled = totalStatements - reconciledStatements;

      const totalNetAmount =
        aggData?.reduce((sum, agg) => sum + (Number(agg.nett_amount) || 0), 0) ||
        0;
      const totalBankAmount =
        stmtData?.reduce(
          (sum, stmt) =>
            sum +
            ((Number(stmt.credit_amount) || 0) -
              (Number(stmt.debit_amount) || 0)),
          0,
        ) || 0;

      const totalDifference = Math.abs(totalNetAmount - totalBankAmount);

      const percentageReconciled =
        totalAggregates > 0
          ? (reconciledAggregates / totalAggregates) * 100
          : 0;

      const summary = {
        period: {
          startDate,
          endDate,
        },
        totalAggregates,
        totalStatements,
        autoMatched,
        manuallyMatched,
        discrepancies,
        unreconciled,
        totalDifference,
        percentageReconciled,
      };

      return summary;
    } catch (error) {
      throw new Error(`Failed to get summary: ${(error as Error).message}`);
    }
  }

  private transformToReconciliationAggregate(
    agg: any,
  ): ReconciliationAggregate {
    return {
      id: agg.id,
      nett_amount: Number(agg.nett_amount),
      transaction_date: agg.transaction_date,
      reference_number: agg.source_ref,
      payment_method_id: agg.payment_method_id,
      payment_method_name: agg.payment_methods?.name,
      branch_name: agg.branch_name || null,
      gross_amount: Number(agg.gross_amount),
      percentage_fee_amount: Number(agg.percentage_fee_amount || 0),
      fixed_fee_amount: Number(agg.fixed_fee_amount || 0),
      total_fee_amount: Number(agg.total_fee_amount || 0),
      bill_after_discount: Number(agg.bill_after_discount || 0),
      transaction_count: 1,
      reconciliation_status: agg.is_reconciled ? "RECONCILED" : "PENDING",
    };
  }

  async findPotentialAggregatesForStatement(
    statementAmount: number,
    statementDate: Date,
    tolerance: number = 0.01,
    dateBufferDays: number = 3,
  ): Promise<ReconciliationAggregate[]> {
    const dateStr = statementDate.toISOString().split("T")[0];
    const minDate = new Date(statementDate);
    minDate.setDate(minDate.getDate() - dateBufferDays);
    const maxDate = new Date(statementDate);
    maxDate.setDate(maxDate.getDate() + dateBufferDays);

    const minDateStr = minDate.toISOString().split("T")[0];
    const maxDateStr = maxDate.toISOString().split("T")[0];

    logDebug("Finding potential aggregated transactions for statement", {
      statementAmount,
      statementDate: dateStr,
      tolerance,
      dateBufferDays,
    });

    try {
      const { data, error } = await supabase
        .from("aggregated_transactions")
        .select(
          `
          *,
          payment_methods:payment_method_id (name)
        `,
        )
        .gte("transaction_date", minDateStr)
        .lte("transaction_date", maxDateStr)
        .is("deleted_at", null)
        .eq("is_reconciled", false)
        .gte("nett_amount", statementAmount - tolerance)
        .lte("nett_amount", statementAmount + tolerance)
        .order("transaction_date", { ascending: false })
        .limit(10);

      if (error) {
        logError("Error finding potential aggregated transactions", {
          error: error.message,
          statementAmount,
        });
        throw error;
      }

      const potentialMatches = (data || []).map((agg) => {
        const netAmount = Number(agg.nett_amount);
        const amountDiff = Math.abs(netAmount - statementAmount);
        const dateDiff =
          Math.abs(
            new Date(agg.transaction_date).getTime() - statementDate.getTime(),
          ) /
          (1000 * 3600 * 24);

        let score = 100;
        score -= (amountDiff / (statementAmount || 1)) * 100 * 10;
        score -= dateDiff * 5;
        score = Math.max(0, Math.min(100, Math.round(score)));

        const transformed = this.transformToReconciliationAggregate(agg);
        return {
          ...transformed,
          confidence_score: score,
          amount_difference: amountDiff,
          date_difference_days: dateDiff,
        };
      });

      return potentialMatches.sort(
        (a, b) => b.confidence_score - a.confidence_score,
      );
    } catch (error) {
      logError("Failed to find potential matches", {
        statementAmount,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async bulkUpdateReconciliationStatus(
    updates: Array<{
      aggregateId: string;
      status: "PENDING" | "RECONCILED" | "DISCREPANCY";
      statementId?: string;
    }>,
  ): Promise<void> {
    if (updates.length === 0) return;

    logInfo("Bulk updating aggregated transactions status", {
      count: updates.length,
    });

    try {
      const updatePromises = updates.map((update) => {
        return supabase
          .from("aggregated_transactions")
          .update({
            is_reconciled: update.status === "RECONCILED",
            updated_at: new Date().toISOString(),
          })
          .eq("id", update.aggregateId);
      });

      const results = await Promise.allSettled(updatePromises);

      const errors = results.filter(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected",
      );

      if (errors.length > 0) {
        throw new Error(`Failed to update ${errors.length} records`);
      }
    } catch (error) {
      logError("Failed bulk update", {
        error: (error as Error).message,
      });
      throw error;
    }
  }
}

export const reconciliationOrchestratorService =
  new ReconciliationOrchestratorService();

