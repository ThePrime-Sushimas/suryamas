/**
 * POS Imports Service - COMPLETE VERSION
 * All critical issues resolved:
 * - N+1 query fixed
 * - Transaction management added
 * - confirmImport implemented
 * - File storage added
 * - Restore method added
 * - Jobs system integration
 * - ✅ chunk_info type support added
 */

import * as XLSX from "xlsx";
import { posImportsRepository } from "./pos-imports.repository";
import { posImportLinesRepository } from "../pos-import-lines/pos-import-lines.repository";
import { posAggregatesRepository } from "../pos-aggregates/pos-aggregates.repository";
import { PosImportErrors } from "../shared/pos-import.errors";
import {
  canTransition,
  extractDateRange,
  validatePosRow,
} from "../shared/pos-import.utils";
import {
  parseToLocalDate,
  parseToLocalDateTime,
} from "../shared/excel-date.util";
import { supabase } from "../../../config/supabase";
import { logInfo, logError, logWarn } from "../../../config/logger";
import { jobsService } from "../../jobs/jobs.service";
import { AuditService } from "../../monitoring/monitoring.service";
import type {
  PosImport,
  CreatePosImportDto,
  UpdatePosImportDto,
  PosImportFilter,
} from "./pos-imports.types";
import type {
  PosImportStatus,
  DuplicateAnalysis,
  FinancialSummary,
} from "../shared/pos-import.types";
import type { CreatePosImportLineDto } from "../pos-import-lines/pos-import-lines.types";
import type {
  PaginationParams,
  SortParams,
} from "../../../types/request.types";

// Column mapping for Excel
const EXCEL_COLUMN_MAP: Record<string, string> = {
  "#": "row_number",
  "Sales Number": "sales_number",
  "Bill Number": "bill_number",
  "Sales Type": "sales_type",
  "Batch Order": "batch_order",
  "Table Section": "table_section",
  "Table Name": "table_name",
  "Sales Date": "sales_date",
  "Sales Date In": "sales_date_in",
  "Sales Date Out": "sales_date_out",
  Branch: "branch",
  Brand: "brand",
  City: "city",
  Area: "area",
  "Visit Purpose": "visit_purpose",
  "Regular Member Code": "regular_member_code",
  "Regular Member Name": "regular_member_name",
  "Loyalty Member Code": "loyalty_member_code",
  "Loyalty Member Name": "loyalty_member_name",
  "Loyalty Member Type": "loyalty_member_type",
  "Employee Code": "employee_code",
  "Employee Name": "employee_name",
  "External Employee Code": "external_employee_code",
  "External Employee Name": "external_employee_name",
  "Customer Name": "customer_name",
  "Payment Method": "payment_method",
  "Menu Category": "menu_category",
  "Menu Category Detail": "menu_category_detail",
  Menu: "menu",
  "Custom Menu Name": "custom_menu_name",
  "Menu Code": "menu_code",
  "Menu Notes": "menu_notes",
  "Order Mode": "order_mode",
  Qty: "qty",
  Price: "price",
  Subtotal: "subtotal",
  Discount: "discount",
  "Service Charge": "service_charge",
  Tax: "tax",
  VAT: "vat",
  Total: "total",
  "Nett Sales": "nett_sales",
  DPP: "dpp",
  "Bill Discount": "bill_discount",
  "Total After Bill Discount": "total_after_bill_discount",
  Waiter: "waiter",
  "Order Time": "order_time",
};

class PosImportsService {
  /**
   * List POS imports with filters
   */
  async list(
    companyId: string,
    pagination: PaginationParams,
    sort?: SortParams,
    filter?: PosImportFilter,
  ) {
    return posImportsRepository.findAll(companyId, pagination, sort, filter);
  }

  /**
   * Get POS import by ID
   */
  async getById(id: string, companyId: string): Promise<PosImport> {
    const posImport = await posImportsRepository.findById(id, companyId);
    if (!posImport) {
      throw PosImportErrors.NOT_FOUND();
    }
    return posImport;
  }

  /**
   * Get POS import by ID with lines
   */
  async getByIdWithLines(id: string, companyId: string): Promise<any> {
    const posImport = await posImportsRepository.findByIdWithLines(
      id,
      companyId,
    );
    if (!posImport) {
      throw PosImportErrors.NOT_FOUND();
    }
    return posImport;
  }

