import { supabase } from "../../../config/supabase";
import { BankReconciliationStatus } from "./bank-reconciliation.types";

export class BankReconciliationRepository {
  constructor() {}

  /**
   * Find bank statement by ID
   */
  async findById(id: string): Promise<any> {
    const { data, error } = await supabase
      .from("bank_statements")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /**
   * Get unreconciled bank statements for a company on a specific date
   */
  async getUnreconciled(
    companyId: string,
    startDate: Date,
    endDate?: Date,
  ): Promise<any[]> {
    const end = endDate || startDate;

    const { data, error } = await supabase
      .from("bank_statements")
      .select("*")
      .eq("company_id", companyId)
      .gte("transaction_date", startDate.toISOString().split("T")[0])
      .lte("transaction_date", end.toISOString().split("T")[0])
      .eq("is_reconciled", false)
      .is("deleted_at", null)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

/**
   * Get bank statements by date range with optional filtering and joined data
   */
  async getByDateRange(
    companyId: string,
    startDate: Date,
    endDate: Date,
    bankAccountId?: number,
  ): Promise<any[]> {
    // First get bank statements
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
      .eq("company_id", companyId)
      .gte("transaction_date", startDate.toISOString().split("T")[0])
      .lte("transaction_date", endDate.toISOString().split("T")[0])
      .is("deleted_at", null);

    if (bankAccountId) {
      query = query.eq("bank_account_id", bankAccountId);
    }

    const { data, error } = await query.order("transaction_date", {
      ascending: false,
    });

    if (error) throw error;
    
    // Get reconciled statement IDs
    const reconciledStatements = (data || []).filter(s => s.reconciliation_id);
    
    if (reconciledStatements.length === 0) {
      return data || [];
    }
    
    // Get aggregated transactions for reconciled statements
    const aggregateIds = reconciledStatements.map(s => s.reconciliation_id);
    const { data: aggregates, error: aggError } = await supabase
      .from("aggregated_transactions")
      .select(`
        id,
        gross_amount,
        nett_amount,
        bill_after_discount,
        payment_methods!left (
          name,
          code
        )
      `)
      .in("id", aggregateIds);

    if (aggError) throw aggError;
    
    // Create aggregate lookup map
    const aggregateMap = new Map(
      (aggregates || []).map(a => {
        const pm = Array.isArray(a.payment_methods) ? a.payment_methods[0] : a.payment_methods;
        return [
          a.id,
          {
            id: a.id,
            gross_amount: a.gross_amount,
            nett_amount: a.nett_amount,
            bill_after_discount: a.bill_after_discount,
            payment_method_name: pm?.name,
            payment_type: pm?.code,
          },
        ];
      })
    );
    
    // Transform data to include matched_aggregate
    return (data || []).map(row => ({
      ...row,
      matched_aggregate: row.reconciliation_id ? aggregateMap.get(row.reconciliation_id) || null : null,
    }));
  }

  /**
   * Get list of bank accounts with reconciliation summaries for a period
   */
  async getBankAccountsStatus(
    companyId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<any[]> {
    const { data, error } = await supabase
      .from("bank_statements")
      .select("bank_account_id, is_reconciled")
      .eq("company_id", companyId)
      .gte("transaction_date", startDate.toISOString().split("T")[0])
      .lte("transaction_date", endDate.toISOString().split("T")[0])
      .is("deleted_at", null);

    if (error) throw error;

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

    // Get account details
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

    if (accError) throw accError;

    return accounts.map((acc) => ({
      ...acc,
      stats: stats[acc.id],
    }));
  }

  /**
   * Update reconciliation status of a bank statement
   */
  async updateStatus(
    id: string,
    status: BankReconciliationStatus,
  ): Promise<void> {
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

    if (error) throw error;
  }

  /**
   * Mark a statement as reconciled with a specific aggregate
   */
  async markAsReconciled(
    statementId: string,
    aggregateId: string,
  ): Promise<void> {
    // Get aggregate to extract payment_method_id
    const { data: aggregate, error: aggError } = await supabase
      .from("aggregated_transactions")
      .select("payment_method_id")
      .eq("id", aggregateId)
      .maybeSingle();

    if (aggError) throw aggError;

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

    if (error) throw error;
  }

  /**
   * Bulk update status for multiple statements
   */
  async bulkUpdateReconciliationStatus(
    ids: string[],
    isReconciled: boolean,
  ): Promise<void> {
    const { error } = await supabase
      .from("bank_statements")
      .update({
        is_reconciled: isReconciled,
        updated_at: new Date().toISOString(),
      })
      .in("id", ids);

    if (error) throw error;
  }

  /**
   * Get unreconciled statements in batches for large datasets
   */
  async getUnreconciledBatch(
    companyId: string,
    startDate: Date,
    endDate: Date,
    limit: number = 1000,
    offset: number = 0,
    bankAccountId?: number,
  ): Promise<any[]> {
    let query = supabase
      .from("bank_statements")
      .select("*")
      .eq("company_id", companyId)
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

    if (error) throw error;
    return data || [];
  }

  /**
   * Log reconciliation action to audit trail
   */
  async logAction(data: {
    companyId: string;
    userId?: string;
    action: "MANUAL_RECONCILE" | "AUTO_MATCH" | "UNDO";
    statementId?: string;
    aggregateId?: string;
    details?: any;
  }): Promise<void> {
    const { error } = await supabase.from("bank_reconciliation_logs").insert({
      company_id: data.companyId,
      user_id: data.userId,
      action: data.action,
      statement_id: data.statementId,
      aggregate_id: data.aggregateId,
      details: data.details || {},
    });

    if (error) throw error;
  }

  /**
   * Undo reconciliation for a specific statement
   */
  async undoReconciliation(statementId: string): Promise<void> {
    const { error } = await supabase
      .from("bank_statements")
      .update({
        is_reconciled: false,
        reconciliation_id: null,
        reconciled_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", statementId);

    if (error) throw error;
  }

  // =====================================================
  // MULTI-MATCH REPOSITORY METHODS
  // =====================================================

  /**
   * Create a reconciliation group with multiple statements
   */
  async createReconciliationGroup(data: {
    companyId: string;
    aggregateId: string;
    statementIds: string[];
    totalBankAmount: number;
    aggregateAmount: number;
    difference: number;
    notes?: string;
    reconciledBy?: string;
  }): Promise<string> {
    const { data: group, error } = await supabase
      .from("bank_reconciliation_groups")
      .insert({
        company_id: data.companyId,
        aggregate_id: data.aggregateId,
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

    if (error) throw error;
    return group.id;
  }

  /**
   * Add statements to a reconciliation group
   */
  async addStatementsToGroup(
    groupId: string,
    statements: Array<{ statementId: string; amount: number }>
  ): Promise<void> {
    const details = statements.map(s => ({
      group_id: groupId,
      statement_id: s.statementId,
      amount: s.amount,
    }));

    const { error } = await supabase
      .from("bank_reconciliation_group_details")
      .insert(details);

    if (error) throw error;
  }

  /**
   * Get reconciliation group by ID with all details
   */
  async getReconciliationGroupById(groupId: string): Promise<any> {
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
          ),
          merchant_name
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

    if (error) throw error;
    return data;
  }

  /**
   * Mark statements as reconciled with a group
   */
  async markStatementsAsReconciledWithGroup(
    statementIds: string[],
    groupId: string
  ): Promise<void> {
    const { error } = await supabase
      .from("bank_statements")
      .update({
        is_reconciled: true,
        reconciled_at: new Date().toISOString(),
        reconciliation_group_id: groupId,
        updated_at: new Date().toISOString(),
      })
      .in("id", statementIds);

    if (error) throw error;
  }

  /**
   * Undo reconciliation - reset statements and soft delete group
   */
  async undoReconciliationGroup(groupId: string): Promise<void> {
    // Get group first to get statement IDs
    const group = await this.getReconciliationGroupById(groupId);
    if (!group) throw new Error("Group not found");

    // Reset statements
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

      if (error) throw error;
    }

    // Soft delete group
    const { error } = await supabase
      .from("bank_reconciliation_groups")
      .update({
        deleted_at: new Date().toISOString(),
        status: 'UNDO',
        updated_at: new Date().toISOString(),
      })
      .eq("id", groupId);

    if (error) throw error;
  }

  /**
   * Check if aggregate is already part of a group
   */
  async isAggregateInGroup(aggregateId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from("bank_reconciliation_groups")
      .select("id")
      .eq("aggregate_id", aggregateId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  }

  /**
   * Get unreconciled statements by date range for suggestion algorithm
   */
  async getUnreconciledStatementsForSuggestion(
    companyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    const { data, error } = await supabase
      .from("bank_statements")
      .select("id, transaction_date, description, debit_amount, credit_amount")
      .eq("company_id", companyId)
      .gte("transaction_date", startDate.toISOString().split("T")[0])
      .lte("transaction_date", endDate.toISOString().split("T")[0])
      .eq("is_reconciled", false)
      .is("deleted_at", null)
      .order("transaction_date", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get all reconciliation groups for a company
   */
  async getReconciliationGroups(
    companyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    const { data, error } = await supabase
      .from("bank_reconciliation_groups")
      .select(`
        *,
        aggregated_transactions (
          id,
          transaction_date,
          gross_amount,
          nett_amount,
          payment_methods!left (name),
          merchant_name
        )
      `)
      .eq("company_id", companyId)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }
}

export const bankReconciliationRepository = new BankReconciliationRepository();
