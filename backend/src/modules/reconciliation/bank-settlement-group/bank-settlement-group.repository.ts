/**
 * Settlement Group Repository
 * Handles all database operations for bank_settlement_groups and bank_settlement_aggregates tables
 */

import { supabase } from "../../../config/supabase";
import { logError } from "../../../config/logger";
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
  branch_name: string | null;
  branch_code: string | null;
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

export class SettlementGroupRepository {
  constructor() {}

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
      const { data: group, error } = await supabase
        .from("bank_settlement_groups")
        .insert({
          company_id: data.companyId,
          bank_statement_id: data.bankStatementId,
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
        .select("id, settlement_number")
        .single();

      if (error) {
        throw error;
      }

      return group.id;
    } catch (error: any) {
      logError("Error creating settlement group", {
        companyId: data.companyId,
        bankStatementId: data.bankStatementId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get settlement group by ID with aggregates and bank statement
   */
  async findById(id: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from("bank_settlement_groups")
        .select(`
          *,
          bank_settlement_aggregates (
            *,
            aggregated_transactions (
              id,
              transaction_date,
              gross_amount,
              nett_amount,
              payment_methods!left (name),
              branches!left (name, code)
            )
          ),
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
        .is("deleted_at", null)
        .single();

      if (error) {
        throw error;
      }

      if (!data) {
        return null;
      }

      // Transform data to match interface
      return this.transformSettlementGroup(data);
    } catch (error: any) {
      logError("Error fetching settlement group by ID", { id, error: error.message });
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
        .is("deleted_at", null)
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error: any) {
      logError("Error fetching settlement group by number", { settlementNumber, error: error.message });
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
      branchName?: string;
      branchCode?: string;
      allocatedAmount: number;
      originalAmount: number;
    }>
  ): Promise<void> {
    try {
      const records = aggregates.map(agg => ({
        settlement_group_id: settlementGroupId,
        aggregate_id: agg.aggregateId,
        branch_name: agg.branchName,
        branch_code: agg.branchCode,
        allocated_amount: agg.allocatedAmount,
        original_amount: agg.originalAmount,
      }));

      const { error } = await supabase
        .from("bank_settlement_aggregates")
        .insert(records);

      if (error) {
        throw error;
      }
    } catch (error: any) {
      logError("Error adding aggregates to settlement group", {
        settlementGroupId,
        count: aggregates.length,
        error: error.message
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
    } catch (error: any) {
      logError("Error updating settlement group status", { id, status, error: error.message });
      throw error;
    }
  }

  /**
   * Soft delete settlement group
   */
  async softDelete(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from("bank_settlement_groups")
        .update({
          deleted_at: new Date().toISOString(),
          status: SettlementGroupStatus.UNDO,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) {
        throw error;
      }
    } catch (error: any) {
      logError("Error soft deleting settlement group", { id, error: error.message });
      throw error;
    }
  }

  /**
   * Get list of settlement groups with pagination and filters
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
        .is("deleted_at", null);

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
        throw error;
      }

      // Transform data
      const transformedData = (data || []).map((group: any) => ({
        ...group,
        bank_statement: group.bank_statements ? {
          id: group.bank_statements.id,
          transaction_date: group.bank_statements.transaction_date,
          description: group.bank_statements.description,
          debit_amount: group.bank_statements.debit_amount,
          credit_amount: group.bank_statements.credit_amount,
          amount: (group.bank_statements.credit_amount || 0) - (group.bank_statements.debit_amount || 0),
        } : undefined,
        aggregates: [], // Will be fetched separately if needed
      }));

      return { data: transformedData, total: count || 0 };
    } catch (error: any) {
      logError("Error fetching settlement groups", { options, error: error.message });
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
        .select(`
          *,
          aggregated_transactions (
            id,
            transaction_date,
            gross_amount,
            nett_amount,
            payment_methods!left (name),
            branches!left (name, code)
          )
        `)
        .eq("settlement_group_id", settlementGroupId)
        .order("created_at", { ascending: true });

      if (error) {
        throw error;
      }

// Transform data with proper types
      return (data || []).map((agg: SettlementAggregateDb) => ({
        id: agg.id,
        settlement_group_id: agg.settlement_group_id,
        aggregate_id: agg.aggregate_id,
        branch_name: agg.branch_name,
        branch_code: agg.branch_code,
        allocated_amount: agg.allocated_amount,
        original_amount: agg.original_amount,
        created_at: agg.created_at,
        aggregate: agg.aggregated_transactions ? {
          id: agg.aggregated_transactions.id,
          transaction_date: agg.aggregated_transactions.transaction_date,
          gross_amount: agg.aggregated_transactions.gross_amount,
          nett_amount: agg.aggregated_transactions.nett_amount,
          payment_method_name: (agg.aggregated_transactions.payment_methods as unknown as PaymentMethodInfo | null)?.name || null,
          branch_name: (agg.aggregated_transactions.branches as unknown as BranchInfo | null)?.name || null,
          branch_code: (agg.aggregated_transactions.branches as unknown as BranchInfo | null)?.code || null,
        } : undefined,
      }));
    } catch (error: any) {
      logError("Error fetching settlement group aggregates", { settlementGroupId, error: error.message });
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
    } catch (error: any) {
      logError("Error checking if aggregate is in settlement group", { aggregateId, error: error.message });
      throw error;
    }
  }

  /**
   * Get available aggregates for settlement (unreconciled)
   */
  async getAvailableAggregates(options?: {
    startDate?: string;
    endDate?: string;
    paymentMethodId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: any[]; total: number }> {
    try {
      let query = supabase
        .from("aggregated_transactions")
        .select(
          `
          id,
          transaction_date,
          gross_amount,
          nett_amount,
          payment_methods!left (id, name),
          branches!left (name, code),
          is_reconciled
        `,
          { count: 'exact' }
        )
        .eq("is_reconciled", false)
        .is("deleted_at", null);

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

// Transform data - using any to avoid Supabase nested join type inference issues
      const transformedData = (data || []).map((agg: any) => ({
        id: agg.id,
        transaction_date: agg.transaction_date,
        gross_amount: agg.gross_amount,
        nett_amount: agg.nett_amount,
        payment_method_name: (agg.payment_methods as unknown as PaymentMethodInfo | null)?.name || null,
        branch_name: (agg.branches as unknown as BranchInfo | null)?.name || null,
        branch_code: (agg.branches as unknown as BranchInfo | null)?.code || null,
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
   */
  async getAggregateById(aggregateId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from("aggregated_transactions")
        .select(`
          id,
          transaction_date,
          gross_amount,
          nett_amount,
          payment_methods!left (id, name),
          branches!left (name, code),
          is_reconciled
        `)
        .eq("id", aggregateId)
        .is("deleted_at", null)
        .single();

      if (error) {
        throw error;
      }

      if (!data) {
        return null;
      }

      return {
        id: data.id,
        transaction_date: data.transaction_date,
        gross_amount: data.gross_amount,
        nett_amount: data.nett_amount,
        payment_method_name: (data.payment_methods as unknown as PaymentMethodInfo | null)?.name || null,
        payment_method_id: (data.payment_methods as unknown as PaymentMethodInfo | null)?.id || null,
        branch_name: (data.branches as unknown as BranchInfo | null)?.name || null,
        branch_code: (data.branches as unknown as BranchInfo | null)?.code || null,
        is_reconciled: data.is_reconciled,
      };
    } catch (error: any) {
      logError("Error fetching aggregate by ID", { aggregateId, error: error.message });
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
        .eq("id", statementId)
        .is("deleted_at", null)
        .single();

      if (error) {
        throw error;
      }

      if (!data) {
        return null;
      }

      // Add computed amount field
      return {
        ...data,
        amount: (data.credit_amount || 0) - (data.debit_amount || 0),
      };
    } catch (error: any) {
      logError("Error fetching bank statement by ID", { statementId, error: error.message });
      throw error;
    }
  }

  /**
   * Transform raw database response to settlement group format
   */
  private transformSettlementGroup(data: SettlementGroupDb): any {
    const bankStatement = data.bank_statements ? {
      id: data.bank_statements.id,
      transaction_date: data.bank_statements.transaction_date,
      description: data.bank_statements.description,
      debit_amount: data.bank_statements.debit_amount,
      credit_amount: data.bank_statements.credit_amount,
      amount: (data.bank_statements.credit_amount || 0) - (data.bank_statements.debit_amount || 0),
      bank_name: data.bank_statements.bank_accounts?.banks?.bank_name || null,
    } : undefined;

const aggregates = (data.bank_settlement_aggregates || []).map((agg: SettlementAggregateDb) => ({
      id: agg.id,
      settlement_group_id: agg.settlement_group_id,
      aggregate_id: agg.aggregate_id,
      branch_name: agg.branch_name,
      branch_code: agg.branch_code,
      allocated_amount: agg.allocated_amount,
      original_amount: agg.original_amount,
      created_at: agg.created_at,
      aggregate: agg.aggregated_transactions ? {
        id: agg.aggregated_transactions.id,
        transaction_date: agg.aggregated_transactions.transaction_date,
        gross_amount: agg.aggregated_transactions.gross_amount,
        nett_amount: agg.aggregated_transactions.nett_amount,
        payment_method_name: (agg.aggregated_transactions.payment_methods as unknown as PaymentMethodInfo | null)?.name || null,
        branch_name: (agg.aggregated_transactions.branches as unknown as BranchInfo | null)?.name || null,
        branch_code: (agg.aggregated_transactions.branches as unknown as BranchInfo | null)?.code || null,
      } : undefined,
    }));

    return {
      id: data.id,
      company_id: data.company_id,
      bank_statement_id: data.bank_statement_id,
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
      aggregates: aggregates,
    };
  }
}

export const settlementGroupRepository = new SettlementGroupRepository();