  /**
   * Analyze uploaded Excel file for duplicates
   * SYNCHRONOUS - No job system. Just analyze and create pos_import record.
   * Job is created during confirm() instead.
   */
  async analyzeFile(
    file: Express.Multer.File,
    branchId: string,
    companyId: string,
    userId: string,
  ): Promise<{
    import: PosImport;
    analysis: DuplicateAnalysis;
    summary: FinancialSummary;
  }> {
    try {
      // Validate file size (50MB limit)
      if (file.size > 50 * 1024 * 1024) {
        throw PosImportErrors.FILE_TOO_LARGE(10);
      }

      // Parse Excel
      const workbook = XLSX.read(file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw PosImportErrors.INVALID_EXCEL_FORMAT();
      }

      const worksheet = workbook.Sheets[sheetName];
      let rows = XLSX.utils.sheet_to_json(worksheet, { range: 10 }); // Start from row 11 (0-indexed, so 10)

      // Filter out summary rows at the end (Discount Total Rounding, etc.)
      rows = rows.filter((row: any) => {
        const billNumber = row["Bill Number"];
        return (
          billNumber &&
          billNumber !== "Discount Total Rounding" &&
          billNumber !== "Rounding Total" &&
          billNumber !== "Voucher Purchase Total" &&
          billNumber !== "Platform Fee Total"
        );
      });

      if (rows.length === 0) {
        throw PosImportErrors.INVALID_FILE("File is empty");
      }

      // Validate required columns
      const firstRow: any = rows[0];
      const requiredColumns = ["Bill Number", "Sales Number", "Sales Date"];
      const missingColumns = requiredColumns.filter(
        (col) => !(col in firstRow),
      );
      if (missingColumns.length > 0) {
        throw PosImportErrors.MISSING_REQUIRED_COLUMNS(missingColumns);
      }

      // Validate rows
      const errors: string[] = [];
      rows.forEach((row: any, index) => {
        const rowErrors = validatePosRow(row, index + 2);
        errors.push(...rowErrors);
      });

      if (errors.length > 0) {
        throw PosImportErrors.INVALID_FILE(
          errors.slice(0, 10).join("; ") + (errors.length > 10 ? "..." : ""),
        );
      }

      // Extract date range (parse Excel dates first)
      const parsedRows = rows.map((r: any) => {
        return { sales_date: parseToLocalDate(r["Sales Date"]) };
      });
      const dateRange = extractDateRange(parsedRows);

      // Ganti duplicate check dengan new categorization
      const { newBillKeys, replaceableBillKeys, blockedBillKeys } =
        await this.categorizeBills(rows);

      const uniqueBillKeys = new Set(
        rows
          .filter((r: any) => r["Bill Number"] && r["Sales Date"])
          .map((r: any) => `${String(r["Bill Number"]).trim()}|${parseToLocalDate(r["Sales Date"])}`)
      );

      // new + replaceable = akan diproses, blocked = di-skip
      const willProcessCount = [...uniqueBillKeys].filter(
        k => newBillKeys.has(k) || replaceableBillKeys.has(k)
      ).length;

      const allRowBillKeys = rows.map((r: any) =>
        `${String(r["Bill Number"] || '').trim()}|${parseToLocalDate(r["Sales Date"])}`
      );

      const newRowsCount = allRowBillKeys.filter(k => newBillKeys.has(k)).length;
      const replaceableRowsCount = allRowBillKeys.filter(k => replaceableBillKeys.has(k)).length;
      const blockedRowsCount = allRowBillKeys.filter(k => blockedBillKeys.has(k)).length;

      // Calculate financial summary from rows (for preview before import)
      const financialSummary = this.calculateFinancialSummary(rows);

      // Create import record
      const posImport = await posImportsRepository.create(
        {
          company_id: companyId,
          branch_id: branchId,
          file_name: file.originalname,
          date_range_start:
            dateRange.start || new Date().toISOString().split("T")[0],
          date_range_end:
            dateRange.end || new Date().toISOString().split("T")[0],
          total_rows: rows.length,
          new_rows: newRowsCount,
          duplicate_rows: blockedRowsCount,
        },
        userId,
      );

      // Audit log for CREATE
      if (userId) {
        await AuditService.log(
          "CREATE",
          "pos_import",
          posImport.id,
          userId,
          null,
          {
            ...posImport,
            file_name: file.originalname,
          total_rows: rows.length,
            new_rows: newRowsCount,
            duplicate_rows: blockedRowsCount,
          },
        );
      }

      // Store parsed data with FULL chunk support
      const storageInfo = await this.storeTemporaryData(posImport.id, rows);
      
// Update with chunk metadata - FIXED TYPE
      await posImportsRepository.update(posImport.id, companyId, {
        status: 'ANALYZED' as const,
        chunk_info: storageInfo
      }, userId);

      logInfo('File analyzed and chunked', {
        import_id: posImport.id,
        chunks: storageInfo.total_chunks,
        size_mb: storageInfo.original_size_mb.toFixed(1)
      });

      const analysis: DuplicateAnalysis = {
        total_rows: rows.length,
        new_rows: newRowsCount,
        duplicate_rows: blockedRowsCount,        // blocked = truly duplicate (sudah accounting)
        replaceable_rows: replaceableRowsCount,   // bisa di-replace
        blocked_rows: blockedRowsCount,
        duplicates: [],
      };

      logInfo("PosImportsService analyzeFile success", {
        import_id: posImport.id,
        analysis,
        financialSummary,
      });

      return { import: posImport, analysis, summary: financialSummary };
    } catch (error) {
      logError("PosImportsService analyzeFile error", { error });
      throw error;
    }
  }

