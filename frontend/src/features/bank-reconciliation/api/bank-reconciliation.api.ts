import api from "@/lib/axios";
import type {
  ReconciliationSummary,
  AutoMatchRequest,
  ManualReconcileRequest,
  GetSummaryParams,
  GetStatementsParams,
  BankAccountStatus,
  BankStatementWithMatch,
  PotentialMatch,
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
   * Get all bank statements with reconciliation info
   */
  async getStatements(
    params: GetStatementsParams,
  ): Promise<BankStatementWithMatch[]> {
    const response = await api.get("/reconciliation/bank/statements", {
      params,
    });
    return response.data.data;
  },

  /**
   * Get bank accounts status for tabs
   */
  async getBankAccountsStatus(
    params: GetSummaryParams,
  ): Promise<BankAccountStatus[]> {
    const response = await api.get(
      "/reconciliation/bank/bank-accounts/status",
      { params },
    );
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

  /**
   * Get potential matches for a bank statement
   */
  async getPotentialMatches(
    statementId: string,
    companyId: string,
  ): Promise<PotentialMatch[]> {
    const response = await api.get(
      `/reconciliation/bank/statements/${statementId}/potential-matches`,
      { params: { companyId } },
    );
    return response.data.data;
  },
};
