import api from "@/lib/axios";
import type {
  ReconciliationSummary,
  AutoMatchRequest,
  AutoMatchPreviewRequest,
  AutoMatchConfirmRequest,
  AutoMatchPreviewResponse,
  ManualReconcileRequest,
  GetSummaryParams,
  BankAccountStatus,
  BankStatementWithMatch,
  PotentialMatch,
  ReconciliationGroup,
  MultiMatchSuggestion,
  MultiMatchRequest,
  MultiMatchResult,
} from "../types/bank-reconciliation.types";

export interface BankStatementFilterParams {
  startDate?: string;
  endDate?: string;
  bankAccountId?: number;
  status?: 'RECONCILED' | 'UNRECONCILED' | 'DISCREPANCY';
  search?: string;
  isReconciled?: boolean;
  sort?: string;
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export const bankReconciliationApi = {
  /**
   * Get reconciliation summary for a date range
   */
  async getSummary(params: GetSummaryParams): Promise<ReconciliationSummary> {
    const response = await api.get("/reconciliation/bank/summary", { params });
    return response.data.data;
  },

  /**
   * Get bank statements with direct query (supports optional dates)
   */
  async getStatementsDirect(
    params: BankStatementFilterParams,
  ): Promise<{ data: BankStatementWithMatch[]; pagination?: { page: number; limit: number } }> {
    const response = await api.get("/reconciliation/bank/statements", {
      params,
    });
    return response.data;
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
   * Get all bank accounts without date filter - for filter dropdown
   */
  async getAllBankAccounts(): Promise<BankAccountStatus[]> {
    const response = await api.get(
      "/reconciliation/bank/bank-accounts/all",
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
   * Preview auto-match results without updating database
   */
  async previewAutoMatch(
    payload: AutoMatchPreviewRequest,
  ): Promise<AutoMatchPreviewResponse> {
    const response = await api.post("/reconciliation/bank/auto-match/preview", payload);
    return response.data.data;
  },

  /**
   * Confirm and reconcile selected matches only
   */
  async confirmAutoMatch(
    payload: AutoMatchConfirmRequest,
  ): Promise<{ matched: number; failed: number }> {
    const response = await api.post("/reconciliation/bank/auto-match/confirm", payload);
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
  ): Promise<PotentialMatch[]> {
    const response = await api.get(
      `/reconciliation/bank/statements/${statementId}/potential-matches`,
    );
    return response.data.data;
  },

  // =====================================================
  // MULTI-MATCH API METHODS
  // =====================================================

  /**
   * Create multi-match (1 POS = N Bank Statements)
   */
  async createMultiMatch(
    payload: MultiMatchRequest,
  ): Promise<MultiMatchResult> {
    const deduplicatedPayload = {
      ...payload,
      statementIds: [...new Set(payload.statementIds)],
    };
    const response = await api.post("/reconciliation/bank/multi-match", deduplicatedPayload);
    return response.data.data;
  },

  /**
   * Undo multi-match
   */
  async undoMultiMatch(groupId: string): Promise<void> {
    await api.delete(`/reconciliation/bank/multi-match/${groupId}`);
  },

  /**
   * Get suggested statements for grouping
   */
  async getSuggestedGroupStatements(    
    aggregateId: string,
    options?: {
      tolerancePercent?: number;
      dateToleranceDays?: number;
      maxStatements?: number;
    },
  ): Promise<MultiMatchSuggestion[]> {
    const response = await api.get(
      "/reconciliation/bank/multi-match/suggestions",
      {
        params: {
          aggregateId,
          ...options,
        },
      },
    );
    return response.data.data;
  },

  /**
   * Get all multi-match groups
   */
  async getReconciliationGroups(
    params: GetSummaryParams,
  ): Promise<ReconciliationGroup[]> {
    const response = await api.get(
      "/reconciliation/bank/multi-match/groups",
      { params },
    );
    return response.data.data;
  },

  /**
   * Get single group details
   */
  async getMultiMatchGroup(
    groupId: string,
  ): Promise<ReconciliationGroup> {
    const response = await api.get(
      `/reconciliation/bank/multi-match/${groupId}`,
    );
    return response.data.data;
  },

  // =====================================================
  // REVERSE MATCHING API METHODS
  // =====================================================

  /**
   * Get all unreconciled bank statements (for reverse matching modal)
   */
  async getUnreconciledStatements(
    bankAccountId?: number,
  ): Promise<BankStatementWithMatch[]> {
    const params = bankAccountId ? { bankAccountId } : {};
    const response = await api.get(
      "/reconciliation/bank/statements/unreconciled",
      { params },
    );
    return response.data.data;
  },

  /**
   * Find bank statements by amount (for reverse matching)
   */
  async findStatementsByAmount(
    amount: number,
    tolerance?: number,
  ): Promise<BankStatementWithMatch[]> {
    const params: { amount: number; tolerance?: number } = { amount };
    if (tolerance !== undefined) {
      params.tolerance = tolerance;
    }
    const response = await api.get(
      "/reconciliation/bank/statements/find-by-amount",
      { params },
    );
    return response.data.data;
  },
};