  /**
   * Check duplicate bills — per bill_number + sales_date
   * Returns Set of keys yang sudah ada di DB
   */
  private async checkDuplicateBills(rows: any[]): Promise<Set<string>> {
    const allBills = (rows as any[])
      .filter((r: any) => r["Bill Number"] && r["Sales Date"])
      .map((r: any) => ({
        bill_number: String(r["Bill Number"]).trim(),
        sales_date: parseToLocalDate(r["Sales Date"]),
      }));

    if (allBills.length === 0) return new Set();

    // Deduplicate
    const uniqueBills = Array.from(
      new Map(allBills.map(b => [`${b.bill_number}|${b.sales_date}`, b])).values()
    );

    const duplicateKeys = new Set<string>();
    const batchSize = 50;

    for (let i = 0; i < uniqueBills.length; i += batchSize) {
      const batch = uniqueBills.slice(i, i + batchSize);
      try {
        const found = await posImportLinesRepository.findExistingBills(batch);
        found.forEach(k => duplicateKeys.add(k));
      } catch (error) {
        logError('checkDuplicateBills batch failed', { error });
      }
    }

    return duplicateKeys;
  }

  /**
   * Categorize bills dari file upload menjadi 3 bucket:
   * - newBills: belum ada di DB → insert normal
   * - replaceableBills: ada di DB tapi belum MAPPED → hapus lama, insert baru
   * - blockedBills: ada di DB dan sudah MAPPED/POSTED → skip, tampilkan warning
   */
  private async categorizeBills(rows: any[]): Promise<{
    newBillKeys: Set<string>;
    replaceableBillKeys: Set<string>;
    blockedBillKeys: Set<string>;
  }> {
    // Step 1: Cek duplikat di pos_import_lines (per bill)
    const existingBillKeys = await this.checkDuplicateBills(rows);

    if (existingBillKeys.size === 0) {
      return {
        newBillKeys: new Set(
          rows
            .filter((r: any) => r["Bill Number"] && r["Sales Date"])
            .map((r: any) => `${String(r["Bill Number"]).trim()}|${parseToLocalDate(r["Sales Date"])}`)
        ),
        replaceableBillKeys: new Set(),
        blockedBillKeys: new Set(),
      };
    }

    // Step 2: Per-bill tracking — cari import_id per bill, lalu cek mana yang sudah mapped
    // Note: source_ref di aggregated_transactions bukan bill_number, tapi format: date-branch-payment
    // Jadi kita check per pos_import_id (source_id), bukan per bill
    const existingBillNumbers = [...existingBillKeys].map(k => k.split('|')[0]);

    // Fetch bill_number → pos_import_id mapping
    const billImportMapping = await posImportLinesRepository.findBillImportMapping(existingBillNumbers);

    // Build map: bill_number → Set<import_id>
    const billToImportIds = new Map<string, Set<string>>();
    for (const row of billImportMapping) {
      if (!billToImportIds.has(row.bill_number)) {
        billToImportIds.set(row.bill_number, new Set());
      }
      billToImportIds.get(row.bill_number)!.add(row.pos_import_id);
    }

    // Cek mapped imports (yang sudah punya aggregated READY/PROCESSING/COMPLETED)
    const allRelatedImportIds = [...new Set(billImportMapping.map(d => d.pos_import_id))];
    const mappedImports = await posAggregatesRepository.findMappedImports(allRelatedImportIds);

    const newBillKeys = new Set<string>();
    const replaceableBillKeys = new Set<string>();
    const blockedBillKeys = new Set<string>();

    const allBillKeys = new Set(
      rows
        .filter((r: any) => r["Bill Number"] && r["Sales Date"])
        .map((r: any) => `${String(r["Bill Number"]).trim()}|${parseToLocalDate(r["Sales Date"])}`)
    );

    for (const key of allBillKeys) {
      const billNumber = key.split('|')[0];
      if (!existingBillKeys.has(key)) {
        newBillKeys.add(key);
      } else {
        // Cek apakah bill ini spesifik berasal dari import yang sudah mapped
        const relatedImportIds = billToImportIds.get(billNumber) || new Set();
        const isBillMapped = [...relatedImportIds].every(iid => mappedImports.has(iid));

        if (isBillMapped) {
          blockedBillKeys.add(key);
        } else {
          replaceableBillKeys.add(key);
        }
      }
    }

    return { newBillKeys, replaceableBillKeys, blockedBillKeys };
  }

