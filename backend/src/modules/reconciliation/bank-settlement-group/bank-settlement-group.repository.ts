/**
 * Settlement Group Repository
 * Handles all database operations for bank_settlement_groups and bank_settlement_aggregates tables
 */

import { supabase } from "../../../config/supabase";
import { logError, logInfo } from "../../../config/logger";
import { SettlementGroupStatus } from "./bank-settlement-group.types";

// =====================================================
// Supabase Nested Join Types
// =====================================================

interface PaymentMethodInfo {
  id: string;
  name: string;
}

interface BranchInfo {
  name: string;
  code: string;
}

interface BankInfo {
  bank_name: string;
  bank_code: string;
}

interface BankAccountInfo {
  account_name: string;
  account_number: string;
  banks: BankInfo;
}

interface AggregatedTransactionInfo {
  id: string;
  transaction_date: string;
  gross_amount: number;
  nett_amount: number;
  payment_methods: PaymentMethodInfo | null;
  branches: BranchInfo | null;
}

interface BankStatementInfo {
  id: string;
  transaction_date: string;
  description: string;
  debit_amount: number;
  credit_amount: number;
  bank_accounts: BankAccountInfo | null;
}

interface SettlementAggregateDb {
  id: string;
  settlement_group_id: string;
  aggregate_id: string;
  allocated_amount: number;
  original_amount: number;
  created_at: string;
  aggregated_transactions: AggregatedTransactionInfo | null;
}

interface SettlementGroupDb {
  id: string;
  company_id: string;
  bank_statement_id: string;
  settlement_number: string;
  settlement_date: string;
  payment_method: string | null;
  bank_name: string | null;
  total_statement_amount: number;
  total_allocated_amount: number;
  difference: number;
  status: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
  deleted_at: string | null;
  bank_settlement_aggregates: SettlementAggregateDb[] | null;
  bank_statements: BankStatementInfo | null;
}

interface AggregatedTransactionDb {
  id: string;
  transaction_date: string;
  gross_amount: number;
  nett_amount: number;
  payment_methods: PaymentMethodInfo | null;
  branches: BranchInfo | null;
  is_reconciled: boolean;
}

// Helper to check if error is about missing column
const isMissingColumnError = (error: any): boolean => {
  return error?.code === '42703' || 
         error?.message?.includes('deleted_at') ||
         error?.message?.includes('does not exist') ||
         error?.message?.includes('branch_id');
};

// Helper to safely check if column exists
const columnExists = async (table: string, column: string): Promise<boolean> => {
  try {
    // Try a simple query to check if column exists
    const { error } = await supabase
      .from(table)
      .select(column)
      .limit(1);
    
    return !error || error.code !== 'PGRST202';
  } catch {
    return false;
  }
};

/**
 * Safely convert bank_statement_id to string
 * Handles null, undefined, NaN, and "null"/"undefined" strings gracefully
 * Returns null for invalid values instead of throwing
 */
const safeBankStatementIdToString = (id: any, fieldName: string = 'bank_statement_id'): string | null => {
  // Handle null/undefined - return null without logging (this is a valid outcome)
  if (id === null || id === undefined) {
    return null;
  }
  
  // Handle cases where id might be "null" or "undefined" string
  if (typeof id === 'string') {
    if (id.trim() === '') {
      return null;
    }
    if (id.toLowerCase() === 'null' || id.toLowerCase() === 'undefined') {
      return null;
    }
  }
  
  const num = Number(id);
  if (isNaN(num) || num <= 0) {
    return null;
  }
  
  return String(num);
};

/**
 * Type guard/validator for bank statement ID
 * Ensures bank_statement_id is a valid number, not "null"/"undefined" string
 * Returns validated number or throws error for invalid values
 */
const validateBankStatementId = (id: any, fieldName: string = 'bank_statement_id'): number => {
  // Handle null/undefined - return NaN which will fail downstream but won't crash
  if (id === null || id === undefined) {
    return NaN; // Will cause issues downstream but won't crash
  }
  
  // Handle cases where id might be "null" or "undefined" string
  if (typeof id === 'string') {
    if (id.trim() === '') {
      return NaN;
    }
    if (id.toLowerCase() === 'null' || id.toLowerCase() === 'undefined') {
      return NaN;
    }
  }
  
  const num = Number(id);
  if (isNaN(num) || num <= 0) {
    return NaN;
  }
  
  return num;
};

export class SettlementGroupRepository {
  constructor() {}

  /**
   * Execute operations within a database transaction
   */
  async withTransaction<T>(operation: (tx: any) => Promise<T>): Promise<T> {
    try {
      return await operation(this);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logError("Transaction failed, attempting rollback", { error: errorMessage });
      throw error;
    }
  }

