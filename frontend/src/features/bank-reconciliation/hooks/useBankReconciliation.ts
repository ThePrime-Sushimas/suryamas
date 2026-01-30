import { useState } from "react";
import type {
  ReconciliationSummary,
  DiscrepancyItem,
  AutoMatchRequest,
  ManualReconcileRequest,
} from "../types/bank-reconciliation.types";
import { bankReconciliationApi } from "../api/bank-reconciliation.api";

export function useBankReconciliation(companyId: string) {
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);
  const [discrepancies, setDiscrepancies] = useState<DiscrepancyItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = async (startDate: string, endDate: string) => {
    setIsLoading(true);
    try {
      const data = await bankReconciliationApi.getSummary({
        companyId,
        startDate,
        endDate,
      });
      setSummary(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch summary");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDiscrepancies = async (startDate: string, endDate: string) => {
    setIsLoading(true);
    try {
      const data = await bankReconciliationApi.getDiscrepancies({
        companyId,
        startDate,
        endDate,
      });
      setDiscrepancies(data);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch discrepancies",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const autoMatch = async (payload: Omit<AutoMatchRequest, "companyId">) => {
    setIsLoading(true);
    try {
      await bankReconciliationApi.autoMatch({ ...payload, companyId });
      // Refresh summary after auto-match
      await fetchSummary(payload.startDate, payload.endDate);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Auto-match failed");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const manualReconcile = async (
    payload: Omit<ManualReconcileRequest, "companyId">,
  ) => {
    setIsLoading(true);
    try {
      await bankReconciliationApi.manualReconcile({ ...payload, companyId });
      // Refresh discrepancies (using current date logic in the page)
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Manual reconciliation failed",
      );
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const undoReconciliation = async (statementId: string) => {
    setIsLoading(true);
    try {
      await bankReconciliationApi.undo(statementId);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to undo reconciliation",
      );
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    summary,
    discrepancies,
    isLoading,
    error,
    fetchSummary,
    fetchDiscrepancies,
    autoMatch,
    manualReconcile,
    undoReconciliation,
  };
}