  /**
   * Calculate financial summary from Excel rows
   */
  private calculateFinancialSummary(rows: any[]): {
    totalAmount: number;
    totalTax: number;
  } {
    let totalAmount = 0;
    let totalTax = 0;

    rows.forEach((row) => {
      // Parse numeric values from Excel cells
      
      const total = parseFloat(row["Total"] || 0);
      const tax = parseFloat(row["Tax"] || row["VAT"] || 0);

      totalAmount += isNaN(total) ? 0 : total;
      totalTax += isNaN(tax) ? 0 : tax;
    });

    return { totalAmount, totalTax };
  }

  /**
   * Store temporary data - FULL CHUNK SUPPORT
   * Auto-splits large JSON >4MB into part1.json, part2.json
   */
  private async storeTemporaryData(
    importId: string,
    rows: any[],
  ): Promise<{ total_chunks: number; original_size_mb: number }> {
    const jsonString = JSON.stringify(rows)
    const jsonSize = new Blob([jsonString]).size
    const originalSizeMB = (jsonSize / (1024 * 1024)).toFixed(1)

    logInfo('Storing data with chunk detection', { 
      import_id: importId, 
      size_mb: originalSizeMB,
      rows_count: rows.length 
    })

    // Single file if small
    if (jsonSize <= 4 * 1024 * 1024) {
      const { error } = await supabase.storage
        .from('pos-imports-temp')
        .upload(`${importId}.json`, jsonString, {
          contentType: 'application/json',
          upsert: true
        })

      if (error) {
        logError('Single file upload failed', { importId, error })
        throw new Error('Storage upload failed')
      }
      
      logInfo('Single file stored', { import_id: importId })
      return { total_chunks: 1, original_size_mb: parseFloat(originalSizeMB) }
    }

    // CHUNK large files - ROWS based (safe JSON arrays + RESPECT BILL BOUNDARIES)
    const ROWS_PER_CHUNK = 5000
    const chunksRows: any[][] = []
    let currentChunk: any[] = []

    // Grouping by Bill Number + Sales Date
    const groupedByBill = rows.reduce((acc, row) => {
      const billNumber = String(row["Bill Number"] || '').trim()
      const salesDate = parseToLocalDate(row["Sales Date"])
      const key = `${billNumber}|${salesDate}`
      
      if (!acc[key]) acc[key] = []
      acc[key].push(row)
      return acc
    }, {} as Record<string, any[]>)

    // Build chunks respecting bill boundaries
    Object.values(groupedByBill).forEach((billRows: any) => {
      // Jika chunk sudah penuh, pindah ke chunk baru
      // Terkecuali jika billRows sendiri lebih besar dari ROWS_PER_CHUNK, 
      // maka dia akan masuk ke chunk sendiri
      if (currentChunk.length > 0 && currentChunk.length + (billRows as any[]).length > ROWS_PER_CHUNK) {
        chunksRows.push(currentChunk)
        currentChunk = []
      }
      currentChunk.push(...(billRows as any[]))
    })

    if (currentChunk.length > 0) {
      chunksRows.push(currentChunk)
    }

    const chunks = chunksRows.map(c => JSON.stringify(c))

    // Upload each chunk
    let chunkIndex = 1
    for (const chunkJson of chunks) {
      const chunkKey = `${importId}-part${chunkIndex}.json`
      
      const { error } = await supabase.storage
        .from('pos-imports-temp')
        .upload(chunkKey, chunkJson, { 
          contentType: 'application/json',
          upsert: true 
        })

      if (error) {
        logError('Chunk upload failed', { importId, chunk: chunkIndex, error })
        throw new Error(`Chunk ${chunkIndex} upload failed`)
      }
      
      const chunkRows = JSON.parse(chunkJson)
      logInfo('Chunk uploaded', { importId, chunk: chunkIndex, rows_in_chunk: chunkRows.length })
      chunkIndex++
    }

    logInfo('All chunks uploaded - ROWS BASED', { 
      import_id: importId, 
      total_chunks: chunks.length,
      original_size_mb: parseFloat(originalSizeMB)
    })
    
    return { total_chunks: chunks.length, original_size_mb: parseFloat(originalSizeMB) }
  }