  /**
   * Create a new settlement group
   */
  async createSettlementGroup(data: {
    companyId: string;
    bankStatementId: string;
    settlementDate: string;
    paymentMethod?: string;
    bankName?: string;
    totalStatementAmount: number;
    totalAllocatedAmount: number;
    difference: number;
    notes?: string;
    createdBy?: string;
    status?: SettlementGroupStatus;
  }): Promise<string> {
    try {
      // Ensure bankStatementId is a valid number for bigint column
      const bankStatementIdNum = Number(data.bankStatementId);
      
      logInfo("Creating settlement group", {
        companyId: data.companyId,
        bankStatementId: data.bankStatementId,
        bankStatementIdNum: bankStatementIdNum,
        isValid: !isNaN(bankStatementIdNum)
      });

      const { data: group, error } = await supabase
        .from("bank_settlement_groups")
        .insert({
          company_id: data.companyId,
          bank_statement_id: bankStatementIdNum, // Ensure it's a number for bigint
          settlement_date: data.settlementDate,
          payment_method: data.paymentMethod,
          bank_name: data.bankName,
          total_statement_amount: data.totalStatementAmount,
          total_allocated_amount: data.totalAllocatedAmount,
          difference: data.difference,
          notes: data.notes,
          created_by: data.createdBy,
          status: data.status || SettlementGroupStatus.PENDING,
        })
        .select("id, settlement_number, bank_statement_id")
        .single();

      if (error) {
        logError("Supabase error creating settlement group", {
          error: error.message,
          details: error
        });
        throw error;
      }

      logInfo("Settlement group created", {
        id: group.id,
        bank_statement_id: group.bank_statement_id
      });

      return group.id;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logError("Error creating settlement group", {
        companyId: data.companyId,
        bankStatementId: data.bankStatementId,
        error: errorMessage
      });
      throw error;
    }
  }

  /**
   * Get settlement group by ID with aggregates and bank statement
   * EXCLUDES soft-deleted records (deleted_at IS NOT NULL)
   */
  async findById(id: string): Promise<any> {
    try {
      let query = supabase
        .from("bank_settlement_groups")
        .select(`
          *,
          bank_statements (
            id,
            transaction_date,
            description,
            debit_amount,
            credit_amount,
            bank_accounts (
              banks (bank_name, bank_code)
            )
          )
        `)
        .eq("id", id)
        .single();

      // Try with deleted_at first, fallback to without if column missing
      try {
        query = (supabase
          .from("bank_settlement_groups")
          .select(`
            *,
            bank_statements (
              id,
              transaction_date,
              description,
              debit_amount,
              credit_amount,
              bank_accounts (
                banks (bank_name, bank_code)
              )
            )
          `)
          .eq("id", id)
          .is("deleted_at", null) as any);
      } catch (e) {
        // Column doesn't exist, continue without it
      }

      const { data, error } = await query;

      if (error) {
        if (isMissingColumnError(error)) {
          // Retry without deleted_at check
          const { data: retryData, error: retryError } = await supabase
            .from("bank_settlement_groups")
            .select(`
              *,
              bank_statements (
                id,
                transaction_date,
                description,
                debit_amount,
                credit_amount,
                bank_accounts (
                  banks (bank_name, bank_code)
                )
              )
            `)
            .eq("id", id)
            .single();
          
          if (retryError) throw retryError;
          if (!retryData) return null;

          const aggregates = await this.getAggregatesByGroupId(id);
          return this.transformSettlementGroup(retryData, aggregates);
        }
        throw error;
      }

      if (!data) {
        return null;
      }

      const aggregates = await this.getAggregatesByGroupId(id);
      return this.transformSettlementGroup(data, aggregates);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logError("Error fetching settlement group by ID", { id, error: errorMessage });
      throw error;
    }
  }

  /**
   * Get settlement group by ID INCLUDING soft-deleted records
   * Used for restore validation
   */
  async findByIdIncludingDeleted(id: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from("bank_settlement_groups")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        throw error;
      }

