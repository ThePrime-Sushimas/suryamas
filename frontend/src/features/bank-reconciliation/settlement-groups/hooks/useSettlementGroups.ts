
/**
 * Settlement Groups Hook
 * State management for settlement groups feature using TanStack Query + Zustand
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { create } from "zustand";
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
 * Mutation for soft deleting a settlement group
 * Default: revertReconciliation = true (is_reconciled will be set to false)
 */
export const useSoftDeleteSettlementGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, options }: { id: string; options?: { revertReconciliation?: boolean } }) =>
      // FIX: options?.revertReconciliation ?? true allows user override, defaults to true
      settlementGroupsApi.softDeleteSettlementGroup(id, { 
        revertReconciliation: options?.revertReconciliation ?? true 
      }),
    onSuccess: () => {
      // Invalidate and refetch all related queries
      queryClient.invalidateQueries({ queryKey: ['settlement-groups'] });
      queryClient.invalidateQueries({ queryKey: ['deleted-settlement-groups'] });
      queryClient.invalidateQueries({ queryKey: ['settlement-groups-summary'] });
      queryClient.invalidateQueries({ queryKey: ['available-aggregates'] });
      queryClient.invalidateQueries({ queryKey: ['available-bank-statements'] });
      queryClient.invalidateQueries({ queryKey: ['bank-mutations'] });
    },
  });
};

/**
 * Hook for fetching deleted settlement groups (for Trash View)
 */
export const useDeletedSettlementGroups = (params?: {
  limit?: number;
  offset?: number;
}) => {
  return useQuery({
    queryKey: ['deleted-settlement-groups', params],
    queryFn: () => settlementGroupsApi.getDeletedSettlementGroups(params),
    staleTime: 0, // Always refetch
  });
};

/**
 * Mutation for restoring deleted settlement group
 */
export const useRestoreSettlementGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => settlementGroupsApi.restoreSettlementGroup(id),
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['deleted-settlement-groups'] });
      queryClient.invalidateQueries({ queryKey: ['settlement-groups'] });
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

