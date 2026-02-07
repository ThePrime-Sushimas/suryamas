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
import type { BankStatementFilter } from "../components/BankReconciliationFilters";
import { PAGINATION_CONFIG } from "../constants/reconciliation.config";

export type { BankStatementFilter }

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

  // Filter state - centralized in hook (single source of truth)
  const [filter, setFilterState] = useState<BankStatementFilter>({});
  const [isFilterApplied, setIsFilterApplied] = useState(false);
  const [lastFetchParams, setLastFetchParams] = useState<BankStatementFilterParams | null>(null);

  // Pagination state
  const [pagination, setPagination] = useState<{
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  }>({
    page: 1,
    limit: PAGINATION_CONFIG.DEFAULT_PAGE_SIZE,
    total: 0,
    hasMore: false,
  });

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

  // =====================================================
  // SUMMARY & ACCOUNTS METHODS
  // =====================================================

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

  // Fetch all bank accounts for filter dropdown (no date filter needed)
  const fetchAllBankAccounts = useCallback(async () => {
    try {
      const accounts = await bankReconciliationApi.getAllBankAccounts();
      setBankAccounts(accounts);
    } catch (err: unknown) {
      console.error("Failed to fetch bank accounts:", err);
    }
  }, []);

  // =====================================================
  // STATEMENTS METHODS
  // =====================================================

  const fetchStatements = useCallback(
    async (startDate?: string, endDate?: string, bankAccountId?: number) => {
      setIsLoading(true);
      try {
        const params: BankStatementFilterParams = {
          startDate,
          endDate,
          bankAccountId,
          page: 1,
          limit: PAGINATION_CONFIG.DEFAULT_PAGE_SIZE,
        };

        const result = await bankReconciliationApi.getStatementsDirect(params);
        setStatements(result.data);
        
        const totalItems = (result.pagination as { total?: number } | undefined)?.total ?? result.data.length;
        setPagination(prev => ({
          ...prev,
          page: 1,
          total: totalItems,
          hasMore: result.data.length === prev.limit,
        }));
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

  // Fetch statements with full filter support and proper pagination
  const fetchStatementsWithFilters = useCallback(
    async (filters: BankStatementFilter, resetPagination = true) => {
      setIsLoading(true);
      try {
        const bankAccountId = filters.bankAccountIds && filters.bankAccountIds.length > 0
          ? filters.bankAccountIds[0]
          : undefined;

        const validStatuses = ['RECONCILED', 'UNRECONCILED', 'DISCREPANCY'] as const;
        const statusParam = validStatuses.includes(filters.status as typeof validStatuses[number]) 
          ? filters.status as 'RECONCILED' | 'UNRECONCILED' | 'DISCREPANCY'
          : undefined;

        const page = resetPagination ? 1 : pagination.page;
        const limit = filters.limit || PAGINATION_CONFIG.DEFAULT_PAGE_SIZE;

        const safeStatus = statusParam as 'RECONCILED' | 'UNRECONCILED' | 'DISCREPANCY' | undefined;

        const params: BankStatementFilterParams = {
          startDate: filters.startDate,
          endDate: filters.endDate,
          bankAccountId,
          status: safeStatus,
          search: filters.search,
          isReconciled: filters.isReconciled,
          sort: filters.sort || 'transaction_date',
          order: filters.order || 'desc',
          page,
          limit,
        };

        const result = await bankReconciliationApi.getStatementsDirect(params);

        if (resetPagination) {
          setStatements(result.data);
        } else {
          setStatements(prev => [...prev, ...result.data]);
        }

        const paginationResult = result.pagination as { total?: number } | undefined;
        const totalItems = paginationResult?.total ?? result.data.length;
        setPagination(prev => ({
          ...prev,
          page,
          limit,
          total: totalItems,
          hasMore: result.data.length === limit,
        }));

        const safeParams: BankStatementFilterParams = {
          startDate: filters.startDate,
          endDate: filters.endDate,
          bankAccountId,
          status: safeStatus,
          search: filters.search,
          isReconciled: filters.isReconciled,
          sort: filters.sort || 'transaction_date',
          order: filters.order || 'desc',
          page,
          limit,
        };
        setLastFetchParams(safeParams);
        
        setFilterState(filters);
        setIsFilterApplied(true);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch statements",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [pagination.page],
  );

  // Load more statements for infinite scroll
  const loadMoreStatements = useCallback(async () => {
    if (!pagination.hasMore || !lastFetchParams) return;

    setIsLoading(true);
    try {
      const nextPage = pagination.page + 1;
      
      const params: BankStatementFilterParams = {
        ...lastFetchParams,
        page: nextPage,
        limit: pagination.limit,
      };

      const result = await bankReconciliationApi.getStatementsDirect(params);
      setStatements(prev => [...prev, ...result.data]);
      
      setPagination(prev => ({
        ...prev,
        page: nextPage,
        hasMore: result.data.length === pagination.limit,
      }));
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to load more statements",
      );
    } finally {
      setIsLoading(false);
    }
  }, [pagination, lastFetchParams]);

  // =====================================================
  // FILTER METHODS
  // =====================================================

  const setFilter = useCallback((updates: Partial<BankStatementFilter>) => {
    setFilterState(prev => ({ ...prev, ...updates }));
  }, []);

  // Clear filter state
  const clearFilter = useCallback(() => {
    setFilterState({});
    setIsFilterApplied(false);
    setLastFetchParams(null);
    setStatements([]);
    setPagination(prev => ({ ...prev, page: 1, total: 0, hasMore: false }));
  }, []);

  // Set filter applied flag
  const setFilterApplied = useCallback((applied: boolean) => {
    setIsFilterApplied(applied);
  }, []);

  // =====================================================
  // RECONCILIATION METHODS
  // =====================================================

  const autoMatch = useCallback(
    async (payload: Omit<AutoMatchRequest, "companyId">) => {
      setIsLoading(true);
      try {
        await bankReconciliationApi.autoMatch({ ...payload });
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

  // =====================================================
  // RETURN
  // =====================================================

  return {
    summary,
    statements,
    bankAccounts,
    isLoading,
    error,
    fetchSummary,
    fetchStatements,
    fetchAllBankAccounts,
    autoMatch,
    manualReconcile,
    undoReconciliation,
    fetchPotentialMatches,
    potentialMatchesMap,
    isLoadingMatches,

    // Filter state & methods
    filter,
    setFilter,
    clearFilter,
    isFilterApplied,
    setFilterApplied,
    fetchStatementsWithFilters,
    loadMoreStatements,
    pagination,

    // Multi-match state & methods
    reconciliationGroups,
    multiMatchSuggestions,
    isLoadingSuggestions,
    selectedStatementIds,
    setSelectedStatementIds,
    selectedAggregate,
    setSelectedAggregate,

    createMultiMatch,
    undoMultiMatch,
    fetchSuggestedGroupStatements,
    fetchReconciliationGroups,
    getMultiMatchGroup,
    clearMultiMatchSuggestions,
  };
}