  /**
   * Retrieve temporary data from Supabase Storage
   */
  private async retrieveTemporaryData(importId: string): Promise<any[]> {
    // Step 1: Coba baca chunk_info dari pos_imports untuk tahu berapa chunks
    const posImport = await posImportsRepository.findByIdOnly(importId);
    const chunkInfo = posImport?.chunk_info as {
      total_chunks: number;
      original_size_mb: number;
    } | null;

    // Step 2: Multi-chunk
    if (chunkInfo && chunkInfo.total_chunks > 1) {
      logInfo("retrieveTemporaryData: reading multi-chunk", {
        importId,
        total_chunks: chunkInfo.total_chunks,
      });

      const allRows: any[] = [];

      for (let i = 1; i <= chunkInfo.total_chunks; i++) {
        const chunkKey = `${importId}-part${i}.json`;
        const { data, error } = await supabase.storage
          .from("pos-imports-temp")
          .download(chunkKey);

        if (error) {
          logError("retrieveTemporaryData chunk download failed", {
            importId,
            chunk: i,
            error,
          });
          throw new Error(`Chunk ${i} not found. Please re-upload the file.`);
        }

        const text = await data.text();
        const chunkRows = JSON.parse(text);
        allRows.push(...chunkRows);

        logInfo("retrieveTemporaryData chunk loaded", {
          importId,
          chunk: i,
          rows_in_chunk: chunkRows.length,
          total_so_far: allRows.length,
        });
      }

      logInfo("retrieveTemporaryData multi-chunk complete", {
        importId,
        total_rows: allRows.length,
      });

      return allRows;
    }

    // Step 3: Single file
    try {
      const { data, error } = await supabase.storage
        .from("pos-imports-temp")
        .download(`${importId}.json`);

      if (error) throw error;

      const text = await data.text();
      return JSON.parse(text);
    } catch (error) {
      logError("retrieveTemporaryData single file failed", { importId, error });
      throw new Error("Temporary data not found. Please re-upload the file.");
    }
  }

  /**
   * Confirm and import data to pos_import_lines
   * Creates a job with proper posImportId in metadata
   */
  async confirmImport(
    id: string,
    companyId: string,
    skipDuplicates: boolean,
    userId: string,
  ): Promise<{ posImport: PosImport; job_id: string }> {
    const posImport = await this.getById(id, companyId);

    if (!canTransition(posImport.status, "IMPORTED")) {
      throw PosImportErrors.INVALID_STATUS_TRANSITION(
        posImport.status,
        "IMPORTED",
      );
    }

    // Create a job for processing the import
    const jobName = `Import POS Transactions: ${posImport.file_name}`;
    const job = await jobsService.createJob({
      user_id: userId,
      company_id: companyId,
      type: "import",
      module: "pos_transactions",
      name: jobName,
      metadata: {
        type: "import",
        module: "pos_transactions",
        posImportId: id,
        skipDuplicates: skipDuplicates,
        ...(posImport.chunk_info ? { chunk_info: posImport.chunk_info } : {})
      },
    });

    // Update status to IMPORTED
    await posImportsRepository.update(
      id,
      companyId,
      { status: "IMPORTED" },
      userId,
    );

    // Audit log for UPDATE (status changed to IMPORTED)
    if (userId) {
      await AuditService.log(
        "UPDATE",
        "pos_import",
        id,
        userId,
        { status: posImport.status, skip_duplicates: skipDuplicates },
        { status: "IMPORTED", skip_duplicates: skipDuplicates },
      );
    }

    logInfo("PosImportsService confirmImport - job created", {
      import_id: id,
      job_id: job.id,
      skip_duplicates: skipDuplicates,
    });

    return { posImport, job_id: job.id };
  }

