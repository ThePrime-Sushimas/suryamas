/**
 * Bank Statement Import Repository
 * Database operations untuk bank statement imports dan statements
 */

import { pool } from "../../../config/db";
import { storageService } from "../../../services/storage.service";
import {
  BankStatementImport,
  BankStatement,
  CreateBankStatementImportDto,
  UpdateBankStatementImportDto,
  CreateBankStatementDto,
  BankStatementImportFilterParams,
  BankStatementFilterParams,
  ImportJobParams,
  JobProgressUpdate,
} from "./bank-statement-import.types";
import { BankStatementImportErrors } from "./bank-statement-import.errors";
import { logError, logWarn } from "../../../config/logger";
import { jobsRepository } from "../../jobs";

// ============================================================================
// REPOSITORY CLASS
// ============================================================================

export class BankStatementImportRepository {
  /**
   * Create new import record
   */
  async create(
    data: CreateBankStatementImportDto,
  ): Promise<BankStatementImport | null> {
    try {
      const { rows } = await pool.query(
        `INSERT INTO bank_statement_imports (
          company_id, bank_account_id, file_name, file_size, file_hash, 
          status, total_rows, processed_rows, failed_rows, created_by, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, 'PENDING', 0, 0, 0, $6, $7)
        RETURNING *`,
        [
          data.company_id,
          data.bank_account_id,
          data.file_name,
          data.file_size,
          data.file_hash,
          data.created_by,
          new Date().toISOString(),
        ],
      );
      return rows[0] as BankStatementImport;
    } catch (error: any) {
      logError("BankStatementImportRepository.create error", {
        error: error.message,
      });
      throw BankStatementImportErrors.CREATE_FAILED();
    }
  }

  /**
   * Find import by ID
   */
  async findById(id: number): Promise<BankStatementImport | null> {
    try {
      const { rows } = await pool.query(
        `SELECT 
          bsi.*,
          ba.account_name,
          ba.account_number,
          b.bank_name
        FROM bank_statement_imports bsi
        LEFT JOIN bank_accounts ba ON bsi.bank_account_id = ba.id
        LEFT JOIN banks b ON ba.bank_id = b.id
        WHERE bsi.id = $1 AND bsi.deleted_at IS NULL`,
        [id],
      );

      if (rows.length === 0) {
        throw BankStatementImportErrors.IMPORT_NOT_FOUND(id);
      }

      return rows[0] as BankStatementImport;
    } catch (error: any) {
      if (error.code === "IMPORT_NOT_FOUND") throw error;
      logError("BankStatementImportRepository.findById error", {
        id,
        error: error.message,
      });
      throw BankStatementImportErrors.IMPORT_NOT_FOUND(id);
    }
  }

