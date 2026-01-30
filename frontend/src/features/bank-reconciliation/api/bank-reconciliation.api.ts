import api from "@/lib/axios";
import type {
  ReconciliationSummary,
  DiscrepancyItem,
  AutoMatchRequest,
  ManualReconcileRequest,
  GetSummaryParams,
  GetDiscrepanciesParams,
} from "../types/bank-reconciliation.types";

export const bankReconciliationApi = {
  /**
   * Get reconciliation summary for a date range
   */
  async getSummary(params: GetSummaryParams): Promise<ReconciliationSummary> {
    const response = await api.get("/reconciliation/bank/summary", { params });
    return response.data.data;
  },

  /**
   * Get items requiring manual review (discrepancies)
   */
  async getDiscrepancies(
    params: GetDiscrepanciesParams,
  ): Promise<DiscrepancyItem[]> {
    const response = await api.get("/reconciliation/bank/discrepancies", {
      params,
    });
    return response.data.data;
  },

  /**
   * Trigger the auto-matching algorithm
   */
  async autoMatch(
    payload: AutoMatchRequest,
  ): Promise<{ matchedCount: number }> {
    const response = await api.post("/reconciliation/bank/auto-match", payload);
    return response.data.data;
  },

  /**
   * Manually link a bank statement to a POS aggregate
   */
  async manualReconcile(payload: ManualReconcileRequest): Promise<void> {
    await api.post("/reconciliation/bank/manual", payload);
  },

  /**
   * Revert a reconciliation
   */
  async undo(statementId: string): Promise<void> {
    await api.post(`/reconciliation/bank/undo/${statementId}`);
  },
};