      return data;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logError("Error fetching settlement group by ID (including deleted)", { id, error: errorMessage });
      throw error;
    }
  }

  /**
   * Get settlement group by settlement number
   */
  async findBySettlementNumber(settlementNumber: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from("bank_settlement_groups")
        .select("*")
        .eq("settlement_number", settlementNumber)
        .single();

      if (error) {
        if (isMissingColumnError(error)) {
          // Retry without deleted_at check
          const { data: retryData, error: retryError } = await supabase
            .from("bank_settlement_groups")
            .select("*")
            .eq("settlement_number", settlementNumber)
            .single();
          
          if (retryError) throw retryError;
          return retryData;
        }
        throw error;
      }

      return data;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logError("Error fetching settlement group by number", { settlementNumber, error: errorMessage });
      throw error;
    }
  }

  /**
   * Add aggregates to a settlement group
   */
  async addAggregatesToGroup(
    settlementGroupId: string,
    aggregates: Array<{
      aggregateId: string;
      allocatedAmount: number;
      originalAmount: number;
    }>
  ): Promise<void> {
    try {
      const records = aggregates.map(agg => ({
        settlement_group_id: settlementGroupId,
        aggregate_id: agg.aggregateId,
        allocated_amount: agg.allocatedAmount,
        original_amount: agg.originalAmount,
      }));

      const { error } = await supabase
        .from("bank_settlement_aggregates")
        .insert(records);

      if (error) {
        throw error;
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logError("Error adding aggregates to settlement group", {
        settlementGroupId,
        count: aggregates.length,
        error: errorMessage
      });
      throw error;
    }
  }

  /**
   * Update settlement group status
   */
  async updateStatus(
    id: string,
    status: SettlementGroupStatus,
    confirmedAt?: string
  ): Promise<void> {
    try {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (confirmedAt) {
        updateData.confirmed_at = confirmedAt;
      }

      const { error } = await supabase
        .from("bank_settlement_groups")
        .update(updateData)
        .eq("id", id);

      if (error) {
        throw error;
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logError("Error updating settlement group status", { id, status, error: errorMessage });
      throw error;
    }
  }

  /**
   * Mark aggregates as reconciled
   */
  async markAggregatesAsReconciled(aggregateIds: string[]): Promise<void> {
    const { error } = await supabase
      .from('aggregated_transactions')
      .update({
        is_reconciled: true,
        updated_at: new Date().toISOString(),
      })
      .in('id', aggregateIds);

    if (error) {
      logError('Mark aggregates as reconciled error', { aggregateIds, error: error.message });
      throw new Error(`Failed to mark aggregates as reconciled: ${error.message}`);
    }
  }

  /**
   * Mark bank statement as reconciled
   */
  async markBankStatementAsReconciled(statementId: string): Promise<void> {
    // Handle different formats of statementId (string, number, bigint)
    let statementIdNum: number;
    if (typeof statementId === 'string') {
      statementIdNum = parseInt(statementId, 10);
    } else if (typeof statementId === 'number') {
      statementIdNum = statementId;
    } else {
      statementIdNum = Number(statementId);
    }

    // Check if valid number
    if (isNaN(statementIdNum)) {
      logError('Invalid statement ID for markBankStatementAsReconciled', { statementId });
      throw new Error(`Invalid statement ID: ${statementId}`);
    }

    const { error } = await supabase
      .from('bank_statements')
      .update({
        is_reconciled: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', statementIdNum);

    if (error) {
      logError('Mark bank statement as reconciled error', { statementId, error: error.message });
      throw new Error(`Failed to mark bank statement as reconciled: ${error.message}`);
    }
  }

  /**
   * Mark aggregates as unreconciled
   */
  async markAggregatesAsUnreconciled(aggregateIds: string[]): Promise<void> {
    const { error } = await supabase
      .from('aggregated_transactions')
      .update({
        is_reconciled: false,
        updated_at: new Date().toISOString(),
      })
      .in('id', aggregateIds);

    if (error) {
      logError('Mark aggregates as unreconciled error', { aggregateIds, error: error.message });
      throw new Error(`Failed to mark aggregates as unreconciled: ${error.message}`);
    }
  }

  /**
   * Mark bank statement as unreconciled
   */
  async markBankStatementAsUnreconciled(statementId: string): Promise<void> {
    // Handle different formats of statementId (string, number, bigint)
    let statementIdNum: number;
    if (typeof statementId === 'string') {
      statementIdNum = parseInt(statementId, 10);
    } else if (typeof statementId === 'number') {
      statementIdNum = statementId;
    } else {
      statementIdNum = Number(statementId);
    }

    // Check if valid number
    if (isNaN(statementIdNum)) {
      logError('Invalid statement ID for markBankStatementAsUnreconciled', { statementId });
      throw new Error(`Invalid statement ID: ${statementId}`);
    }

    const { error } = await supabase
      .from('bank_statements')
      .update({
        is_reconciled: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', statementIdNum);

    if (error) {
      logError('Mark bank statement as unreconciled error', { statementId, error: error.message });
      throw new Error(`Failed to mark bank statement as unreconciled: ${error.message}`);
    }
  }

  /**
   * Soft delete settlement group and its aggregates
   * Sets deleted_at AND updates status to UNDO for consistency
   */
  async softDelete(id: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      
      // Soft delete aggregates first
      const { error: aggError } = await supabase
        .from("bank_settlement_aggregates")
        .update({
          deleted_at: now,
        })
        .eq("settlement_group_id", id);

      if (aggError) {
        throw aggError;
      }

      // Soft delete the settlement group AND update status to UNDO
      const { error } = await supabase
        .from("bank_settlement_groups")
        .update({
          deleted_at: now,
          updated_at: now,
          status: 'UNDO', // Update status to UNDO for consistency after soft delete
        })
        .eq("id", id);

      if (error) {
        throw error;
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logError("Error soft deleting settlement group", { id, error: errorMessage });
      throw error;
    }
  }

  /**
   * Get soft-deleted settlement groups (for Trash View)
   */
  async findDeleted(options?: {
    limit?: number;
    offset?: number;
  }): Promise<{ data: any[]; total: number }> {
    try {
      const limit = options?.limit || 50;
      const offset = options?.offset || 0;

      const { data, error, count } = await supabase
        .from("bank_settlement_groups")
        .select(
          `
          *,
          bank_statements (
            id,
            transaction_date,
            description,
            debit_amount,
            credit_amount
          )
        `,
          { count: 'exact' }
        )
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        // If error is about missing deleted_at column, return empty
        if (isMissingColumnError(error)) {
          logInfo("deleted_at column not found, returning empty deleted list");
          return { data: [], total: 0 };
        }
        throw error;
      }

      // Get all group IDs to fetch aggregates
      const groupIds = (data || []).map((g: any) => g.id);
      let aggregatesMap: Record<string, any[]> = {};
      
      if (groupIds.length > 0) {
        try {
          const { data: aggData } = await supabase
            .from("bank_settlement_aggregates")
            .select("*")
            .in("settlement_group_id", groupIds);
          
          if (aggData) {
            aggregatesMap = aggData.reduce((acc: Record<string, any[]>, agg: any) => {
              if (!acc[agg.settlement_group_id]) {
                acc[agg.settlement_group_id] = [];
              }
              acc[agg.settlement_group_id].push(agg);
              return acc;
            }, {});
          }
        } catch (aggError) {
          logError("Error fetching aggregates for deleted list", { error: aggError instanceof Error ? aggError.message : 'Unknown' });
        }
      }

      const transformedData = (data || []).map((group: any) => ({
        ...group,
        deleted_at: group.deleted_at,
        // Use safe converter to handle null/invalid values gracefully
        bank_statement_id: safeBankStatementIdToString(group.bank_statement_id, 'bank_statement_id'),
        bank_statement: group.bank_statements ? {
          id: group.bank_statements.id,
          transaction_date: group.bank_statements.transaction_date,
          description: group.bank_statements.description,
          debit_amount: group.bank_statements.debit_amount,
          credit_amount: group.bank_statements.credit_amount,
          amount: (group.bank_statements.credit_amount || 0) - (group.bank_statements.debit_amount || 0),
        } : undefined,
        aggregates: aggregatesMap[group.id] || [],
      }));

      return { data: transformedData, total: count || 0 };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logError("Error fetching deleted settlement groups", { error: errorMessage });
      throw error;
    }
  }

  /**
   * Restore a soft-deleted settlement group with transaction-like behavior
   * Uses atomic operations with rollback on error
   * Also reverts is_reconciled to false for aggregates and bank statement
   */
  async restore(groupId: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      
      // First get the settlement group to get aggregate IDs and bank statement ID
      const { data: groupData, error: fetchError } = await supabase
        .from("bank_settlement_groups")
        .select(`
          bank_statement_id,
          bank_settlement_aggregates(aggregate_id)
        `)
        .eq("id", groupId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      if (!groupData) {
        throw new Error("Settlement group not found");
      }

      // Extract aggregate IDs - handle nested result structure
      const aggregateIds: string[] = [];
      if (groupData && groupData.bank_settlement_aggregates) {
        for (const agg of groupData.bank_settlement_aggregates as any[]) {
          if (agg.aggregate_id) {
            aggregateIds.push(agg.aggregate_id);
          }
        }
      }

      // Validate bank_statement_id before proceeding
      let bankStatementIdNum: number | null = null;
      if (groupData?.bank_statement_id) {
        try {
          bankStatementIdNum = validateBankStatementId(groupData.bank_statement_id, 'bank_statement_id');
        } catch (validationError) {
          logError("Invalid bank_statement_id during restore", { 
            groupId, 
            bank_statement_id: groupData.bank_statement_id,
            error: validationError instanceof Error ? validationError.message : 'Unknown'
          });
          throw new Error(`Invalid bank statement ID: ${groupData.bank_statement_id}`);
        }
      }

      // STEP 1: Restore aggregates first (update deleted_at to null)
      const { error: aggError } = await supabase
        .from("bank_settlement_aggregates")
        .update({ deleted_at: null })
        .eq("settlement_group_id", groupId);

      if (aggError) {
        throw aggError;
      }

      // STEP 2: Restore settlement group AND set status back to RECONCILED
      const { error: groupError } = await supabase
        .from("bank_settlement_groups")
        .update({
          deleted_at: null,
          updated_at: now,
          status: SettlementGroupStatus.RECONCILED, // Restore status to RECONCILED
        })
        .eq("id", groupId);

      if (groupError) {
        // ROLLBACK: Restore deleted_at on aggregates if group restore fails
        await supabase
          .from("bank_settlement_aggregates")
          .update({ deleted_at: now })
          .eq("settlement_group_id", groupId);
        throw groupError;
      }

      // STEP 3: Revert aggregates is_reconciled to false
      if (aggregateIds.length > 0) {
        const { error: unreconcileAggError } = await supabase
          .from('aggregated_transactions')
          .update({
            is_reconciled: false,
            updated_at: now,
          })
          .in('id', aggregateIds);

        if (unreconcileAggError) {
          logError("Failed to revert aggregates is_reconciled during restore", {
            groupId,
            aggregateIds,
            error: unreconcileAggError.message
          });
          // Note: We don't rollback here as the main restore succeeded
          // This is a secondary operation that can be fixed manually
        }
      }

      // STEP 4: Revert bank statement is_reconciled to false
      if (bankStatementIdNum !== null) {
        const { error: unreconcileStmtError } = await supabase
          .from('bank_statements')
          .update({
            is_reconciled: false,
            updated_at: now,
          })
          .eq('id', bankStatementIdNum);
        
        if (unreconcileStmtError) {
          logError("Failed to revert bank statement is_reconciled during restore", {
            groupId,
            bank_statement_id: bankStatementIdNum,
            error: unreconcileStmtError.message
          });
          // Note: We don't rollback here as the main restore succeeded
        }
      }

      logInfo("Settlement group restored with reconciliation reverted", {
        groupId,
        aggregatesCount: aggregateIds.length,
        bank_statement_id: bankStatementIdNum
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logError("Error restoring settlement group", { groupId, error: errorMessage });
      throw error;
    }
  }

  /**
   * Get list of settlement groups with pagination and filters
   * Includes aggregates count from bank_settlement_aggregates table
   * Only returns non-deleted records (deleted_at IS NULL)
   */
  async findAll(options?: {
    startDate?: string;
    endDate?: string;
    status?: SettlementGroupStatus;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: any[]; total: number }> {
    try {
      // Build query with deleted_at filter - always exclude soft-deleted records
      let query = supabase
        .from("bank_settlement_groups")
        .select(
          `
          *,
          bank_statements (
            id,
            transaction_date,
            description,
            debit_amount,
            credit_amount
          )
        `,
          { count: 'exact' }
        )
        .is("deleted_at", null); // Only return non-deleted records

      // Apply date range filter on settlement_date
      if (options?.startDate) {
        query = query.gte("settlement_date", options.startDate);
      }
      if (options?.endDate) {
        query = query.lte("settlement_date", options.endDate);
      }

      // Apply status filter
      if (options?.status) {
        query = query.eq("status", options.status);
      }

      // Apply search filter on settlement_number or notes
      if (options?.search) {
        const searchTerm = `%${options.search}%`;
        query = query.or(`settlement_number.ilike.${searchTerm},notes.ilike.${searchTerm}`);
      }

      // Apply sorting and pagination
      const limit = options?.limit || 50;
      const offset = options?.offset || 0;

      query = query
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        // If error is about missing deleted_at column, retry without it
        if (isMissingColumnError(error)) {
          logInfo("deleted_at column not found, querying without soft delete filter");
          
          let retryQuery = supabase
            .from("bank_settlement_groups")
            .select(
              `
              *,
              bank_statements (
                id,
                transaction_date,
                description,
                debit_amount,
                credit_amount
              )
            `,
              { count: 'exact' }
            );

          if (options?.startDate) {
            retryQuery = retryQuery.gte("settlement_date", options.startDate);
          }
          if (options?.endDate) {
            retryQuery = retryQuery.lte("settlement_date", options.endDate);
          }
          if (options?.status) {
            retryQuery = retryQuery.eq("status", options.status);
          }
          if (options?.search) {
            const searchTerm = `%${options.search}%`;
            retryQuery = retryQuery.or(`settlement_number.ilike.${searchTerm},notes.ilike.${searchTerm}`);
          }

          const { data: retryData, error: retryError, count: retryCount } = await retryQuery
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);

          if (retryError) throw retryError;

          // Get all group IDs to fetch aggregates
          const groupIds = (retryData || []).map((g: any) => g.id);
          let aggregatesMap: Record<string, any[]> = {};
          
          if (groupIds.length > 0) {
            try {
              const { data: aggData } = await supabase
                .from("bank_settlement_aggregates")
                .select("*")
                .in("settlement_group_id", groupIds);
              
              if (aggData) {
                aggregatesMap = aggData.reduce((acc: Record<string, any[]>, agg: any) => {
                  if (!acc[agg.settlement_group_id]) {
                    acc[agg.settlement_group_id] = [];
                  }
                  acc[agg.settlement_group_id].push(agg);
                  return acc;
                }, {});
              }
            } catch (aggError) {
              logError("Error fetching aggregates for list", { error: aggError instanceof Error ? aggError.message : 'Unknown' });
            }
          }

          const transformedData = (retryData || []).map((group: any) => ({
            ...group,
            deleted_at: null, // Assume not deleted if column doesn't exist
            // Use safe converter to handle null/invalid values gracefully
            bank_statement_id: safeBankStatementIdToString(group.bank_statement_id, 'bank_statement_id'),
            bank_statement: group.bank_statements ? {
              id: group.bank_statements.id,
              transaction_date: group.bank_statements.transaction_date,
              description: group.bank_statements.description,
              debit_amount: group.bank_statements.debit_amount,
              credit_amount: group.bank_statements.credit_amount,
              amount: (group.bank_statements.credit_amount || 0) - (group.bank_statements.debit_amount || 0),
            } : undefined,
            aggregates: aggregatesMap[group.id] || [],
          }));

          return { data: transformedData, total: retryCount || 0 };
        }
        throw error;
      }

      // Get all group IDs to fetch aggregates
      const groupIds = (data || []).map((g: any) => g.id);
      let aggregatesMap: Record<string, any[]> = {};
      
      if (groupIds.length > 0) {
        try {
          const { data: aggData } = await supabase
            .from("bank_settlement_aggregates")
            .select("*")
            .in("settlement_group_id", groupIds);
          
          if (aggData) {
            aggregatesMap = aggData.reduce((acc: Record<string, any[]>, agg: any) => {
              if (!acc[agg.settlement_group_id]) {
                acc[agg.settlement_group_id] = [];
              }
              acc[agg.settlement_group_id].push(agg);
              return acc;
            }, {});
          }
        } catch (aggError) {
          logError("Error fetching aggregates for list", { error: aggError instanceof Error ? aggError.message : 'Unknown' });
        }
      }

      const transformedData = (data || []).map((group: any) => ({
        ...group,
        deleted_at: group.deleted_at,
        // Use safe converter to handle null/invalid values gracefully
        bank_statement_id: safeBankStatementIdToString(group.bank_statement_id, 'bank_statement_id'),
        bank_statement: group.bank_statements ? {
          id: group.bank_statements.id,
          transaction_date: group.bank_statements.transaction_date,
          description: group.bank_statements.description,
          debit_amount: group.bank_statements.debit_amount,
          credit_amount: group.bank_statements.credit_amount,
          amount: (group.bank_statements.credit_amount || 0) - (group.bank_statements.debit_amount || 0),
        } : undefined,
        aggregates: aggregatesMap[group.id] || [],
      }));

      return { data: transformedData, total: count || 0 };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logError("Error fetching settlement groups", { options, error: errorMessage });
      throw error;
    }
  }

  /**
   * Get aggregates for a settlement group
   */
  async getAggregatesByGroupId(settlementGroupId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from("bank_settlement_aggregates")
        .select("*")
        .eq("settlement_group_id", settlementGroupId)
        .order("created_at", { ascending: true });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logError("Error fetching settlement group aggregates", { settlementGroupId, error: errorMessage });
      throw error;
    }
  }

  /**
   * Check if aggregate is already in any settlement group
   */
  async isAggregateInSettlementGroup(aggregateId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from("bank_settlement_aggregates")
        .select("id")
        .eq("aggregate_id", aggregateId)
        .limit(1);

      if (error) {
        throw error;
      }

      return (data || []).length > 0;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logError("Error checking if aggregate is in settlement group", { aggregateId, error: errorMessage });
      throw error;
    }
  }

  /**
   * Get available aggregates for settlement (unreconciled)
   * NOTE: Schema may not have branch_id column, handle gracefully
   */
  async getAvailableAggregates(options?: {
    startDate?: string;
    endDate?: string;
    paymentMethodId?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: any[]; total: number }> {
    try {
      // Get aggregates - only select columns that are guaranteed to exist
      let query = supabase
        .from("aggregated_transactions")
        .select(
          `
          id,
          transaction_date,
          gross_amount,
          nett_amount,
          payment_method_id,
          is_reconciled
        `,
          { count: 'exact' }
        )
        .eq("is_reconciled", false);

      // Apply date range filter
      if (options?.startDate) {
        query = query.gte("transaction_date", options.startDate);
      }
      if (options?.endDate) {
        query = query.lte("transaction_date", options.endDate);
      }

      // Apply payment method filter
      if (options?.paymentMethodId) {
        query = query.eq("payment_method_id", options.paymentMethodId);
      }

      // Apply search filter - only on available columns
      if (options?.search) {
        const searchTerm = `%${options.search}%`;
        query = query.or(`id.ilike.${searchTerm},payment_method_id.ilike.${searchTerm}`);
      }

      // Apply sorting and pagination
      const limit = options?.limit || 100;
      const offset = options?.offset || 0;

      query = query
        .order("transaction_date", { ascending: false })
        .order("nett_amount", { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        throw error;
      }

      // Get unique payment_method_ids for batch lookup
      const paymentMethodIds = [...new Set((data || []).map((agg: any) => agg.payment_method_id).filter(Boolean))];
      
      let paymentMethodsMap: Record<string, string> = {};
      
      // Get payment methods
      if (paymentMethodIds.length > 0) {
        try {
          const { data: paymentMethods } = await supabase
            .from("payment_methods")
            .select("id, name")
            .in("id", paymentMethodIds);
          
          if (paymentMethods) {
            paymentMethodsMap = paymentMethods.reduce((acc: Record<string, string>, pm: any) => {
              acc[pm.id] = pm.name;
              return acc;
            }, {});
          }
        } catch (pmError) {
          // Payment methods table may not exist or have issues
          logError("Error fetching payment methods", { error: pmError instanceof Error ? pmError.message : 'Unknown' });
        }
      }

      const transformedData = (data || []).map((agg: any) => ({
        id: agg.id,
        transaction_date: agg.transaction_date,
        gross_amount: agg.gross_amount,
        nett_amount: agg.nett_amount,
        payment_method_name: paymentMethodsMap[agg.payment_method_id] || null,
        payment_method_id: agg.payment_method_id,
        is_reconciled: agg.is_reconciled,
      }));

      return { data: transformedData, total: count || 0 };
    } catch (error: any) {
      logError("Error fetching available aggregates", { options, error: error.message });
      throw error;
    }
  }

  /**
   * Get aggregate by ID
   * NOTE: Schema may not have branch_id column, handle gracefully
   */
  async getAggregateById(aggregateId: string): Promise<any> {
    try {
      // First get aggregate - only select columns that are guaranteed to exist
      const { data, error } = await supabase
        .from("aggregated_transactions")
        .select(`
          id,
          transaction_date,
          gross_amount,
          nett_amount,
          payment_method_id,
          is_reconciled
        `)
        .eq("id", aggregateId)
        .single();

      if (error) {
        // If error is "PGRST116" (row not found), return null instead of throwing
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      if (!data) {
        return null;
      }

      // Get payment method name separately
      let paymentMethodName = null;
      let paymentMethodId = null;
      
      if (data.payment_method_id) {
        try {
          const { data: paymentMethod } = await supabase
            .from("payment_methods")
            .select("id, name")
            .eq("id", data.payment_method_id)
            .maybeSingle();
            
          if (paymentMethod) {
            paymentMethodName = paymentMethod.name;
            paymentMethodId = paymentMethod.id;
          }
        } catch (pmError) {
          // Payment methods may not exist
          logError("Error fetching payment method", { 
            aggregateId, 
            paymentMethodId: data.payment_method_id,
            error: pmError instanceof Error ? pmError.message : 'Unknown' 
          });
        }
      }

      return {
        id: data.id,
        transaction_date: data.transaction_date,
        gross_amount: data.gross_amount,
        nett_amount: data.nett_amount,
        payment_method_name: paymentMethodName,
        payment_method_id: paymentMethodId,
        is_reconciled: data.is_reconciled,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logError("Error fetching aggregate by ID", { aggregateId, error: errorMessage });
      throw error;
    }
  }

  /**
   * Check if any aggregates in the group are already reconciled with other groups
   * Used during restore validation
   */
  async checkAggregatesReconciledElsewhere(groupId: string): Promise<boolean> {
    try {
      // Get all aggregate IDs for this group
      const { data: aggregates } = await supabase
        .from("bank_settlement_aggregates")
        .select("aggregate_id")
        .eq("settlement_group_id", groupId);

      if (!aggregates || aggregates.length === 0) {
        return false;
      }

      const aggregateIds = aggregates.map(a => a.aggregate_id);

      // Check if any of these aggregates are now reconciled with OTHER groups
      // (excluding our current group which is being restored)
      const { data: otherGroups } = await supabase
        .from("bank_settlement_aggregates")
        .select("aggregate_id, settlement_group_id")
        .in("aggregate_id", aggregateIds)
        .neq("settlement_group_id", groupId);

      // If there are aggregates in other groups that are reconciled
      if (otherGroups && otherGroups.length > 0) {
        // Check the reconciliation status of those aggregates
        const otherAggregateIds = otherGroups.map(g => g.aggregate_id);
        
        const { data: reconciledData } = await supabase
          .from("aggregated_transactions")
          .select("id")
          .in("id", otherAggregateIds)
          .eq("is_reconciled", true);

        return !!(reconciledData && reconciledData.length > 0);
      }

      return false;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logError("Error checking aggregates reconciled elsewhere", { groupId, error: errorMessage });
      throw error;
    }
  }

  /**
   * Get bank statement by ID
   */
  async getBankStatementById(statementId: string): Promise<{
    id: string;
    transaction_date: string;
    description: string;
    debit_amount: number;
    credit_amount: number;
    is_reconciled: boolean;
    amount: number;
    bank_accounts?: {
      account_name?: string;
      account_number?: string;
      banks?: {
        bank_name?: string;
        bank_code?: string;
      };
    };
  } | null> {
    try {
      // statementId from settlement group is a string, but bank_statements.id is bigint
      const statementIdNum = Number(statementId);
      
      const { data, error } = await supabase
        .from("bank_statements")
        .select(`
          *,
          bank_accounts (
            account_name,
            account_number,
            banks (bank_name, bank_code)
          )
        `)
        .eq('id', statementIdNum)
        .single();

      if (error) {
        throw error;
      }

      if (!data) {
        return null;
      }

      return {
        ...data,
        id: String(data.id),
        amount: (data.credit_amount || 0) - (data.debit_amount || 0),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logError("Error fetching bank statement by ID", { statementId, error: errorMessage });
      throw error;
    }
  }

  /**
   * Transform raw database response to settlement group format
   */
  private transformSettlementGroup(data: SettlementGroupDb, aggregates: any[] = []): any {
    const bankStatement = data.bank_statements ? {
      id: data.bank_statements.id,
      transaction_date: data.bank_statements.transaction_date,
      description: data.bank_statements.description,
      debit_amount: data.bank_statements.debit_amount,
      credit_amount: data.bank_statements.credit_amount,
      amount: (data.bank_statements.credit_amount || 0) - (data.bank_statements.debit_amount || 0),
      bank_name: data.bank_statements.bank_accounts?.banks?.bank_name || null,
    } : undefined;

    const transformedAggregates = (aggregates || []).map((agg: any) => ({
      id: agg.id,
      settlement_group_id: agg.settlement_group_id,
      aggregate_id: agg.aggregate_id,
      allocated_amount: agg.allocated_amount,
      original_amount: agg.original_amount,
      created_at: agg.created_at,
      aggregate: null,
    }));

    return {
      id: data.id,
      company_id: data.company_id,
      // Use safe converter to handle null/invalid values gracefully
      bank_statement_id: safeBankStatementIdToString(data.bank_statement_id, 'bank_statement_id'),
      settlement_number: data.settlement_number,
      settlement_date: data.settlement_date,
      payment_method: data.payment_method,
      bank_name: data.bank_name,
      total_statement_amount: data.total_statement_amount,
      total_allocated_amount: data.total_allocated_amount,
      difference: data.difference,
      status: data.status,
      notes: data.notes,
      created_by: data.created_by,
      created_at: data.created_at,
      updated_at: data.updated_at,
      confirmed_at: data.confirmed_at,
      deleted_at: data.deleted_at,
      bank_statement: bankStatement,
      aggregates: transformedAggregates,
    };
  }
}

export const settlementGroupRepository = new SettlementGroupRepository();

