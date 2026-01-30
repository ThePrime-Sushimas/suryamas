import { Pool, PoolClient } from 'pg';
import { BankReconciliationStatus } from './bank-reconciliation.types';

export class BankReconciliationRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * Find bank statement by ID
   */
  async findById(id: string, client?: PoolClient): Promise<any> {
    const db = client || this.pool;
    const query = 'SELECT * FROM bank_statements WHERE id = $1 AND deleted_at IS NULL';
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Get unreconciled bank statements for a company on a specific date
   */
  async getUnreconciled(companyId: string, date: Date, client?: PoolClient): Promise<any[]> {
    const db = client || this.pool;
    const query = `
      SELECT * FROM bank_statements 
      WHERE company_id = $1 
        AND transaction_date = $2 
        AND is_reconciled = false 
        AND deleted_at IS NULL
      ORDER BY transaction_date DESC, created_at DESC
    `;
    const result = await db.query(query, [companyId, date]);
    return result.rows;
  }

  /**
   * Get bank statements by date range
   */
  async getByDateRange(
    companyId: string, 
    startDate: Date, 
    endDate: Date, 
    client?: PoolClient
  ): Promise<any[]> {
    const db = client || this.pool;
    const query = `
      SELECT * FROM bank_statements 
      WHERE company_id = $1 
        AND transaction_date BETWEEN $2 AND $3
        AND deleted_at IS NULL
      ORDER BY transaction_date DESC
    `;
    const result = await db.query(query, [companyId, startDate, endDate]);
    return result.rows;
  }

  /**
   * Update reconciliation status of a bank statement
   */
  async updateStatus(
    id: string, 
    status: BankReconciliationStatus, 
    client?: PoolClient
  ): Promise<void> {
    const db = client || this.pool;
    const query = `
      UPDATE bank_statements 
      SET is_reconciled = $1,
          updated_at = NOW()
      WHERE id = $2
    `;
    // For simplicity, is_reconciled is true if status is not PENDING/UNRECONCILED/DISCREPANCY
    const isReconciled = ![
      BankReconciliationStatus.PENDING, 
      BankReconciliationStatus.UNRECONCILED, 
      BankReconciliationStatus.DISCREPANCY
    ].includes(status);
    
    await db.query(query, [isReconciled, id]);
  }

  /**
   * Mark a statement as reconciled with a specific aggregate
   */
  async markAsReconciled(
    statementId: string, 
    aggregateId: string, 
    client?: PoolClient
  ): Promise<void> {
    const db = client || this.pool;
    const query = `
      UPDATE bank_statements 
      SET is_reconciled = true,
          reconciled_at = NOW(),
          reconciliation_id = $1,
          updated_at = NOW()
      WHERE id = $2
    `;
    await db.query(query, [aggregateId, statementId]);
  }

  /**
   * Bulk update status for multiple statements
   */
  async bulkUpdateReconciliationStatus(
    ids: string[], 
    isReconciled: boolean, 
    client?: PoolClient
  ): Promise<void> {
    const db = client || this.pool;
    const query = `
      UPDATE bank_statements 
      SET is_reconciled = $1,
          updated_at = NOW()
      WHERE id = ANY($2)
    `;
    await db.query(query, [isReconciled, ids]);
  }

  /**
   * Get unreconciled statements in batches for large datasets
   */
  async getUnreconciledBatch(
    companyId: string, 
    date: Date, 
    limit: number = 1000, 
    offset: number = 0,
    client?: PoolClient
  ): Promise<any[]> {
    const db = client || this.pool;
    const query = `
      SELECT * FROM bank_statements 
      WHERE company_id = $1 
        AND transaction_date = $2 
        AND is_reconciled = false 
        AND deleted_at IS NULL
      ORDER BY transaction_date DESC, created_at DESC
      LIMIT $3 OFFSET $4
    `;
    const result = await db.query(query, [companyId, date, limit, offset]);
    return result.rows;
  }
}

