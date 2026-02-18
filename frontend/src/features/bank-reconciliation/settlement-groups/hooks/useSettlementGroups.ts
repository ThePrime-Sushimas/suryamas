
/**
 * Settlement Groups Hook
 * State management for settlement groups feature using TanStack Query + Zustand
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { create } from "zustand";
import { useState, useEffect } from "react";
import { settlementGroupsApi } from "../api/settlement-groups.api";
import type {
  CreateSettlementGroupRequest,
  SettlementGroupQueryDto,
  GetAvailableAggregatesRequest,
  GetSuggestionsRequest,
  SettlementWizardStep,
  GetAvailableBankStatementsRequest,
} from "../types/settlement-groups.types";

// ==================== ZUSTAND STORE ====================

interface SettlementGroupsState {
  // Wizard state
  wizardSteps: SettlementWizardStep[];
  currentStep: number;
  selectedBankStatement: string | null;
  selectedBankStatementData: {
    id: string;
    transaction_date: string;
    description: string;
    amount: number;
  } | null;
  wizardNotes: string;
  overrideDifference: boolean;

  // Actions
  setCurrentStep: (step: number) => void;
  setSelectedBankStatement: (id: string | null, data?: { id: string; transaction_date: string; description: string; amount: number } | null) => void;
  setWizardNotes: (notes: string) => void;
  setOverrideDifference: (value: boolean) => void;
  resetWizard: () => void;
}

const initialWizardSteps: SettlementWizardStep[] = [
  {
    id: 'select-statement',
    title: 'Select Bank Statement',
    description: 'Choose the bank statement to reconcile',
    isCompleted: false,
    isActive: true,
  },
  {
    id: 'select-aggregates',
    title: 'Select Aggregates',
    description: 'Choose POS aggregates to match',
    isCompleted: false,
    isActive: false,
  },
  {
    id: 'review-confirm',
    title: 'Review & Confirm',
    description: 'Review the settlement and confirm',
    isCompleted: false,
    isActive: false,
  },
];

// Create the store with proper typing
const useSettlementGroupsStore = create<SettlementGroupsState>((set) => ({
  // Initial state
  wizardSteps: initialWizardSteps,
  currentStep: 0,
  selectedBankStatement: null,
  selectedBankStatementData: null,
  wizardNotes: '',
  overrideDifference: false,

  // Actions
  setCurrentStep: (step) =>
    set((state) => ({
      currentStep: step,
      wizardSteps: state.wizardSteps.map((s, index) => ({
        ...s,
        isActive: index === step,
        isCompleted: index < step,
      })),
    })),

  setSelectedBankStatement: (id, data = null) =>
    set({
      selectedBankStatement: id,
      selectedBankStatementData: data
    }),

  setWizardNotes: (notes) => set({ wizardNotes: notes }),

  setOverrideDifference: (value) => set({ overrideDifference: value }),

  resetWizard: () =>
    set({
      currentStep: 0,
      selectedBankStatement: null,
      selectedBankStatementData: null,
      wizardNotes: '',
      overrideDifference: false,
      wizardSteps: initialWizardSteps.map((s, index) => ({
        ...s,
        isCompleted: false,
        isActive: index === 0,
      })),
    }),
}));

// Export the store hook and state interface
export { useSettlementGroupsStore };
export type { SettlementGroupsState };

// ==================== TANSTACK QUERY HOOKS ====================

/**
 * Hook for fetching settlement groups list
 */
