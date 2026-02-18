import { useState, useCallback, useRef, useEffect } from "react";
import type {
  ReconciliationSummary,
  BankStatementWithMatch,
  AutoMatchPreviewRequest,
  AutoMatchConfirmRequest,
  AutoMatchPreviewResponse,
  ManualReconcileRequest,
  BankAccountStatus,
  PotentialMatch,
  ReconciliationGroup,
  MultiMatchSuggestion,
  MultiMatchRequest,
  SettlementGroup,
  SettlementGroupQueryDto,
} from "../types/bank-reconciliation.types";
import type { AggregatedTransactionListItem } from "@/features/pos-aggregates/types";
import { bankReconciliationApi } from "../api/bank-reconciliation.api";
import type { PaginationMeta, BankStatementFilterParams } from "../api/bank-reconciliation.api";
import type { BankStatementFilter } from "../components/BankReconciliationFilters";
import { PAGINATION_CONFIG } from "../constants/reconciliation.config";

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

  // Pagination state - sesuai dengan PaginationMeta dari backend
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: PAGINATION_CONFIG.DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });

  // Ref untuk pagination (untuk useCallback tanpa deps)
  const paginationRef = useRef(pagination);
  useEffect(() => {
    paginationRef.current = pagination;
  }, [pagination]);

  // =====================================================
  // MULTI-MATCH STATE
  // =====================================================
  const [reconciliationGroups, setReconciliationGroups] = useState<
    ReconciliationGroup[]
  >([]);
  const [reconciliationGroupsError, setReconciliationGroupsError] = useState<string | null>(null);
  const [multiMatchSuggestions, setMultiMatchSuggestions] = useState<
    MultiMatchSuggestion[]
  >([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [selectedStatementIds, setSelectedStatementIds] = useState<string[]>([]);
  const [selectedAggregate, setSelectedAggregate] = useState<
    AggregatedTransactionListItem | null
  >(null);

  // =====================================================
  // SETTLEMENT GROUPS STATE (1 Bank Statement → Many Aggregates)
  // =====================================================
  const [settlementGroups, setSettlementGroups] = useState<SettlementGroup[]>([]);
  const [settlementGroupsError, setSettlementGroupsError] = useState<string | null>(null);
  const [settlementGroupsTotal, setSettlementGroupsTotal] = useState(0);

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
        
        const paginationMeta = result.pagination as PaginationMeta;
        setPagination(prev => ({
          ...prev,
          page: 1,
          total: paginationMeta.total ?? result.data.length,
          totalPages: paginationMeta.totalPages ?? 1,
          hasNext: paginationMeta.hasNext ?? result.data.length === prev.limit,
          hasPrev: paginationMeta.hasPrev ?? false,
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

        const page = resetPagination ? 1 : paginationRef.current.page;
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

        const paginationMeta = result.pagination as PaginationMeta;
        setPagination(prev => ({
          ...prev,
          page,
          limit,
          total: paginationMeta.total ?? result.data.length,
          totalPages: paginationMeta.totalPages ?? 1,
          hasNext: paginationMeta.hasNext ?? result.data.length === limit,
          hasPrev: paginationMeta.hasPrev ?? page > 1,
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
    [], // Empty deps - using functional pattern with resetPagination param
  );

  // Go to specific page
  const setPage = useCallback(async (page: number) => {
    if (page < 1 || page > paginationRef.current.totalPages) return;

    setIsLoading(true);
    try {
      const params: BankStatementFilterParams = {
        ...lastFetchParams,
        page,
        limit: paginationRef.current.limit,
      };

      const result = await bankReconciliationApi.getStatementsDirect(params);
      setStatements(result.data);

      const paginationMeta = result.pagination as PaginationMeta;
      setPagination(prev => ({
        ...prev,
        page,
        total: paginationMeta.total ?? result.data.length,
        totalPages: paginationMeta.totalPages ?? 1,
        hasNext: paginationMeta.hasNext ?? result.data.length === prev.limit,
        hasPrev: paginationMeta.hasPrev ?? page > 1,
      }));
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch page",
      );
    } finally {
      setIsLoading(false);
    }
  }, [lastFetchParams]);

  // Go to specific page size
  const setPageSize = useCallback(async (pageSize: number) => {
    setIsLoading(true);
    try {
      const params: BankStatementFilterParams = {
        ...lastFetchParams,
        page: 1,
        limit: pageSize,
      };

      const result = await bankReconciliationApi.getStatementsDirect(params);
      setStatements(result.data);

      const paginationMeta = result.pagination as PaginationMeta;
      setPagination(prev => ({
        ...prev,
        page: 1,
        limit: pageSize,
        total: paginationMeta.total ?? result.data.length,
        totalPages: paginationMeta.totalPages ?? 1,
        hasNext: paginationMeta.hasNext ?? result.data.length === pageSize,
        hasPrev: false,
      }));
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch page",
      );
    } finally {
      setIsLoading(false);
    }
  }, [lastFetchParams]);

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
    setPagination(prev => ({ ...prev, page: 1, total: 0, totalPages: 0, hasNext: false, hasPrev: false }));
  }, []);

  // Set filter applied flag
  const setFilterApplied = useCallback((applied: boolean) => {
    setIsFilterApplied(applied);
  }, []);

  // =====================================================
  // RECONCILIATION METHODS
  // =====================================================

  const previewAutoMatch = useCallback(
    async (
      payload: Omit<AutoMatchPreviewRequest, "companyId">,
    ): Promise<AutoMatchPreviewResponse> => {
      setIsLoading(true);
      try {
        const result = await bankReconciliationApi.previewAutoMatch({ ...payload });
        return result;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Preview auto-match failed");
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const confirmAutoMatch = useCallback(
    async (payload: Omit<AutoMatchConfirmRequest, "companyId">) => {
      setIsLoading(true);
      try {
        const result = await bankReconciliationApi.confirmAutoMatch({ ...payload });
        return result;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Confirm auto-match failed");
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
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
      setReconciliationGroupsError(null);
      setIsLoading(true);
      try {
        const groups = await bankReconciliationApi.getReconciliationGroups({
          startDate,
          endDate,
        });
        setReconciliationGroups(groups);
        return groups;
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Failed to fetch reconciliation groups";
        setReconciliationGroupsError(errorMessage);
        console.error("Error fetching reconciliation groups:", err);
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
  // SETTLEMENT GROUPS METHODS (1 Bank Statement → Many Aggregates)
  // =====================================================

  const fetchSettlementGroups = useCallback(
    async (params: SettlementGroupQueryDto) => {
      setSettlementGroupsError(null);
      setIsLoading(true);
      try {
        const result = await bankReconciliationApi.getSettlementGroups(params);
        setSettlementGroups(result.data);
        setSettlementGroupsTotal(result.total);
        return result;
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Failed to fetch settlement groups";
        setSettlementGroupsError(errorMessage);
        console.error("Error fetching settlement groups:", err);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const deleteSettlementGroup = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      await bankReconciliationApi.deleteSettlementGroup(id);
      // Refresh the list after deletion
      setSettlementGroups(prev => prev.filter(g => g.id !== id));
      setSettlementGroupsTotal(prev => prev - 1);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to delete settlement group",
      );
      throw err;
    } finally {
      setIsLoading(false);
    }
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
    previewAutoMatch,
    confirmAutoMatch,
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
    setPage,
    setPageSize,
    pagination,

    // Multi-match state & methods
    reconciliationGroups,
    reconciliationGroupsError,
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

    // Settlement groups state & methods (1 Bank Statement → Many Aggregates)
    settlementGroups,
    settlementGroupsError,
    settlementGroupsTotal,
    fetchSettlementGroups,
    deleteSettlementGroup,
  };
}

