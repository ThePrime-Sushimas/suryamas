/**
 * Settlement Groups API
 * API integration for settlement groups feature
 */

import api from "@/lib/axios";
import type {
  SettlementGroup,
  CreateSettlementGroupRequest,
  CreateSettlementGroupResultDto,
  SettlementGroupQueryDto,
  SettlementGroupListResponse,
  GetAvailableAggregatesRequest,
  AvailableAggregatesResponse,
  GetSuggestionsRequest,
  AISuggestion,
  AvailableAggregateDto,
  GetAvailableBankStatementsRequest,
  AvailableBankStatementsResponse,
} from "../types/settlement-groups.types";

// Standard Pagination interface - aligned with backend
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export const settlementGroupsApi = {
  /**
   * Create a new settlement group
   */
  async createSettlementGroup(
    payload: CreateSettlementGroupRequest
  ): Promise<CreateSettlementGroupResultDto> {
    const response = await api.post("/settlement-group/create", payload);
    return response.data.data;
  },

  /**
   * Get settlement group by ID
   */
  async getSettlementGroupById(id: string): Promise<SettlementGroup> {
    const response = await api.get(`/settlement-group/${id}`);
    return response.data.data;
  },

  /**
   * Get settlement groups list with filters
   */
  async getSettlementGroups(
    params: SettlementGroupQueryDto
  ): Promise<SettlementGroupListResponse> {
    const response = await api.get("/settlement-group/list", { params });
    return response.data as SettlementGroupListResponse;
  },

  /**
   * Get settlement groups summary
   */
  async getSettlementGroupsSummary(params: {
    startDate: string;
    endDate: string;
  }): Promise<{
    totalGroups: number;
    totalAmount: number;
    reconciledCount: number;
    pendingCount: number;
    discrepancyCount: number;
  }> {
    const response = await api.get("/settlement-group/summary", { params });
    return response.data.data;
  },

  /**
   * Soft delete a settlement group
   * @param id - Settlement group ID
   * @param options - Options for soft delete
   * @param options.revertReconciliation - If true, will also revert is_reconciled to false
   */
  async softDeleteSettlementGroup(
    id: string,
    options?: { revertReconciliation?: boolean }
  ): Promise<void> {
    const params = options?.revertReconciliation ? { revertReconciliation: 'true' } : {};
    await api.delete(`/settlement-group/${id}/soft-delete`, { params });
  },

  /**
   * Get deleted settlement groups (for Trash View)
   */
  async getDeletedSettlementGroups(params?: {
    limit?: number;
    offset?: number;
  }): Promise<SettlementGroupListResponse> {
    const response = await api.get("/settlement-group/list/deleted", { params });
    return response.data as SettlementGroupListResponse;
  },

  /**
   * Restore a deleted settlement group
   */
  async restoreSettlementGroup(id: string): Promise<void> {
    await api.post(`/settlement-group/${id}/restore`);
  },

  /**
   * Get available aggregates for settlement
   */
  async getAvailableAggregates(
    params: GetAvailableAggregatesRequest
  ): Promise<AvailableAggregatesResponse> {
    const response = await api.get("/settlement-group/aggregates/available", {
      params,
    });
    return response.data;
  },

  /**
   * Get aggregates for a specific settlement group
   */
  async getSettlementAggregates(id: string): Promise<AvailableAggregateDto[]> {
    const response = await api.get(`/settlement-group/${id}/aggregates`);
    return response.data.data;
  },

  /**
   * Get AI suggested aggregates
   */
  async getSuggestedAggregates(
    params: GetSuggestionsRequest
  ): Promise<AISuggestion[]> {
    const response = await api.get("/settlement-group/suggestions", {
      params,
    });
    return response.data.data;
  },

  /**
   * Get available bank statements for settlement (unreconciled)
   * Uses existing endpoint from bank-reconciliation module
   */
  async getAvailableBankStatements(
    params?: GetAvailableBankStatementsRequest
  ): Promise<AvailableBankStatementsResponse> {
    // Use the existing endpoint from bank-reconciliation module
    const response = await api.get("/reconciliation/bank/statements/unreconciled", {
      params: {
        bankAccountId: params?.bankAccountId,
        search: params?.search,
        limit: params?.limit || 50,
        offset: params?.offset || 0,
      },
    });
    return {
      data: response.data.data,
      total: response.data.data.length,
    };
  },
};