export const useSettlementGroups = (params?: SettlementGroupQueryDto) => {
  return useQuery({
    queryKey: ['settlement-groups', params],
    queryFn: () => settlementGroupsApi.getSettlementGroups(params || {}),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Hook for fetching settlement groups with pagination helpers
 */
export const useSettlementGroupsPaginated = (params?: SettlementGroupQueryDto) => {
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });

  const queryKey = ['settlement-groups', { ...params, page: pagination.page, limit: pagination.limit }];
  
  const { data, isLoading, refetch } = useQuery({
    queryKey,
    queryFn: () => {
      // Convert page to offset for API
      const offset = (pagination.page - 1) * pagination.limit;
      return settlementGroupsApi.getSettlementGroups({ 
        ...params, 
        limit: pagination.limit, 
        offset 
      });
    },
    staleTime: 5 * 60 * 1000,
  });

  // Update pagination state when data changes
  useEffect(() => {
    if (data) {
      setPagination({
        page: data.page || pagination.page,
        limit: data.limit || pagination.limit,
        total: data.total || 0,
        totalPages: Math.ceil((data.total || 0) / (data.limit || pagination.limit)),
        hasNext: data.hasNext || false,
        hasPrev: data.hasPrev || false,
      });
    }
  }, [data]);

  const setPage = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination(prev => ({ ...prev, page: newPage }));
    }
  };

  const setPageSize = (newLimit: number) => {
    setPagination(prev => ({ ...prev, page: 1, limit: newLimit }));
  };

  return {
    data,
    isLoading,
    refetch,
    pagination,
    setPage,
    setPageSize,
  };
};

/**
 * Hook for fetching single settlement group
 */
export const useSettlementGroup = (id: string) => {
  return useQuery({
    queryKey: ['settlement-group', id],
    queryFn: () => settlementGroupsApi.getSettlementGroupById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Hook for fetching available aggregates
 */
export const useAvailableAggregates = (params: GetAvailableAggregatesRequest) => {
  return useQuery({
    queryKey: ['available-aggregates', params],
    queryFn: () => settlementGroupsApi.getAvailableAggregates(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

/**
 * Hook for fetching AI suggestions
 */
export const useAISuggestions = (params: GetSuggestionsRequest) => {
  return useQuery({
    queryKey: ['ai-suggestions', params],
    queryFn: () => settlementGroupsApi.getSuggestedAggregates(params),
    enabled: !!params.targetAmount,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
};

/**
 * Hook for settlement groups summary
 */
export const useSettlementGroupsSummary = (params: {
  startDate: string;
  endDate: string;
}) => {
  return useQuery({
    queryKey: ['settlement-groups-summary', params],
    queryFn: () => settlementGroupsApi.getSettlementGroupsSummary(params),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

// ==================== MUTATIONS ====================

/**
 * Mutation for creating settlement group
 */
export const useCreateSettlementGroup = () => {
  const queryClient = useQueryClient();
  const resetWizard = useSettlementGroupsStore((state) => state.resetWizard);

  return useMutation({
    mutationFn: (payload: CreateSettlementGroupRequest) =>
      settlementGroupsApi.createSettlementGroup(payload),
    onSuccess: () => {
      // Invalidate and refetch settlement groups
      queryClient.invalidateQueries({ queryKey: ['settlement-groups'] });
      queryClient.invalidateQueries({ queryKey: ['settlement-groups-summary'] });
      queryClient.invalidateQueries({ queryKey: ['available-aggregates'] });

      // Reset wizard state
      resetWizard();
    },
  });
};

/**
 * Mutation for deleting a settlement group (HARD DELETE)
 */
export const useDeleteSettlementGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => settlementGroupsApi.deleteSettlementGroup(id),
    onSuccess: () => {
      // Invalidate and refetch all related queries
      queryClient.invalidateQueries({ queryKey: ['settlement-groups'] });
      queryClient.invalidateQueries({ queryKey: ['settlement-groups-summary'] });
      queryClient.invalidateQueries({ queryKey: ['available-aggregates'] });
      queryClient.invalidateQueries({ queryKey: ['available-bank-statements'] });
      queryClient.invalidateQueries({ queryKey: ['bank-mutations'] });
    },
  });
};

/**
 * Hook for fetching available bank statements for settlement
 */
export const useAvailableBankStatements = (params?: GetAvailableBankStatementsRequest) => {
  return useQuery({
    queryKey: ['available-bank-statements', params],
    queryFn: () => settlementGroupsApi.getAvailableBankStatements(params),
    staleTime: 2 * 60 * 1000, // 2 minutes - data changes when statements get reconciled
  });
};

/**
 * Hook for fetching available aggregates for settlement
 */
export const useAvailableAggregatesForSettlement = (params?: GetAvailableAggregatesRequest) => {
  return useQuery({
    queryKey: ['available-aggregates-for-settlement', params],
    queryFn: () => settlementGroupsApi.getAvailableAggregates(params || {}),
    staleTime: 0, // Always refetch to get latest unreconciled status
  });
};

