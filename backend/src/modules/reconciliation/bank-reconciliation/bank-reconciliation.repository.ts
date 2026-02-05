import { supabase } from "../../../config/supabase";
import { logError } from "../../../config/logger";
import { BankReconciliationStatus } from "./bank-reconciliation.types";
import {
  FetchStatementError,
  StatementNotFoundError,
  DatabaseConnectionError,
} from "./bank-reconciliation.errors";

export class BankReconciliationRepository {
  constructor() {}

  /**
   * Find bank statement by ID
   */
  async findById(id: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from("bank_statements")
        .select("*")
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new StatementNotFoundError(id);
      }

      return data;
    } catch (error: any) {
      if (error instanceof StatementNotFoundError) {
        throw error;
      }
      logError("Error fetching statement by ID", { statementId: id, error: error.message });
      throw new FetchStatementError(id, error.message);
    }
  }

  /**
   * Get unreconciled bank statements for a company on a specific date
   */
  async getUnreconciled(
    startDate: Date,
    endDate?: Date,
  ): Promise<any[]> {
    const end = endDate || startDate;

    try {
      const { data, error } = await supabase
        .from("bank_statements")
        .select("*")
        .gte("transaction_date", startDate.toISOString().split("T")[0])
        .lte("transaction_date", end.toISOString().split("T")[0])
        .eq("is_reconciled", false)
        .is("deleted_at", null)
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error: any) {
      logError("Error fetching unreconciled statements", { 
        startDate: startDate.toISOString(), 
        endDate: end.toISOString(),
        error: error.message 
      });
      throw new FetchStatementError('unreconciled-list', error.message);
    }
  }

  /**
   * Get bank statements by date range with optional filtering and joined data
   * When dates are not provided, queries overall date range across all imports
   * 
   * NOTE: This method fetches matched_aggregate data separately for statements with reconciliation_id
   */
  async getByDateRange(
    startDate?: Date,
    endDate?: Date,
    bankAccountId?: number,
    options?: {
      status?: 'RECONCILED' | 'UNRECONCILED' | 'DISCREPANCY';
      search?: string;
      isReconciled?: boolean;
      sortField?: string;
      sortOrder?: 'asc' | 'desc';
      limit?: number;
      offset?: number;
    },
  ): Promise<any[]> {
    try {
      let query = supabase
        .from("bank_statements")
        .select(
          `
        *,
        bank_accounts (
          id,
          account_name,
          account_number,
          banks (
            bank_name,
            bank_code
          )
        )
      `,
        )
        .is("deleted_at", null);

      // Apply date range filters if provided
      if (startDate) {
        query = query.gte("transaction_date", startDate.toISOString().split("T")[0]);
      }
      if (endDate) {
        query = query.lte("transaction_date", endDate.toISOString().split("T")[0]);
      }

      // Apply bank account filter
      if (bankAccountId) {
        query = query.eq("bank_account_id", bankAccountId);
      }

      // Apply status filter
      if (options?.status === 'RECONCILED') {
        query = query.eq("is_reconciled", true);
      } else if (options?.status === 'UNRECONCILED') {
        query = query.eq("is_reconciled", false);
      }
      // DISCREPANCY requires special handling (reconciled but with difference)

      // Apply isReconciled filter (overrides status if both provided)
      if (options?.isReconciled !== undefined) {
        query = query.eq("is_reconciled", options.isReconciled);
      }

      // Apply search filter on description or reference_number
      if (options?.search) {
        const searchTerm = `%${options.search}%`;
        query = query.or(`description.ilike.${searchTerm},reference_number.ilike.${searchTerm}`);
      }

      // Apply sorting
      const sortField = options?.sortField || 'transaction_date';
      const sortOrder = options?.sortOrder || 'desc';
      query = query.order(sortField, { ascending: sortOrder === 'asc' });

      // Apply pagination
      if (options?.limit) {
        query = query.limit(options.limit);
      }
      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 100) - 1);
      }

      const { data, error } = await query;

      if (error) {
        logError("Error fetching bank statements", {          
          startDate: startDate?.toISOString(), 
          endDate: endDate?.toISOString(),
          error: error.message 
        });
        throw error;
      }
      
      // Get all reconciliation_ids from statements
      const statementsWithReconciliation = (data || []).filter(s => s.reconciliation_id);
      const aggregateIds = [...new Set(statementsWithReconciliation.map(s => s.reconciliation_id))];
      
      // Fetch aggregates in batch if there are any
      let aggregateMap: Record<string, any> = {};
      if (aggregateIds.length > 0) {
        try {
          const { data: aggregates, error: aggError } = await supabase
            .from("aggregated_transactions")
            .select(`
              id,
              transaction_date,
              gross_amount,
              nett_amount,
              payment_methods!inner (
                name
              )
            `)
            .in("id", aggregateIds);

          if (aggError) {
            logError("Error fetching aggregates", { error: aggError.message });
          } else if (aggregates) {
            aggregateMap = aggregates.reduce((acc: Record<string, any>, agg: any) => {
              acc[agg.id] = agg;
              return acc;
            }, {});
          }
        } catch (e: any) {
          logError("Error in aggregate fetch", { error: e.message });
        }
      }
      
      // Map data to include matched_aggregate
      return (data || []).map(row => ({
        ...row,
        matched_aggregate: row.reconciliation_id && aggregateMap[row.reconciliation_id] ? {
          id: aggregateMap[row.reconciliation_id].id,
          transaction_date: aggregateMap[row.reconciliation_id].transaction_date,
          gross_amount: aggregateMap[row.reconciliation_id].gross_amount,
          nett_amount: aggregateMap[row.reconciliation_id].nett_amount,
          payment_method_name: aggregateMap[row.reconciliation_id].payment_methods?.name || null,
        } : null,
      }));
    } catch (error: any) {
      logError("Error fetching statements by date range", {        
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get all bank accounts without any date filter
   * Used for filter dropdown - always returns all accounts regardless of transactions
   */
  async getAllBankAccounts(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select(
          `
          id,
          account_name,
          account_number,
          banks (
            bank_name,
            bank_code
          )
        `,
        )
        .is("deleted_at", null)
        .order("account_name", { ascending: true });

      if (error) {
        throw error;
      }

      // Return with default stats (zeros)
      return (data || []).map((acc) => ({
        ...acc,
        stats: {
          total: 0,
          unreconciled: 0,
        },
      }));
    } catch (error: any) {
      logError("Error fetching all bank accounts", {
        error: error.message,
      });
      throw new DatabaseConnectionError(
        "fetching all bank accounts",
        error.message,
      );
    }
  }

  /**
   * Get list of bank accounts with reconciliation summaries for a period
   */
  async getBankAccountsStatus(
    startDate: Date,
    endDate: Date,
  ): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from("bank_statements")
        .select("bank_account_id, is_reconciled")
        .gte("transaction_date", startDate.toISOString().split("T")[0])
        .lte("transaction_date", endDate.toISOString().split("T")[0])
        .is("deleted_at", null);

      if (error) {
        throw error;
      }

      const stats = (data || []).reduce((acc: any, curr: any) => {
        const bId = curr.bank_account_id;
        if (!acc[bId]) {
          acc[bId] = { total: 0, unreconciled: 0 };
        }
        acc[bId].total++;
        if (!curr.is_reconciled) {
          acc[bId].unreconciled++;
        }
        return acc;
      }, {});

      const accountIds = Object.keys(stats).map((id) => parseInt(id));
      if (accountIds.length === 0) return [];

      const { data: accounts, error: accError } = await supabase
        .from("bank_accounts")
        .select(
          `
        id,
        account_name,
        account_number,
        banks (
          bank_name,
          bank_code
        )
      `,
        )
        .in("id", accountIds);

      if (accError) {
        throw accError;
      }

      return accounts.map((acc) => ({
        ...acc,
        stats: stats[acc.id],
      }));
    } catch (error: any) {
      logError("Error fetching bank accounts status", {
        error: error.message
      });
      throw new DatabaseConnectionError('fetching bank accounts status', error.message);
    }
  }

  /**
   * Update reconciliation status of a bank statement
   */
  async updateStatus(
    id: string,
    status: BankReconciliationStatus,
  ): Promise<void> {
    try {
      const isReconciled = ![
        BankReconciliationStatus.PENDING,
        BankReconciliationStatus.UNRECONCILED,
        BankReconciliationStatus.DISCREPANCY,
      ].includes(status);

      const { error } = await supabase
        .from("bank_statements")
        .update({
          is_reconciled: isReconciled,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) {
        throw error;
      }
    } catch (error: any) {
      logError("Error updating statement status", { statementId: id, error: error.message });
      throw new FetchStatementError(id, error.message);
    }
  }

  /**
   * Mark a statement as reconciled with a specific aggregate
   */
  async markAsReconciled(
    statementId: string,
    aggregateId: string,
  ): Promise<void> {
    try {
      const { data: aggregate, error: aggError } = await supabase
        .from("aggregated_transactions")
        .select("payment_method_id")
        .eq("id", aggregateId)
        .maybeSingle();

      if (aggError) {
        throw aggError;
      }

      const { error } = await supabase
        .from("bank_statements")
        .update({
          is_reconciled: true,
          reconciled_at: new Date().toISOString(),
          reconciliation_id: aggregateId,
          payment_method_id: aggregate?.payment_method_id || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", statementId);

      if (error) {
        throw error;
      }
    } catch (error: any) {
      logError("Error marking statement as reconciled", { statementId, aggregateId, error: error.message });
      throw new FetchStatementError(statementId, error.message);
    }
  }

  /**
   * Bulk update status for multiple statements
   */
  async bulkUpdateReconciliationStatus(
    ids: string[],
    isReconciled: boolean,
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from("bank_statements")
        .update({
          is_reconciled: isReconciled,
          updated_at: new Date().toISOString(),
        })
        .in("id", ids);

      if (error) {
        throw error;
      }
    } catch (error: any) {
      logError("Error bulk updating reconciliation status", { count: ids.length, error: error.message });
      throw new DatabaseConnectionError('bulk update reconciliation status', error.message);
    }
  }

  /**
   * Get unreconciled statements in batches for large datasets
   */
  async getUnreconciledBatch(
    startDate: Date,
    endDate: Date,
    limit: number = 1000,
    offset: number = 0,
    bankAccountId?: number,
  ): Promise<any[]> {
    try {
      let query = supabase
        .from("bank_statements")
        .select("*")
        .gte("transaction_date", startDate.toISOString().split("T")[0])
        .lte("transaction_date", endDate.toISOString().split("T")[0])
        .eq("is_reconciled", false)
        .is("deleted_at", null);

      if (bankAccountId) {
        query = query.eq("bank_account_id", bankAccountId);
      }

      const { data, error } = await query
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }
      return data || [];
    } catch (error: any) {
      logError("Error fetching unreconciled batch", {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit,
        offset,
        error: error.message
      });
      throw new FetchStatementError('batch-fetch', error.message);
    }
  }

  /**
   * Log reconciliation action to audit trail
   */
  async logAction(data: {
    userId?: string;
    action: "MANUAL_RECONCILE" | "AUTO_MATCH" | "UNDO";
    statementId?: string;
    aggregateId?: string;
    details?: any;
  }): Promise<void> {
    try {
      const { error } = await supabase.from("bank_reconciliation_logs").insert({
        user_id: data.userId,
        action: data.action,
        statement_id: data.statementId,
        aggregate_id: data.aggregateId,
        details: data.details || {},
      });

      if (error) {
        throw error;
      }
    } catch (error: any) {
      logError("Error logging reconciliation action", { action: data.action, error: error.message });
    }
  }

  /**
   * Undo reconciliation for a specific statement
   */
  async undoReconciliation(statementId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from("bank_statements")
        .update({
          is_reconciled: false,
          reconciliation_id: null,
          reconciled_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", statementId);

      if (error) {
        throw error;
      }
    } catch (error: any) {
      logError("Error undoing reconciliation", { statementId, error: error.message });
      throw new FetchStatementError(statementId, error.message);
    }
  }

  // =====================================================
  // MULTI-MATCH REPOSITORY METHODS
  // =====================================================

  /**
   * Create a reconciliation group with multiple statements
   */
  async createReconciliationGroup(data: {
    aggregateId: string;
    statementIds: string[];
    totalBankAmount: number;
    aggregateAmount: number;
    difference: number;
    notes?: string;
    reconciledBy?: string;
    companyId?: string;
  }): Promise<string> {
    try {
      const { data: group, error } = await supabase
        .from("bank_reconciliation_groups")
        .insert({
          aggregate_id: data.aggregateId,
          company_id: data.companyId,
          total_bank_amount: data.totalBankAmount,
          aggregate_amount: data.aggregateAmount,
          difference: data.difference,
          notes: data.notes,
          reconciled_by: data.reconciledBy,
          reconciled_at: new Date().toISOString(),
          status: Math.abs(data.difference) <= 100 ? 'RECONCILED' : 'DISCREPANCY',
        })
        .select("id")
        .single();

      if (error) {
        throw error;
      }
      return group.id;
    } catch (error: any) {
      throw new DatabaseConnectionError('creating reconciliation group', error.message);
    }
  }

  /**
   * Add statements to a reconciliation group
   */
  async addStatementsToGroup(
    groupId: string,
    statements: Array<{ statementId: string; amount: number }>
  ): Promise<void> {
    try {
      const details = statements.map(s => ({
        group_id: groupId,
        statement_id: s.statementId,
        amount: s.amount,
      }));

      const { error } = await supabase
        .from("bank_reconciliation_group_details")
        .insert(details);

      if (error) {
        throw error;
      }
    } catch (error: any) {
      logError("Error adding statements to group", { groupId, error: error.message });
      throw new DatabaseConnectionError('adding statements to group', error.message);
    }
  }

  /**
   * Get reconciliation group by ID with all details
   */
  async getReconciliationGroupById(groupId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from("bank_reconciliation_groups")
        .select(`
        *,
        aggregated_transactions (
          id,
          transaction_date,
          gross_amount,
          nett_amount,
          payment_methods!left (
            name
          )
        ),
        bank_reconciliation_group_details (
          *,
          bank_statements (
            id,
            transaction_date,
            description,
            debit_amount,
            credit_amount
          )
        )
      `)
        .eq("id", groupId)
        .is("deleted_at", null)
        .single();

      if (error) {
        throw error;
      }
      return data;
    } catch (error: any) {
      logError("Error fetching reconciliation group", { groupId, error: error.message });
      throw new FetchStatementError(`group-${groupId}`, error.message);
    }
  }

  /**
   * Mark statements as reconciled with a group
   */
  async markStatementsAsReconciledWithGroup(
    statementIds: string[],
    groupId: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from("bank_statements")
        .update({
          is_reconciled: true,
          reconciled_at: new Date().toISOString(),
          reconciliation_group_id: groupId,
          updated_at: new Date().toISOString(),
        })
        .in("id", statementIds);

      if (error) {
        throw error;
      }
    } catch (error: any) {
      logError("Error marking statements as reconciled with group", { 
        count: statementIds.length, 
        groupId, 
        error: error.message 
      });
      throw new FetchStatementError('group-statements', error.message);
    }
  }

  /**
   * Undo reconciliation - reset statements and soft delete group
   */
  async undoReconciliationGroup(groupId: string): Promise<void> {
    try {
      const group = await this.getReconciliationGroupById(groupId);
      if (!group) throw new Error("Group not found");

      const statementIds = (group.bank_reconciliation_group_details || [])
        .map((d: any) => d.statement_id);

      if (statementIds.length > 0) {
        const { error } = await supabase
          .from("bank_statements")
          .update({
            is_reconciled: false,
            reconciled_at: null,
            reconciliation_group_id: null,
            updated_at: new Date().toISOString(),
          })
          .in("id", statementIds);

        if (error) {
          throw error;
        }
      }

      const { error } = await supabase
        .from("bank_reconciliation_groups")
        .update({
          deleted_at: new Date().toISOString(),
          status: 'UNDO',
          updated_at: new Date().toISOString(),
        })
        .eq("id", groupId);

      if (error) {
        throw error;
      }
    } catch (error: any) {
      logError("Error undoing reconciliation group", { groupId, error: error.message });
      throw new DatabaseConnectionError('undoing reconciliation group', error.message);
    }
  }

  /**
   * Check if aggregate is already part of a group
   */
  async isAggregateInGroup(aggregateId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from("bank_reconciliation_groups")
        .select("id")
        .eq("aggregate_id", aggregateId)
        .is("deleted_at", null)
        .maybeSingle();

      if (error) {
        throw error;
      }
      return !!data;
    } catch (error: any) {
      logError("Error checking if aggregate is in group", { aggregateId, error: error.message });
      throw new DatabaseConnectionError('checking aggregate group status', error.message);
    }
  }

  /**
   * Get unreconciled statements by date range for suggestion algorithm
   */
  async getUnreconciledStatementsForSuggestion(
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from("bank_statements")
        .select("id, transaction_date, description, debit_amount, credit_amount")
        .gte("transaction_date", startDate.toISOString().split("T")[0])
        .lte("transaction_date", endDate.toISOString().split("T")[0])
        .eq("is_reconciled", false)
        .is("deleted_at", null)
        .order("transaction_date", { ascending: false });

      if (error) {
        throw error;
      }
      return data || [];
    } catch (error: any) {
      logError("Error fetching statements for suggestion", {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        error: error.message
      });
      throw new FetchStatementError('suggestion-fetch', error.message);
    }
  }

  /**
   * Get all reconciliation groups for a company
   */
  async getReconciliationGroups(
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from("bank_reconciliation_groups")
        .select(`
        *,
        aggregated_transactions (
          id,
          transaction_date,
          gross_amount,
          nett_amount,
          payment_methods!left (name)
        )
      `)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }
      return data || [];
    } catch (error: any) {
      logError("Error fetching reconciliation groups", {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        error: error.message
      });
      throw new DatabaseConnectionError('fetching reconciliation groups', error.message);
    }
  }
}

export const bankReconciliationRepository = new BankReconciliationRepository();
