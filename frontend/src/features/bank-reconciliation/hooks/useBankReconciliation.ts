import { useState, useCallback } from "react";
import type {
  ReconciliationSummary,
  BankStatementWithMatch,
  AutoMatchRequest,
  ManualReconcileRequest,
  BankAccountStatus,
  PotentialMatch,
  ReconciliationGroup,
  MultiMatchSuggestion,
  MultiMatchRequest,
} from "../types/bank-reconciliation.types";
import type { AggregatedTransactionListItem } from "@/features/pos-aggregates/types";
import { bankReconciliationApi } from "../api/bank-reconciliation.api";
import type { BankStatementFilterParams } from "../api/bank-reconciliation.api";
import type { BankStatementFilter, BankStatementFilterStatus } from "../components/BankReconciliationFilters";

// Re-export types for backward compatibility
export type { BankStatementFilter, BankStatementFilterStatus }

export function useBankReconciliation() {
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);
  const [statements, setStatements] = useState<BankStatementWithMatch[]>([]);
  const [potentialMatchesMap, setPotentialMatchesMap] = useState<
    Record<string, PotentialMatch[]>
  >({});
  const [isLoadingMatches, setIsLoadingMatches] = useState<
    Record<string, boolean>
  >({});
  const [bankAccounts, setBankAccounts] = useState<BankAccountStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [filter, setFilterState] = useState<BankStatementFilter>({});
  const [isFilterApplied, setIsFilterApplied] = useState(false);

  // =====================================================
  // MULTI-MATCH STATE
  // =====================================================
  const [reconciliationGroups, setReconciliationGroups] = useState<
    ReconciliationGroup[]
  >([]);
  const [multiMatchSuggestions, setMultiMatchSuggestions] = useState<
    MultiMatchSuggestion[]
  >([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [selectedStatementIds, setSelectedStatementIds] = useState<string[]>([]);
  const [selectedAggregate, setSelectedAggregate] = useState<
    AggregatedTransactionListItem | null
  >(null);

  const fetchSummary = useCallback(
    async (startDate: string, endDate: string) => {
      setIsLoading(true);
      try {
        const [summaryData, accountsData] = await Promise.all([
          bankReconciliationApi.getSummary({ startDate, endDate }),
          bankReconciliationApi.getBankAccountsStatus({
            startDate,
            endDate,
          }),
        ]);
        setSummary(summaryData);
        setBankAccounts(accountsData);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch summary",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const fetchStatements = useCallback(
    async (startDate?: string, endDate?: string, bankAccountId?: number) => {
      setIsLoading(true);
      try {
        // Build params with optional dates
        const params: BankStatementFilterParams = {
          startDate,
          endDate,
          bankAccountId,
        };

        const result = await bankReconciliationApi.getStatementsDirect(params);
        setStatements(result.data);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch statements",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // Fetch statements with full filter support
  const fetchStatementsWithFilters = useCallback(
    async (filters: BankStatementFilter) => {
      setIsLoading(true);
      try {
        // Get first selected bank account ID if multiple selected
        const bankAccountId = filters.bankAccountIds && filters.bankAccountIds.length > 0
          ? filters.bankAccountIds[0]
          : undefined;

        // Only send valid status values (not empty string)
        const validStatuses = ['RECONCILED', 'UNRECONCILED', 'DISCREPANCY'] as const;
        const statusParam = validStatuses.includes(filters.status as typeof validStatuses[number]) 
          ? filters.status as 'RECONCILED' | 'UNRECONCILED' | 'DISCREPANCY'
          : undefined;

        const params: BankStatementFilterParams = {
          startDate: filters.startDate,
          endDate: filters.endDate,
          bankAccountId,
          status: statusParam,
          search: filters.search,
          isReconciled: filters.isReconciled,
          sort: filters.sort || 'transaction_date',
          order: filters.order || 'desc',
          page: filters.page || 1,
          limit: filters.limit || 10000, // Default to large limit to get all data
        };

        const result = await bankReconciliationApi.getStatementsDirect(params);
        setStatements(result.data);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch statements",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // Set filter state
  const setFilter = useCallback((updates: Partial<BankStatementFilter> | BankStatementFilter | ((prev: BankStatementFilter) => Partial<BankStatementFilter>)) => {
    setFilterState(prev => {
      if (typeof updates === 'function') {
        const partialUpdates = updates(prev);
        return { ...prev, ...partialUpdates };
      }
      return { ...prev, ...updates };
    });
  }, []);

  // Clear filter state
  const clearFilter = useCallback(() => {
    setFilterState({});
    setIsFilterApplied(false);
  }, []);

  // Set filter applied flag
  const setFilterApplied = useCallback((applied: boolean) => {
    setIsFilterApplied(applied);
  }, []);

  const autoMatch = useCallback(
    async (payload: Omit<AutoMatchRequest, "companyId">) => {
      setIsLoading(true);
      try {
        await bankReconciliationApi.autoMatch({ ...payload });
        // Refresh summary and statements after auto-match
        await Promise.all([
          fetchSummary(payload.startDate, payload.endDate),
          fetchStatements(
            payload.startDate,
            payload.endDate,
            payload.bankAccountId,
          ),
        ]);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Auto-match failed");
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchSummary, fetchStatements],
  );

  const manualReconcile = useCallback(
    async (payload: Omit<ManualReconcileRequest, "companyId">) => {
      setIsLoading(true);
      try {
        await bankReconciliationApi.manualReconcile({ ...payload });
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Manual reconciliation failed",
        );
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const undoReconciliation = useCallback(async (statementId: string) => {
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
  }, []);

  const fetchPotentialMatches = useCallback(
    async (statementId: string) => {
      if (potentialMatchesMap[statementId]) return;

      setIsLoadingMatches((prev) => ({ ...prev, [statementId]: true }));
      try {
        const matches = await bankReconciliationApi.getPotentialMatches(statementId);
        setPotentialMatchesMap((prev) => ({ ...prev, [statementId]: matches }));
      } catch (err: unknown) {
        console.error("Failed to fetch potential matches:", err);
      } finally {
        setIsLoadingMatches((prev) => ({ ...prev, [statementId]: false }));
      }
    },
    [potentialMatchesMap],
  );

  // =====================================================
  // MULTI-MATCH METHODS
  // =====================================================

  const createMultiMatch = useCallback(
    async (payload: Omit<MultiMatchRequest, "companyId">) => {
      setIsLoading(true);
      try {
        await bankReconciliationApi.createMultiMatch({ ...payload });
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Multi-match failed",
        );
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const undoMultiMatch = useCallback(async (groupId: string) => {
    setIsLoading(true);
    try {
      await bankReconciliationApi.undoMultiMatch(groupId);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to undo multi-match",
      );
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchSuggestedGroupStatements = useCallback(
    async (aggregateId: string) => {
      setIsLoadingSuggestions(true);
      try {
        const suggestions = await bankReconciliationApi.getSuggestedGroupStatements(aggregateId);
        setMultiMatchSuggestions(suggestions);
        return suggestions;
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to fetch suggestions",
        );
        throw err;
      } finally {
        setIsLoadingSuggestions(false);
      }
    },
    [],
  );

  const fetchReconciliationGroups = useCallback(
    async (startDate: string, endDate: string) => {
      setIsLoading(true);
      try {
        const groups = await bankReconciliationApi.getReconciliationGroups({
          startDate,
          endDate,
        });
        setReconciliationGroups(groups);
        return groups;
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to fetch reconciliation groups",
        );
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const getMultiMatchGroup = useCallback(
    async (groupId: string) => {
      setIsLoading(true);
      try {
        const group = await bankReconciliationApi.getMultiMatchGroup(groupId);
        return group;
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to fetch group details",
        );
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const clearMultiMatchSuggestions = useCallback(() => {
    setMultiMatchSuggestions([]);
    setSelectedStatementIds([]);
    setSelectedAggregate(null);
  }, []);

  return {
    // Existing state and methods
    summary,
    statements,
    bankAccounts,
    isLoading,
    error,
    fetchSummary,
    fetchStatements,
    autoMatch,
    manualReconcile,
    undoReconciliation,
    fetchPotentialMatches,
    potentialMatchesMap,
    isLoadingMatches,

    // =====================================================
    // FILTER STATE & METHODS
    // =====================================================
    filter,
    setFilter,
    clearFilter,
    isFilterApplied,
    setFilterApplied,
    fetchStatementsWithFilters,

    // =====================================================
    // MULTI-MATCH STATE & METHODS
    // =====================================================
    reconciliationGroups,
    multiMatchSuggestions,
    isLoadingSuggestions,
    selectedStatementIds,
    setSelectedStatementIds,
    selectedAggregate,
    setSelectedAggregate,

    // Multi-match methods
    createMultiMatch,
    undoMultiMatch,
    fetchSuggestedGroupStatements,
    fetchReconciliationGroups,
    getMultiMatchGroup,
    clearMultiMatchSuggestions,
  };
}