  /**
   * Synchronous import processing (fallback when no job_id)
   */
  private async processImportSync(
    id: string,
    companyId: string,
    skipDuplicates: boolean,
    userId: string,
  ): Promise<PosImport> {
    try {
      const rows = await this.retrieveTemporaryData(id);

      const lines: CreatePosImportLineDto[] = rows.map((row: any, index: number) => {
        const mapped: any = { pos_import_id: id, row_number: index + 1 };
        Object.entries(EXCEL_COLUMN_MAP).forEach(([excelCol, dbCol]) => {
          const value = row[excelCol];
          if (value !== undefined && value !== null && value !== '') {
            if (dbCol === 'sales_date_in' || dbCol === 'sales_date_out' || dbCol === 'order_time') {
              mapped[dbCol] = parseToLocalDateTime(value);
            } else if (dbCol === 'sales_date') {
              mapped[dbCol] = parseToLocalDate(value);
            } else {
              mapped[dbCol] = value;
            }
          }
        });
        return mapped;
      });

      // Kategorisasi bills
      const { newBillKeys, replaceableBillKeys, blockedBillKeys } =
        await this.categorizeBills(rows);

      logInfo('Bill categorization result', {
        import_id: id,
        new: newBillKeys.size,
        replaceable: replaceableBillKeys.size,
        blocked: blockedBillKeys.size,
      });

      // Handle replaceable bills — void aggregated dulu, hapus lines lama
      if (replaceableBillKeys.size > 0) {
        const replaceableBills = [...replaceableBillKeys].map(k => ({
          bill_number: k.split('|')[0],
          sales_date: k.split('|')[1],
        }));

        // Cari import_id LAMA yang terkait dengan replaceable bills
        const oldBillMapping = await posImportLinesRepository.findBillImportMapping(
          replaceableBills.map(b => b.bill_number)
        );
        const oldImportIds = [...new Set(oldBillMapping.map(d => d.pos_import_id))];

        // Void aggregated dari import LAMA (bukan import yang sedang diproses)
        let totalVoided = 0;
        for (const oldImportId of oldImportIds) {
          const voidedCount = await posAggregatesRepository.voidByImportId(oldImportId);
          totalVoided += voidedCount;
          logInfo('Voided old aggregated transactions', {
            new_import_id: id,
            old_import_id: oldImportId,
            voided_count: voidedCount,
          });

          // Hapus pos_import_lines lama dari import LAMA
          await posImportLinesRepository.deleteByBillNumbers(replaceableBills, oldImportId);
        }

        logInfo('Replaceable bills cleared', {
          import_id: id,
          old_import_ids: oldImportIds,
          total_voided_aggregated: totalVoided,
          bill_count: replaceableBills.length,
        });
      }

      // Filter lines yang akan di-insert
      // new + replaceable → insert, blocked → skip, invalid → reject
      const invalidLines: any[] = [];
      const linesToInsert = lines.filter(line => {
        if (!line.bill_number || !line.sales_date) {
          invalidLines.push(line);
          return false;
        }
        const key = `${line.bill_number}|${line.sales_date}`;
        return newBillKeys.has(key) || replaceableBillKeys.has(key);
      });

      if (invalidLines.length > 0) {
        logWarn('Lines skipped — missing bill_number or sales_date', {
          import_id: id,
          count: invalidLines.length,
          row_numbers: invalidLines.map(l => l.row_number),
        });
      }

      const skippedCount = lines.length - linesToInsert.length;

      if (linesToInsert.length > 0) {
        await posImportLinesRepository.bulkInsert(linesToInsert);
      }

      // Warning kalau ada yang diblock
      if (blockedBillKeys.size > 0) {
        logWarn('Some bills blocked — already in accounting pipeline', {
          import_id: id,
          blocked_bills: [...blockedBillKeys],
        });
      }

      await posImportsRepository.update(
        id,
        companyId,
        {
          status: 'IMPORTED',
          new_rows: linesToInsert.length,
          duplicate_rows: skippedCount,
        },
        userId,
      );

      await this.cleanupTemporaryData(id);

      logInfo('processImportSync success', {
        id,
        inserted: linesToInsert.length,
        skipped: skippedCount,
        replaced: replaceableBillKeys.size,
        blocked: blockedBillKeys.size,
      });

      return this.getById(id, companyId);
    } catch (error) {
      await posImportsRepository.update(id, companyId, {
        status: 'FAILED',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      }, userId);

      logError('processImportSync error', { id, error });
      throw error;
    }
  }

