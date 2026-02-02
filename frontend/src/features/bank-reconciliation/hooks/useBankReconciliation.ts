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

export function useBankReconciliation(companyId: string) {
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
          bankReconciliationApi.getSummary({ companyId, startDate, endDate }),
          bankReconciliationApi.getBankAccountsStatus({
            companyId,
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
    [companyId],
  );

  const fetchStatements = useCallback(
    async (startDate: string, endDate: string, bankAccountId?: number) => {
      setIsLoading(true);
      try {
        const data = await bankReconciliationApi.getStatements({
          companyId,
          startDate,
          endDate,
          bankAccountId,
        });
        setStatements(data);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch statements",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [companyId],
  );

  const autoMatch = useCallback(
    async (payload: Omit<AutoMatchRequest, "companyId">) => {
      setIsLoading(true);
      try {
        await bankReconciliationApi.autoMatch({ ...payload, companyId });
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
    [companyId, fetchSummary, fetchStatements],
  );

  const manualReconcile = useCallback(
    async (payload: Omit<ManualReconcileRequest, "companyId">) => {
      setIsLoading(true);
      try {
        await bankReconciliationApi.manualReconcile({ ...payload, companyId });
        // Note: Refresh is handled by the calling page using dateRange
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Manual reconciliation failed",
        );
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [companyId],
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
        const matches = await bankReconciliationApi.getPotentialMatches(
          statementId,
          companyId,
        );
        setPotentialMatchesMap((prev) => ({ ...prev, [statementId]: matches }));
      } catch (err: unknown) {
        console.error("Failed to fetch potential matches:", err);
      } finally {
        setIsLoadingMatches((prev) => ({ ...prev, [statementId]: false }));
      }
    },
    [companyId, potentialMatchesMap],
  );

  // =====================================================
  // MULTI-MATCH METHODS
  // =====================================================

  const createMultiMatch = useCallback(
    async (payload: Omit<MultiMatchRequest, "companyId">) => {
      setIsLoading(true);
      try {
        await bankReconciliationApi.createMultiMatch({
          ...payload,
          companyId,
        });
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Multi-match failed",
        );
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [companyId],
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
        const suggestions = await bankReconciliationApi.getSuggestedGroupStatements(
          companyId,
          aggregateId,
        );
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
    [companyId],
  );

  const fetchReconciliationGroups = useCallback(
    async (startDate: string, endDate: string) => {
      setIsLoading(true);
      try {
        const groups = await bankReconciliationApi.getReconciliationGroups({
          companyId,
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
    [companyId],
  );

  const getMultiMatchGroup = useCallback(
    async (groupId: string) => {
      setIsLoading(true);
      try {
        const group = await bankReconciliationApi.getMultiMatchGroup(
          groupId,
          companyId,
        );
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
    [companyId],
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