  /**
   * Find all imports dengan pagination
   */
  async findAll(
    companyId: string,
    pagination: { page: number; limit: number },
    filter?: BankStatementImportFilterParams,
  ): Promise<{ data: BankStatementImport[]; total: number }> {
    const offset = (pagination.page - 1) * pagination.limit;
    const params: any[] = [companyId];
    const conditions: string[] = [
      "bsi.company_id = $1",
      "bsi.deleted_at IS NULL",
    ];

    if (filter?.bank_account_id) {
      params.push(filter.bank_account_id);
      conditions.push(`bsi.bank_account_id = $${params.length}`);
    }
    if (filter?.status) {
      params.push(filter.status);
      conditions.push(`bsi.status = $${params.length}`);
    }
    if (filter?.date_from) {
      params.push(filter.date_from);
      conditions.push(`bsi.created_at >= $${params.length}`);
    }
    if (filter?.date_to) {
      params.push(filter.date_to);
      conditions.push(`bsi.created_at <= $${params.length}`);
    }
    if (filter?.search) {
      params.push(`%${filter.search}%`);
      conditions.push(`bsi.file_name ILIKE $${params.length}`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    try {
      const { rows: countRows } = await pool.query(
        `SELECT COUNT(*)::int as total FROM bank_statement_imports bsi ${whereClause}`,
        params,
      );
      const total = countRows[0].total;

      const dataParams = [...params, pagination.limit, offset];
      const { rows } = await pool.query(
        `SELECT 
          bsi.*,
          ba.account_name,
          ba.account_number,
          b.bank_name
        FROM bank_statement_imports bsi
        LEFT JOIN bank_accounts ba ON bsi.bank_account_id = ba.id
        LEFT JOIN banks b ON ba.bank_id = b.id
        ${whereClause}
        ORDER BY bsi.created_at DESC
        LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
        dataParams,
      );

      return { data: rows as BankStatementImport[], total };
    } catch (error: any) {
      logError("BankStatementImportRepository.findAll error", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update import record
   */
  async update(
    id: number,
    data: UpdateBankStatementImportDto,
  ): Promise<BankStatementImport | null> {
    try {
      const fields = Object.keys(data);
      if (fields.length === 0) return this.findById(id);

      const values = fields.map((f) => (data as any)[f]);
      values.push(new Date().toISOString(), id);

      const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(", ");
      const { rows } = await pool.query(
        `UPDATE bank_statement_imports SET ${setClause}, updated_at = $${fields.length + 1} WHERE id = $${fields.length + 2} RETURNING *`,
        values,
      );

      if (rows.length === 0) throw BankStatementImportErrors.UPDATE_FAILED(id);
      return rows[0] as BankStatementImport;
    } catch (error: any) {
      logError("BankStatementImportRepository.update error", {
        id,
        error: error.message,
      });
      throw BankStatementImportErrors.UPDATE_FAILED(id);
    }
  }

  /**
   * Update import progress
   */
  async updateProgress(
    id: number,
    processedRows: number,
    failedRows: number,
  ): Promise<void> {
    try {
      await pool.query(
        "UPDATE bank_statement_imports SET processed_rows = $1, failed_rows = $2, updated_at = $3 WHERE id = $4",
        [processedRows, failedRows, new Date().toISOString(), id],
      );
    } catch (error: any) {
      logError("BankStatementImportRepository.updateProgress error", {
        id,
        error: error.message,
      });
    }
  }

  /**
   * Hard delete import record
   */
  async delete(id: number, _userId: string): Promise<void> {
    try {
      await pool.query("DELETE FROM bank_statement_imports WHERE id = $1", [
        id,
      ]);
    } catch (error: any) {
      logError("BankStatementImportRepository.delete error", {
        id,
        error: error.message,
      });
      throw BankStatementImportErrors.DELETE_FAILED(id);
    }
  }

  /**
   * Bulk insert bank statements with validation
   */
  async bulkInsert(statements: CreateBankStatementDto[]): Promise<number> {
    if (statements.length === 0) return 0;

    const validStatements = statements.filter((statement) => {
      const debit = Number(statement.debit_amount) || 0;
      const credit = Number(statement.credit_amount) || 0;
      return debit > 0 || credit > 0;
    });

    if (validStatements.length === 0) return 0;

    try {
      const columns = [
        "company_id",
        "bank_account_id",
        "import_id",
        "transaction_date",
        "transaction_time",
        "reference_number",
        "description",
        "debit_amount",
        "credit_amount",
        "balance",
        "row_number",
        "source_file",
        "is_pending",
        "is_reconciled",
        "reconciliation_id",
        "reconciliation_group_id",
        "payment_method_id",
        "created_at",
        "updated_at",
      ];

      const values: any[] = [];
      const placeholders = validStatements
        .map((s, i) => {
          const base = i * columns.length;
          values.push(
            s.company_id,
            s.bank_account_id,
            s.import_id,
            s.transaction_date,
            s.transaction_time || null,
            s.reference_number || null,
            s.description,
            s.debit_amount || 0,
            s.credit_amount || 0,
            s.balance || 0,
            s.row_number || null,
            s.source_file || null,
            s.is_pending || false,
            s.is_reconciled || false,
            s.reconciliation_id || null,
            s.reconciliation_group_id || null,
            s.payment_method_id || null,
            new Date().toISOString(),
            new Date().toISOString(),
          );
          return `(${columns.map((_, j) => `$${base + j + 1}`).join(", ")})`;
        })
        .join(", ");

      const { rows } = await pool.query(
        `INSERT INTO bank_statements (${columns.join(", ")}) VALUES ${placeholders} RETURNING id`,
        values,
      );

      return rows.length;
    } catch (error: any) {
      logError("BankStatementImportRepository.bulkInsert error", {
        error: error.message,
        statementCount: validStatements.length,
      });
      throw BankStatementImportErrors.IMPORT_FAILED(error.message);
    }
  }

  /**
   * Bulk insert with detailed error tracking
   */
  async bulkInsertWithDetails(
    statements: CreateBankStatementDto[],
  ): Promise<{ inserted: number; failed: CreateBankStatementDto[] }> {
    if (statements.length === 0) return { inserted: 0, failed: [] };

    const validStatements: CreateBankStatementDto[] = [];
    const failedStatements: CreateBankStatementDto[] = [];

    statements.forEach((statement) => {
      const debit = Number(statement.debit_amount) || 0;
      const credit = Number(statement.credit_amount) || 0;
      if (debit > 0 || credit > 0) validStatements.push(statement);
      else failedStatements.push(statement);
    });

    if (validStatements.length === 0)
      return { inserted: 0, failed: statements };

    try {
      const insertedCount = await this.bulkInsert(validStatements);
      return { inserted: insertedCount, failed: failedStatements };
    } catch (err) {
      logError("BankStatementImportRepository.bulkInsertWithDetails error", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      return this.insertIndividually(validStatements);
    }
  }

  /**
   * Insert statements individually as fallback.
   * Uses the same column set as bulkInsert to avoid NOT NULL failures.
   */
  private async insertIndividually(
    statements: CreateBankStatementDto[],
  ): Promise<{ inserted: number; failed: CreateBankStatementDto[] }> {
    let inserted = 0;
    const failed: CreateBankStatementDto[] = [];

    for (const statement of statements) {
      try {
        const { rows } = await pool.query(
          `INSERT INTO bank_statements (
            company_id, bank_account_id, import_id, transaction_date, transaction_time,
            reference_number, description, debit_amount, credit_amount, balance,
            row_number, source_file, is_pending, is_reconciled, reconciliation_id,
            reconciliation_group_id, payment_method_id, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
          RETURNING id`,
          [
            statement.company_id,
            statement.bank_account_id,
            statement.import_id ?? null,
            statement.transaction_date,
            statement.transaction_time ?? null,
            statement.reference_number ?? null,
            statement.description ?? null,
            statement.debit_amount ?? 0,
            statement.credit_amount ?? 0,
            statement.balance ?? 0,
            statement.row_number ?? null,
            statement.source_file ?? null,
            statement.is_pending ?? false,
            statement.is_reconciled ?? false,
            statement.reconciliation_id ?? null,
            statement.reconciliation_group_id ?? null,
            statement.payment_method_id ?? null,
            new Date().toISOString(),
            new Date().toISOString(),
          ],
        );
        if (rows.length > 0) inserted++;
        else failed.push(statement);
      } catch {
        failed.push(statement);
      }
    }

    return { inserted, failed };
  }

  /**
   * Find statements by import ID
   */
  async findByImportId(
    importId: number,
    pagination: { page: number; limit: number },
  ): Promise<{ data: BankStatement[]; total: number }> {
    const offset = (pagination.page - 1) * pagination.limit;

    try {
      const { rows: countRows } = await pool.query(
        "SELECT COUNT(*)::int as total FROM bank_statements WHERE import_id = $1 AND deleted_at IS NULL",
        [importId],
      );
      const total = countRows[0].total;

      const { rows } = await pool.query(
        `SELECT * FROM bank_statements 
         WHERE import_id = $1 AND deleted_at IS NULL 
         ORDER BY transaction_date DESC, row_number ASC 
         LIMIT $2 OFFSET $3`,
        [importId, pagination.limit, offset],
      );

      return { data: rows as BankStatement[], total };
    } catch (error: any) {
      logError("BankStatementImportRepository.findByImportId error", {
        importId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Find statements dengan filters
   */
  async findStatements(
    companyId: string,
    pagination: { page: number; limit: number },
    filter?: BankStatementFilterParams,
  ): Promise<{ data: BankStatement[]; total: number }> {
    const offset = (pagination.page - 1) * pagination.limit;
    const params: any[] = [companyId];
    const conditions: string[] = ["company_id = $1", "deleted_at IS NULL"];

    if (filter?.bank_account_id) {
      params.push(filter.bank_account_id);
      conditions.push(`bank_account_id = $${params.length}`);
    }
    if (filter?.transaction_date_from) {
      params.push(filter.transaction_date_from);
      conditions.push(`transaction_date >= $${params.length}`);
    }
    if (filter?.transaction_date_to) {
      params.push(filter.transaction_date_to);
      conditions.push(`transaction_date <= $${params.length}`);
    }
    if (filter?.is_reconciled !== undefined) {
      params.push(filter.is_reconciled);
      conditions.push(`is_reconciled = $${params.length}`);
    }
    if (filter?.transaction_type) {
      params.push(filter.transaction_type);
      conditions.push(`transaction_type = $${params.length}`);
    }
    if (filter?.import_id) {
      params.push(filter.import_id);
      conditions.push(`import_id = $${params.length}`);
    }
    if (filter?.search) {
      params.push(`%${filter.search}%`);
      conditions.push(
        `(description ILIKE $${params.length} OR reference_number ILIKE $${params.length})`,
      );
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    try {
      const { rows: countRows } = await pool.query(
        `SELECT COUNT(*)::int as total FROM bank_statements ${whereClause}`,
        params,
      );
      const total = countRows[0].total;

      const dataParams = [...params, pagination.limit, offset];
      const { rows } = await pool.query(
        `SELECT * FROM bank_statements 
         ${whereClause} 
         ORDER BY transaction_date DESC 
         LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
        dataParams,
      );

      return { data: rows as BankStatement[], total };
    } catch (error: any) {
      logError("BankStatementImportRepository.findStatements error", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Check for duplicate file hash
   */
  async checkFileHashExistsIncludingDeleted(
    fileHash: string,
    companyId: string,
  ): Promise<BankStatementImport | null> {
    try {
      const { rows } = await pool.query(
        "SELECT * FROM bank_statement_imports WHERE file_hash = $1 AND company_id = $2 ORDER BY created_at DESC LIMIT 1",
        [fileHash, companyId],
      );
      return rows[0] || null;
    } catch (error: any) {
      logError(
        "BankStatementImportRepository.checkFileHashExistsIncludingDeleted error",
        { error: error.message },
      );
      return null;
    }
  }

  /**
   * Check for active (non-deleted) file hash
   */
  async checkFileHashExists(
    fileHash: string,
    companyId: string,
  ): Promise<BankStatementImport | null> {
    try {
      const { rows } = await pool.query(
        "SELECT * FROM bank_statement_imports WHERE file_hash = $1 AND company_id = $2 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1",
        [fileHash, companyId],
      );
      return rows[0] || null;
    } catch (error: any) {
      logError("BankStatementImportRepository.checkFileHashExists error", {
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Check for duplicate transactions
   */
  async checkDuplicates(
    transactions: {
      reference_number?: string;
      transaction_date: string;
      debit_amount: number;
      credit_amount: number;
      description?: string;
      balance?: number;
      bank_account_id: number;
    }[],
    bankAccountId: number,
  ): Promise<BankStatement[]> {
    if (transactions.length === 0) return [];

    const DATE_TOLERANCE_DAYS = 3;
    const normalize = (s: string) =>
      (s || "").replace(/\s+/g, " ").trim().toLowerCase();

    const uniquePairs = transactions.filter(
      (pair, index, self) =>
        index ===
        self.findIndex(
          (p) =>
            p.transaction_date === pair.transaction_date &&
            p.debit_amount === pair.debit_amount &&
            p.credit_amount === pair.credit_amount,
        ),
    );

    const allDates = uniquePairs.map((p) =>
      new Date(p.transaction_date).getTime(),
    );
    const minDate = new Date(Math.min(...allDates));
    const maxDate = new Date(Math.max(...allDates));
    minDate.setDate(minDate.getDate() - DATE_TOLERANCE_DAYS);
    maxDate.setDate(maxDate.getDate() + DATE_TOLERANCE_DAYS);

    try {
      const { rows: existing } = await pool.query(
        `SELECT id, reference_number, transaction_date, credit_amount, debit_amount, import_id, description, balance, bank_account_id, is_pending 
         FROM bank_statements 
         WHERE bank_account_id = $1 AND transaction_date >= $2 AND transaction_date <= $3 AND deleted_at IS NULL`,
        [
          bankAccountId,
          minDate.toISOString().split("T")[0],
          maxDate.toISOString().split("T")[0],
        ],
      );

      const existingBalanceSet = new Set(
        existing
          .filter((ex: any) => ex.balance != null && Number(ex.balance) !== 0)
          .map((ex: any) => Number(ex.balance).toFixed(2)),
      );

      const allDuplicates: BankStatement[] = [];

      for (const pair of uniquePairs) {
        if (pair.balance != null && Number(pair.balance) !== 0) {
          const pairBalanceKey = Number(pair.balance).toFixed(2);
          if (existingBalanceSet.has(pairBalanceKey)) {
            const match = existing.find(
              (ex) =>
                ex.balance != null &&
                Number(ex.balance).toFixed(2) === pairBalanceKey,
            );
            if (match) {
              allDuplicates.push(match as BankStatement);
              continue;
            }
          }
        }

        const pairDescNorm = normalize(pair.description || "");
        const pairDate = (pair.transaction_date || "").split("T")[0];

        const matches = existing.filter((ex) => {
          const amountMatch =
            Number(ex.debit_amount) === Number(pair.debit_amount) &&
            Number(ex.credit_amount) === Number(pair.credit_amount);
          if (!amountMatch) return false;

          if (
            pair.reference_number &&
            ex.reference_number &&
            pair.reference_number !== ex.reference_number
          )
            return false;

          if (ex.is_pending) return true;

          const exDescNorm = normalize(ex.description || "");
          if (pairDescNorm && exDescNorm && pairDescNorm === exDescNorm)
            return true;

          const exDate = (ex.transaction_date || "").split("T")[0];
          if (
            pair.reference_number &&
            ex.reference_number &&
            pair.reference_number === ex.reference_number &&
            exDate === pairDate
          )
            return true;

          if (exDate === pairDate && pairDescNorm && exDescNorm) {
            return (
              this.calculateDescriptionSimilarity(
                pair.description || "",
                ex.description || "",
              ) >= 0.7
            );
          }

          return false;
        });

        allDuplicates.push(...(matches as BankStatement[]));
      }

      return allDuplicates.filter(
        (dup, index, self) => index === self.findIndex((d) => d.id === dup.id),
      );
    } catch (error: any) {
      logError("checkDuplicates error", { error: error.message });
      return [];
    }
  }

  /**
   * Calculate description similarity
   */
  private calculateDescriptionSimilarity(desc1: string, desc2: string): number {
    if (!desc1 || !desc2) return 0;
    if (desc1 === desc2) return 1;

    const normalize = (s: string) =>
      s
        .replace(/\s+/g, " ")
        .replace(/[^\w\s]/g, "")
        .trim();

    const n1 = normalize(desc1);
    const n2 = normalize(desc2);

    if (n1 === n2) return 1;

    const shorter = n1.length < n2.length ? n1 : n2;
    const longer = n1.length < n2.length ? n2 : n1;

    if (shorter.length === 0) return 0;
    if (shorter.length < 10) return 0;
    if (longer.includes(shorter)) return 0.9;

    const words1 = new Set(shorter.split(" ").filter((w) => w.length > 2));
    const words2 = longer.split(" ").filter((w) => w.length > 2);

    if (words1.size === 0) return 0;

    let matches = 0;
    for (const word of words1) {
      if (words2.includes(word)) matches++;
    }

    return matches / words1.size;
  }

  /**
   * Get summary by import ID
   */
  async getSummaryByImportId(importId: number): Promise<{
    total_statements: number;
    total_credit: number;
    total_debit: number;
    reconciled_count: number;
  }> {
    try {
      const { rows } = await pool.query(
        "SELECT credit_amount, debit_amount, is_reconciled FROM bank_statements WHERE import_id = $1 AND deleted_at IS NULL",
        [importId],
      );

      return {
        total_statements: rows.length,
        total_credit: rows.reduce(
          (sum, s) => sum + (Number(s.credit_amount) || 0),
          0,
        ),
        total_debit: rows.reduce(
          (sum, s) => sum + (Number(s.debit_amount) || 0),
          0,
        ),
        reconciled_count: rows.filter((s) => s.is_reconciled).length,
      };
    } catch (error: any) {
      logError("BankStatementImportRepository.getSummaryByImportId error", {
        importId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete statements by import ID
   */
  async deleteByImportId(importId: number): Promise<void> {
    try {
      await pool.query("DELETE FROM bank_statements WHERE import_id = $1", [
        importId,
      ]);
    } catch (error: any) {
      logError("BankStatementImportRepository.deleteByImportId error", {
        importId,
        error: error.message,
      });
    }
  }

  /**
   * Undo all reconciliations for statements in an import
   */
  async undoReconciliationsForImport(importId: number): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { rows: reconciledStmts } = await client.query(
        "SELECT id, reconciliation_id, reconciliation_group_id, cash_deposit_id FROM bank_statements WHERE import_id = $1 AND is_reconciled = true AND deleted_at IS NULL",
        [importId],
      );

      if (reconciledStmts.length === 0) {
        await client.query("COMMIT");
        return;
      }

      const aggregateIds = reconciledStmts
        .map((s: any) => s.reconciliation_id)
        .filter(Boolean);
      const cashDepositIds = reconciledStmts
        .map((s: any) => s.cash_deposit_id)
        .filter(Boolean);
      const stmtIds = reconciledStmts.map((s: any) => s.id);

      if (aggregateIds.length > 0) {
        await client.query(
          `UPDATE aggregated_transactions SET is_reconciled = false, actual_fee_amount = 0, fee_discrepancy = 0, fee_discrepancy_note = null, updated_at = $1 WHERE id = ANY($2)`,
          [new Date().toISOString(), aggregateIds],
        );
      }

      if (cashDepositIds.length > 0) {
        await client.query(
          `UPDATE cash_deposits SET status = 'DEPOSITED', bank_statement_id = null, updated_at = $1 WHERE id = ANY($2)`,
          [new Date().toISOString(), cashDepositIds],
        );
      }

      await client.query(
        `UPDATE bank_statements SET is_reconciled = false, reconciliation_id = null, reconciliation_group_id = null, cash_deposit_id = null, updated_at = $1 WHERE id = ANY($2)`,
        [new Date().toISOString(), stmtIds],
      );

      await client.query("COMMIT");
    } catch (error: any) {
      await client.query("ROLLBACK");
      logError("undoReconciliationsForImport error", {
        importId,
        error: error.message,
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Hard delete of an import record
   */
  async hardDelete(id: number): Promise<void> {
    try {
      await pool.query("DELETE FROM bank_statement_imports WHERE id = $1", [
        id,
      ]);
    } catch (error: any) {
      logError("BankStatementImportRepository.hardDelete error", {
        id,
        error: error.message,
      });
      throw new Error(`Failed to hard delete import: ${error.message}`);
    }
  }

  /**
   * Replace existing PEND records that match with settled rows
   */
  async replacePendingWithSettled(
    companyId: string,
    bankAccountId: number,
    settledRows: Array<{
      transaction_date: string;
      debit_amount: number;
      credit_amount: number;
      balance?: number;
      description: string;
      company_id?: string;
      bank_account_id?: number;
      import_id?: number;
      row_number?: number;
      transaction_time?: string;
      reference_number?: string;
      source_file?: string;
    }>,
  ): Promise<{ replacedCount: number; handledSettledKeys: Set<string> }> {
    let replacedCount = 0;
    const handledSettledKeys = new Set<string>();
    const DATE_TOLERANCE_DAYS = 2;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      for (const row of settledRows) {
        const baseDate = new Date(row.transaction_date);
        const dateFrom = new Date(baseDate);
        dateFrom.setDate(dateFrom.getDate() - DATE_TOLERANCE_DAYS);
        const dateTo = new Date(baseDate);
        dateTo.setDate(dateTo.getDate() + DATE_TOLERANCE_DAYS);

        const dateFromStr = dateFrom.toISOString().split("T")[0];
        const dateToStr = dateTo.toISOString().split("T")[0];

        const { rows: matchedPends } = await client.query(
          `SELECT id, is_reconciled, reconciliation_id, reconciliation_group_id, payment_method_id 
           FROM bank_statements 
           WHERE company_id = $1 AND bank_account_id = $2 AND is_pending = true 
             AND transaction_date >= $3 AND transaction_date <= $4 
             AND debit_amount = $5 AND credit_amount = $6 AND deleted_at IS NULL`,
          [
            companyId,
            bankAccountId,
            dateFromStr,
            dateToStr,
            row.debit_amount,
            row.credit_amount,
          ],
        );

        if (matchedPends.length === 0) continue;

        for (const pend of matchedPends) {
          if (!pend.is_reconciled) {
            await client.query("DELETE FROM bank_statements WHERE id = $1", [
              pend.id,
            ]);
            replacedCount++;
          } else {
            await client.query(
              `INSERT INTO bank_statements (
                company_id, bank_account_id, transaction_date, transaction_time, reference_number, 
                description, debit_amount, credit_amount, balance, import_id, row_number, 
                source_file, is_pending, is_reconciled, reconciliation_id, reconciliation_group_id, 
                payment_method_id, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
              [
                row.company_id || companyId,
                row.bank_account_id || bankAccountId,
                row.transaction_date,
                row.transaction_time || null,
                row.reference_number || null,
                row.description,
                row.debit_amount,
                row.credit_amount,
                row.balance || null,
                row.import_id || null,
                row.row_number || null,
                row.source_file || null,
                false,
                true,
                pend.reconciliation_id || null,
                pend.reconciliation_group_id || null,
                pend.payment_method_id || null,
                new Date().toISOString(),
              ],
            );

            await client.query(
              "UPDATE bank_statements SET is_pending = false, updated_at = $1 WHERE id = $2",
              [new Date().toISOString(), pend.id],
            );
            handledSettledKeys.add(
              `${row.transaction_date}-${row.debit_amount}-${row.credit_amount}`,
            );
            replacedCount++;
          }
        }
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return { replacedCount, handledSettledKeys };
  }

  /**
   * Find pending records by date range
   */
  async findPendingByDateRange(
    companyId: string,
    bankAccountId: number,
    dateFrom: string,
    dateTo: string,
  ): Promise<BankStatement[]> {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM bank_statements 
         WHERE company_id = $1 AND bank_account_id = $2 AND is_pending = true 
           AND transaction_date >= $3 AND transaction_date <= $4 AND deleted_at IS NULL`,
        [companyId, bankAccountId, dateFrom, dateTo],
      );
      return rows as BankStatement[];
    } catch (error: any) {
      logError("findPendingByDateRange error", {
        companyId,
        bankAccountId,
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Cleanup stale pending records
   */
  async cleanupStalePendingRecords(daysOld: number = 3): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    try {
      const { rows } = await pool.query(
        "DELETE FROM bank_statements WHERE is_pending = true AND transaction_date < $1 RETURNING id",
        [cutoffDate.toISOString().split("T")[0]],
      );
      return rows.length;
    } catch (error: any) {
      logError("cleanupStalePendingRecords error", { error: error.message });
      return 0;
    }
  }

  /**
   * Count existing statements in a date range
   */
  async countExistingStatements(
    companyId: string,
    bankAccountId: number,
    startDate: string,
    endDate: string,
  ): Promise<number> {
    try {
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int as total FROM bank_statements 
         WHERE company_id = $1 AND bank_account_id = $2 AND transaction_date >= $3 AND transaction_date <= $4 AND deleted_at IS NULL`,
        [companyId, bankAccountId, startDate, endDate],
      );
      return rows[0].total;
    } catch (error: any) {
      logError("countExistingStatements error", {
        companyId,
        bankAccountId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create background job record for import.
   * Uses SELECT * FROM to correctly handle the set-returning function.
   */
  async createImportJob(params: ImportJobParams): Promise<string> {
    try {
      const { rows } = await pool.query(
        'SELECT * FROM create_job_atomic($1, $2, $3, $4, $5, $6)',
        [
          params.userId,
          params.companyId,
          'import',
          'bank_statements',
          `Import Bank Statement ${params.fileName}`,
          JSON.stringify({
            importId: params.importId,
            bankAccountId: params.bankAccountId,
            companyId: params.companyId,
            skipDuplicates: params.skipDuplicates,
            totalRows: params.totalRows,
          }),
        ],
      );

      if (rows.length === 0 || !rows[0].id) {
        throw new Error('Failed to create job');
      }

      return rows[0].id;
    } catch (error: any) {
      logError('BankStatementImportRepository.createImportJob error', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update job progress payload
   */
  async updateJobProgress(
    jobId: string,
    progress: JobProgressUpdate,
  ): Promise<void> {
    const percentage = Math.max(
      0,
      Math.min(100, Math.round(progress.percentage)),
    );
    try {
      await jobsRepository.updateProgress(jobId, percentage);
    } catch (error: any) {
      logWarn("BankStatementImportRepository.updateJobProgress error", {
        jobId,
        percentage,
        error: error?.message || String(error),
      });
    }
  }

  /**
   * Get import file name
   */
  async getImportFileName(importId: number): Promise<string> {
    try {
      const { rows } = await pool.query(
        "SELECT file_name FROM bank_statement_imports WHERE id = $1 LIMIT 1",
        [importId],
      );
      if (rows.length === 0)
        throw new Error(`Import with ID ${importId} not found`);
      return rows[0].file_name;
    } catch (error: any) {
      logError("BankStatementImportRepository.getImportFileName error", {
        importId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Store temporary import rows (STILL USES SUPABASE STORAGE)
   */
  async uploadTemporaryData<T = any>(
    importId: number,
    rows: T[],
  ): Promise<void> {
    const jsonData = JSON.stringify(rows);
    await storageService.uploadToPath(jsonData, `${importId}.json`, 'application/json', 'bankstatementimportstemp');
  }

  /**
   * Retrieve temporary import rows (STILL USES SUPABASE STORAGE)
   */
  async downloadTemporaryData<T = any>(importId: number): Promise<T[]> {
    const text = await storageService.download(`${importId}.json`, 'bankstatementimportstemp');
    return JSON.parse(text) as T[];
  }

  /**
   * Remove temporary import rows (STILL USES SUPABASE STORAGE)
   */
  async removeTemporaryData(importId: number): Promise<boolean> {
    try {
      await storageService.remove([`${importId}.json`], 'bankstatementimportstemp');
      return true;
    } catch (error) {
      logError("BankStatementImportRepository.removeTemporaryData error", { importId, error });
      return false;
    }
  }

  /**
   * Insert single manual bank statement
   */
  async insertManualStatement(
    data: CreateBankStatementDto,
  ): Promise<BankStatement> {
    try {
      const { rows } = await pool.query(
        `INSERT INTO bank_statements (
          company_id, bank_account_id, transaction_date, transaction_time, description, 
          debit_amount, credit_amount, balance, source_file, import_id, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'MANUAL_ENTRY', NULL, $9) RETURNING *`,
        [
          data.company_id,
          data.bank_account_id,
          data.transaction_date,
          data.transaction_time || null,
          data.description,
          data.debit_amount || 0,
          data.credit_amount || 0,
          data.balance || 0,
          new Date().toISOString(),
        ],
      );
      return rows[0] as BankStatement;
    } catch (error: any) {
      logError("BankStatementImportRepository.insertManualStatement error", {
        error: error.message,
      });
      throw new Error(`Gagal menyimpan manual entry: ${error.message}`);
    }
  }

  /**
   * Insert bulk manual bank statements
   */
  async insertManualStatements(
    statements: CreateBankStatementDto[],
  ): Promise<{ inserted: number; ids: number[] }> {
    if (statements.length === 0) return { inserted: 0, ids: [] };

    try {
      const columns = [
        "company_id",
        "bank_account_id",
        "transaction_date",
        "transaction_time",
        "description",
        "debit_amount",
        "credit_amount",
        "balance",
        "source_file",
        "import_id",
        "updated_at",
      ];
      const values: any[] = [];
      const placeholders = statements
        .map((s, i) => {
          const base = i * columns.length;
          values.push(
            s.company_id,
            s.bank_account_id,
            s.transaction_date,
            s.transaction_time || null,
            s.description,
            s.debit_amount || 0,
            s.credit_amount || 0,
            s.balance || 0,
            "MANUAL_ENTRY",
            null,
            new Date().toISOString(),
          );
          return `(${columns.map((_, j) => `$${base + j + 1}`).join(", ")})`;
        })
        .join(", ");

      const { rows } = await pool.query(
        `INSERT INTO bank_statements (${columns.join(", ")}) VALUES ${placeholders} RETURNING id`,
        values,
      );
      return { inserted: rows.length, ids: rows.map((r) => r.id) };
    } catch (error: any) {
      logError("BankStatementImportRepository.insertManualStatements error", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Find single bank statement
   */
  async findStatementById(
    id: number,
    companyId: string,
  ): Promise<BankStatement | null> {
    try {
      const { rows } = await pool.query(
        "SELECT * FROM bank_statements WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL",
        [id, companyId],
      );
      return (rows[0] as BankStatement) || null;
    } catch (error: any) {
      logError("findStatementById error", { id, error: error.message });
      return null;
    }
  }

  /**
   * Hard delete single statement
   */
  async hardDeleteStatement(id: number, companyId: string): Promise<void> {
    try {
      await pool.query(
        "DELETE FROM bank_statements WHERE id = $1 AND company_id = $2",
        [id, companyId],
      );
    } catch (error: any) {
      logError("hardDeleteStatement error", {
        id,
        companyId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Hard delete multiple statements
   */
  async hardDeleteStatements(
    ids: number[],
    companyId: string,
  ): Promise<number> {
    if (ids.length === 0) return 0;
    try {
      const { rows } = await pool.query(
        "DELETE FROM bank_statements WHERE id = ANY($1) AND company_id = $2 RETURNING id",
        [ids, companyId],
      );
      return rows.length;
    } catch (error: any) {
      logError("hardDeleteStatements error", { ids, error: error.message });
      throw error;
    }
  }

  /**
   * Find multiple statements by IDs
   */
  async findStatementsByIds(
    ids: number[],
    companyId: string,
  ): Promise<BankStatement[]> {
    try {
      const { rows } = await pool.query(
        "SELECT * FROM bank_statements WHERE id = ANY($1) AND company_id = $2 AND deleted_at IS NULL",
        [ids, companyId],
      );
      return rows as BankStatement[];
    } catch (error: any) {
      logError("findStatementsByIds error", { error: error.message });
      return [];
    }
  }

  /**
   * List manual entries
   */
  async listManualEntries(
    companyId: string,
    bankAccountId: number,
  ): Promise<BankStatement[]> {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM bank_statements 
         WHERE company_id = $1 AND bank_account_id = $2 AND source_file = 'MANUAL_ENTRY' AND deleted_at IS NULL 
         ORDER BY transaction_date DESC, created_at DESC`,
        [companyId, bankAccountId],
      );
      return rows as BankStatement[];
    } catch (error: any) {
      logError("listManualEntries error", { error: error.message });
      throw error;
    }
  }

  /**
   * Get payment methods by bank account
   */
  async getPaymentMethodsByBankAccount(
    companyId: string,
    bankAccountId: number,
  ): Promise<Array<{ id: number; name: string }>> {
    try {
      const { rows } = await pool.query(
        "SELECT id, name FROM payment_methods WHERE company_id = $1 AND bank_account_id = $2 AND is_active = true AND deleted_at IS NULL",
        [companyId, bankAccountId],
      );
      return rows;
    } catch (error: any) {
      logError("getPaymentMethodsByBankAccount error", {
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Get branch IDs by company
   */
  async getBranchIdsByCompany(companyId: string): Promise<string[]> {
    try {
      const { rows } = await pool.query(
        "SELECT id FROM branches WHERE company_id = $1",
        [companyId],
      );
      return rows.map((r) => r.id);
    } catch (error: any) {
      logError("getBranchIdsByCompany error", { error: error.message });
      return [];
    }
  }

  /**
   * Get aggregated POS transactions
   */
  async getAggregatedByDateAndPM(
    branchIds: string[],
    paymentMethodIds: number[],
    dateFrom: string,
    dateTo: string,
  ): Promise<
    Array<{
      transaction_date: string;
      payment_method_id: number;
      payment_method_name: string;
      total_bill: number;
      total_nett: number;
    }>
  > {
    if (paymentMethodIds.length === 0 || branchIds.length === 0) return [];

    try {
      const { rows } = await pool.query(
        `SELECT 
          at.transaction_date, 
          at.payment_method_id, 
          pm.name as payment_method_name,
          SUM(COALESCE(at.bill_after_discount, 0))::float as total_bill,
          SUM(COALESCE(at.nett_amount, 0))::float as total_nett
        FROM aggregated_transactions at
        LEFT JOIN payment_methods pm ON at.payment_method_id = pm.id
        WHERE at.payment_method_id = ANY($1) 
          AND at.branch_id = ANY($2)
          AND at.transaction_date >= $3 
          AND at.transaction_date <= $4
          AND at.deleted_at IS NULL
          AND at.superseded_by IS NULL
        GROUP BY at.transaction_date, at.payment_method_id, pm.name
        ORDER BY at.transaction_date DESC`,
        [paymentMethodIds, branchIds, dateFrom, dateTo],
      );
      return rows;
    } catch (error: any) {
      logError("getAggregatedByDateAndPM error", { error: error.message });
      return [];
    }
  }
}

export const bankStatementImportRepository =
  new BankStatementImportRepository();