  /**
   * Clean up temporary data from storage
   */
  private async cleanupTemporaryData(importId: string): Promise<void> {
    try {
      const posImport = await posImportsRepository.findByIdOnly(importId);
      const chunkInfo = posImport?.chunk_info as { total_chunks: number } | null;

      if (chunkInfo && chunkInfo.total_chunks > 1) {
        // Hapus semua chunks
        const filesToRemove = Array.from(
          { length: chunkInfo.total_chunks },
          (_, i) => `${importId}-part${i + 1}.json`,
        );

        await supabase.storage.from("pos-imports-temp").remove(filesToRemove);

        logInfo("cleanupTemporaryData chunks removed", {
          importId,
          chunks: filesToRemove.length,
        });
      } else {
        // Single file
        await supabase.storage
          .from("pos-imports-temp")
          .remove([`${importId}.json`]);

        logInfo("cleanupTemporaryData single file removed", { importId });
      }
    } catch (error) {
      logError("cleanupTemporaryData error", { importId, error });
      // Non-critical
    }
  }

  /**
   * Update import status
   */
  async updateStatus(
    id: string,
    companyId: string,
    status: PosImportStatus,
    errorMessage: string | undefined,
    userId: string,
  ): Promise<PosImport> {
    const posImport = await this.getById(id, companyId);

    if (!canTransition(posImport.status, status)) {
      throw PosImportErrors.INVALID_STATUS_TRANSITION(posImport.status, status);
    }

    await posImportsRepository.update(
      id,
      companyId,
      { status, error_message: errorMessage },
      userId,
    );

    // Audit log for UPDATE (status change)
    if (userId) {
      await AuditService.log(
        "UPDATE",
        "pos_import",
        id,
        userId,
        { status: posImport.status, error_message: posImport.error_message },
        { status, error_message: errorMessage },
      );
    }

    return this.getById(id, companyId);
  }

  /**
   * Delete POS import
   */
  async delete(id: string, companyId: string, userId: string): Promise<void> {
    const posImport = await this.getById(id, companyId);

    if (posImport.status === "POSTED") {
      throw PosImportErrors.CANNOT_DELETE_POSTED();
    }

    // Delete lines first (CASCADE will handle this, but explicit is better)
    await posImportLinesRepository.deleteByImportId(id);

    // Soft delete import
    await posImportsRepository.delete(id, companyId, userId);

    // Audit log for DELETE
    if (userId) {
      await AuditService.log(
        "DELETE",
        "pos_import",
        id,
        userId,
        posImport,
        null,
      );
    }

    // Clean up temporary data
    await this.cleanupTemporaryData(id);
  }

  /**
   * Restore deleted import (FIXED: Implemented)
   */
  async restore(
    id: string,
    companyId: string,
    userId: string,
  ): Promise<PosImport> {
    const posImport = await posImportsRepository.restore(id, companyId, userId);
    if (!posImport) {
      throw PosImportErrors.NOT_FOUND();
    }

    // Audit log for RESTORE
    if (userId) {
      await AuditService.log(
        "RESTORE",
        "pos_import",
        id,
        userId,
        null,
        posImport,
      );
    }

    return posImport;
  }

  /**
   * Export POS import to Excel
   */
  async exportToExcel(id: string, companyId: string): Promise<Buffer> {
    const posImport = await this.getById(id, companyId);
    const allLines = await posImportLinesRepository.findAllByImportId(id);

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Prepare data with headers
    const data = [
      // Header row
      Object.keys(EXCEL_COLUMN_MAP),
      // Data rows
      ...allLines.map((line) =>
        Object.keys(EXCEL_COLUMN_MAP).map((excelCol) => {
          const dbCol = EXCEL_COLUMN_MAP[excelCol];
          return (line as any)[dbCol] ?? "";
        }),
      ),
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "POS Data");

    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  }
}

export const posImportsService = new PosImportsService();
