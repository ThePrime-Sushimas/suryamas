/**
 * POS Aggregated Transactions Optimized Processor
 *
 * Improvements:
 * 1. Batch payment method lookup (ambil semua sekaligus)
 * 2. Progress tracking dengan callback
 * 3. Chunked processing untuk data besar
 * 4. Failed transactions disimpan dengan status FAILED, TIDAK fallback ke CASH
 */

import { pool } from "@/config/db";
import { posAggregatesRepository } from "../../pos-imports/pos-aggregates/pos-aggregates.repository";
import { posImportLinesRepository } from "../../pos-imports/pos-import-lines/pos-import-lines.repository";
import type {
  AggregatedTransaction,
  AggregatedTransactionSourceType,
  AggregatedTransactionStatus,
} from "../../pos-imports/pos-aggregates/pos-aggregates.types";
import { logInfo, logError, logWarn } from "@/config/logger";
import { posSyncAggregatesRepository } from "../../pos-sync-aggregates/pos-sync-aggregates.repository";

// ==============================
// CONFIGURATION
// ==============================
const BATCH_SIZE = 100; // Insert batch size
const CHECK_BATCH_SIZE = 50; // Supabase REST header limit aman
const SPLIT_PAYMENT_REGEX = /^(.*?)\s*\(\s*([\d.,]+)\s*\)$/;

interface ProgressCallback {
  (progress: {
    current: number;
    total: number;
    phase: string;
    message: string;
  }): void;
}

interface GenerateAggregatedResult {
  created: number;
  skipped: number;
  failed: number;
  errors: Array<{ source_ref: string; error: string }>;
  total_groups: number;
}

// Interface untuk failed transaction dengan error details
interface FailedTransactionRecord {
  data: Omit<
    AggregatedTransaction,
    "id" | "created_at" | "updated_at" | "version"
  >;
  error: string;
}

/**
 * Normalize payment method name for matching
 * Handles: "qris mandiri - cv" -> "qris mandiri - cv"
 *         "QRIS MANDIRI - CV" -> "qris mandiri - cv"
 *         "qris mandiri  - cv" -> "qris mandiri - cv" (double space normalized)
 */
function normalizePaymentMethodName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Optimized batch payment method lookup (GLOBAL - tidak per company)
 * Mengambil semua payment methods yang needed dalam 1 query
 * TIDAK fallback ke CASH - jika tidak ditemukan, akan ditandai sebagai failed
 * Note: companyId parameter kept for future use but lookup is global
 *
 * 🔥 ALSO FETCHES FEE CONFIGURATION for automatic fee calculation
 */
async function resolvePaymentMethodsBatch(
  paymentMethodNames: string[],
  _companyId?: string, // Not used - lookup is global
): Promise<
  Map<
    string,
    {
      id: number;
      isFallback: boolean;
      name: string;
      fee_percentage: number;
      fee_fixed_amount: number;
      fee_fixed_per_transaction: boolean;
    }
  >
> {
  const result = new Map<
    string,
    {
      id: number;
      isFallback: boolean;
      name: string;
      fee_percentage: number;
      fee_fixed_amount: number;
      fee_fixed_per_transaction: boolean;
    }
  >();

  if (paymentMethodNames.length === 0) return result;

  // Normalize names for matching
  const uniqueNames = [
    ...new Set(paymentMethodNames.map((n) => normalizePaymentMethodName(n))),
  ];

  // Batch query - cari semua payment methods yang needed (global, tidak per company)
  // Payment method lookup dibuat global untuk menghindari mismatch nama
  // 🔥 INCLUDE FEE COLUMNS untuk fee calculation
  const { rows: allPaymentMethods } = await pool.query(
    `SELECT id, name, code, is_active, coa_account_id, company_id, fee_percentage, fee_fixed_amount, fee_fixed_per_transaction
     FROM payment_methods WHERE is_active = true`
  );

  // Create normalized map from all payment methods
  interface PaymentMethodRow {
    id: number;
    name: string;
    code: string;
    is_active: boolean;
    coa_account_id: string;
    company_id: string;
    fee_percentage: number;
    fee_fixed_amount: number;
    fee_fixed_per_transaction: boolean;
  }
  const foundMap = new Map<string, PaymentMethodRow>();
  for (const pm of allPaymentMethods || []) {
    const key = normalizePaymentMethodName(pm.name);
    foundMap.set(key, pm);
  }

  // Log found payment methods for debugging
  logInfo("Payment methods lookup result", {
    requested: uniqueNames,
    found: [...foundMap.keys()],
    not_found: uniqueNames.filter((name) => !foundMap.has(name)),
  });

  // Assign results - ONLY found payment methods
  // NO FALLBACK - if not found, it will be marked as failed
  for (const name of uniqueNames) {
    const pm = foundMap.get(name);
    if (pm) {
      result.set(name, {
        id: pm.id,
        isFallback: false,
        name: pm.name,
        fee_percentage: pm.fee_percentage || 0,
        fee_fixed_amount: pm.fee_fixed_amount || 0,
        fee_fixed_per_transaction: pm.fee_fixed_per_transaction || false,
      });
    } else {
      // DO NOT fallback - mark as not found
      result.set(name, {
        id: 0,
        isFallback: false,
        name: name,
        fee_percentage: 0,
        fee_fixed_amount: 0,
        fee_fixed_per_transaction: false,
      });
      logWarn("Payment method not found - will be marked as failed", { name });
    }
  }

  return result;
}

/**
 * Parse split payment string into individual methods with amounts.
 * Example: "Deposit - PT (200.000),QRIS BCA - M (319.200)"
 * Returns empty array if no valid splits found.
 */
function parseSplitPayment(
  rawPaymentMethod: string,
): { name: string; amount: number }[] {
  const splits: { name: string; amount: number }[] = [];

  if (!rawPaymentMethod.includes("(")) return splits;

  const parts = rawPaymentMethod.includes(",")
    ? rawPaymentMethod.split(",").map((p) => p.trim())
    : [rawPaymentMethod.trim()];

  for (const part of parts) {
    const match = SPLIT_PAYMENT_REGEX.exec(part);
    if (match) {
      const name = match[1].trim();
      const amountStr = match[2].replace(/\./g, "").replace(/,/g, ".");
      const amount = parseFloat(amountStr);
      if (!isNaN(amount)) {
        splits.push({ name, amount });
      }
    }
  }

  return splits;
}

/**
 * Group lines by transaction key (date|branch|raw_payment_method_string).
 *
 * IMPORTANT: Split payment resolution is intentionally deferred to AFTER
 * aggregation. This avoids the mismatch where split amounts (e.g. 200k/300k)
 * are applied as ratios to individual line totals (e.g. 30k-60k each),
 * causing reconciliation gaps.
 *
 * For split payments, the raw payment method string is used as the group key
 * so all lines from that transaction are aggregated together first. The split
 * into multiple aggregated_transactions rows happens post-aggregation.
 */
function groupLinesByTransaction(lines: any[]): Map<string, any[]> {
  const groups = new Map<string, any[]>();

  for (const line of lines) {
    const rawPaymentMethod = line.payment_method || "unknown";
    const salesDate = line.sales_date || "unknown";
    const branch = line.branch || "unknown";

    // For split payments: parse to get the canonical name for the group key,
    // but keep all lines grouped under the raw string so we can aggregate first.
    const splits = parseSplitPayment(rawPaymentMethod);

    let groupKey: string;
    let lineToStore = line;

    if (splits.length === 1) {
      // Single payment with parenthesis notation "Name (Amount)" → strip amount
      const pm = normalizePaymentMethodName(splits[0].name);
      groupKey = `${salesDate}|${branch}|${pm}`;
      lineToStore = { ...line, payment_method: splits[0].name };
    } else if (splits.length > 1) {
      // TRUE split payment: GROUP ALL LINES UNDER THE RAW STRING.
      // Post-aggregation logic will handle the actual split.
      // Use a stable key derived from the raw string (normalized).
      const pm = normalizePaymentMethodName(rawPaymentMethod);
      groupKey = `${salesDate}|${branch}|${pm}`;
    } else {
      // Regular single payment method
      const pm = normalizePaymentMethodName(rawPaymentMethod);
      groupKey = `${salesDate}|${branch}|${pm}`;
    }

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(lineToStore);
  }

  return groups;
}

/**
 * Store failed transactions with FAILED status
 */
async function storeFailedTransactions(
  failedRecords: FailedTransactionRecord[],
): Promise<number> {
  if (failedRecords.length === 0) return 0;

  logInfo("Storing failed transactions", { count: failedRecords.length });

  try {
    const result =
      await posAggregatesRepository.createFailedBatch(failedRecords);
    logInfo("Failed transactions stored", {
      created: result.created,
      failed: result.failed,
    });
    return result.created;
  } catch (error) {
    logError("Failed to store failed transactions", { error });
    return 0;
  }
}

/**
 * Optimized: Generate aggregated transactions dari POS import lines
 *
 * @param posImportId - ID dari import
 * @param branchName - Optional branch filter
 * @param companyId - Company ID untuk lookup
 * @param onProgress - Progress callback
 */
export async function generateAggregatedTransactionsOptimized(
  posImportId: string,
  branchName: string | undefined,
  companyId: string,
  onProgress?: ProgressCallback,
): Promise<GenerateAggregatedResult> {
  const startTime = Date.now();

  try {
    onProgress?.({
      current: 0,
      total: 100,
      phase: "loading",
      message: "Loading import lines...",
    });

    // PHASE 1: Load all lines dari import
    const lines = await posImportLinesRepository.findAllByImportId(posImportId);

    if (lines.length === 0) {
      return { created: 0, skipped: 0, failed: 0, errors: [], total_groups: 0 };
    }

    logInfo("Starting optimized aggregated transaction generation", {
      pos_import_id: posImportId,
      total_lines: lines.length,
    });

    onProgress?.({
      current: 10,
      total: 100,
      phase: "grouping",
      message: "Grouping transactions...",
    });

    // PHASE 2: Group lines by transaction key
    const transactionGroups = groupLinesByTransaction(lines);
    const groupArray = Array.from(transactionGroups.entries());
    const totalGroups = groupArray.length;

    logInfo("Transaction groups created", { total_groups: totalGroups });

    // PHASE 3: Batch payment method lookup
    onProgress?.({
      current: 20,
      total: 100,
      phase: "lookup",
      message: "Resolving payment methods...",
    });

    // Extract unique payment method names dari groups
    const paymentMethodNames = [
      ...new Set(
        groupArray.flatMap(([, groupLines]) => {
          const rawPm = groupLines[0]?.payment_method || "unknown";
          const splits = parseSplitPayment(rawPm);
          if (splits.length > 1) {
            return splits.map((s) => s.name);
          }
          return [rawPm];
        }),
      ),
    ];

    const pmLookupResult = await resolvePaymentMethodsBatch(
      paymentMethodNames,
      companyId,
    );

    const foundCount = [...pmLookupResult.values()].filter(
      (r) => r.id > 0,
    ).length;
    const notFoundCount = [...pmLookupResult.values()].filter(
      (r) => r.id === 0,
    ).length;

    logInfo("Payment methods resolved", {
      total: paymentMethodNames.length,
      found: foundCount,
      not_found: notFoundCount,
    });

    if (notFoundCount > 0) {
      logWarn("Some payment methods not found - will be marked as FAILED", {
        not_found: [...pmLookupResult.entries()]
          .filter(([_, v]) => v.id === 0)
          .map(([k, v]) => ({ name: k, original_name: v.name })),
      });
    }

    // PHASE 4: Check existing sources (batch)
    onProgress?.({
      current: 30,
      total: 100,
      phase: "checking",
      message: "Checking duplicates...",
    });

    // Build list of source_refs untuk check existence
    const sourceRefsToCheck = groupArray.map(([key]) => {
      return {
        source_type: "POS" as AggregatedTransactionSourceType,
        source_id: posImportId,
        source_ref: key.replace(/\|/g, "-"),
      };
    });
    // Batch check existence - split into chunks untuk avoid large queries
    const existingSources = new Set<string>();
    const allSourceRefs = sourceRefsToCheck.map((s) => s.source_ref);

    for (let i = 0; i < allSourceRefs.length; i += CHECK_BATCH_SIZE) {
      const batchRefs = allSourceRefs.slice(i, i + CHECK_BATCH_SIZE);

      const { rows: data } = await pool.query(
        `SELECT source_ref FROM aggregated_transactions
         WHERE source_type = 'POS' AND source_id = $1 AND source_ref = ANY($2::text[])`,
        [posImportId, batchRefs]
      );

      for (const item of data) {
        existingSources.add(item.source_ref);
      }

      // Progress update
      const progress =
        30 + Math.min(20, Math.floor((i / allSourceRefs.length) * 20));
      onProgress?.({
        current: progress,
        total: 100,
        phase: "checking",
        message: `Checking duplicates ${Math.min(i + batchRefs.length, totalGroups)}/${totalGroups}...`,
      });
    }

    logInfo("Duplicate check complete", {
      existing_count: existingSources.size,
    });

    // PHASE 5: Prepare insert data - SEPARATE valid and invalid
    onProgress?.({
      current: 50,
      total: 100,
      phase: "preparing",
      message: "Preparing transaction data...",
    });

    const insertDataArray: Array<{
      data: Omit<
        AggregatedTransaction,
        "id" | "created_at" | "updated_at" | "version"
      >;
      sourceRef: string;
    }> = [];
    const skippedGroups: string[] = [];
    const failedRecords: FailedTransactionRecord[] = [];

    for (let i = 0; i < groupArray.length; i++) {
      const [groupKey, groupLines] = groupArray[i];
      const sourceRef = groupKey.replace(/\|/g, "-");

      // Skip jika sudah ada
      if (existingSources.has(sourceRef)) {
        skippedGroups.push(sourceRef);
        continue;
      }

      try {
        const firstLine = groupLines[0];
        const rawPm = firstLine.payment_method || "unknown";
        const splitParts = parseSplitPayment(rawPm);
        const isTrueSplit = splitParts.length > 1;

        // Calculate aggregated amounts - OPTIMIZED: Single loop for all components
        let grossAmount = 0;
        let discountAmount = 0;
        let billDiscountAmount = 0;
        let taxAmount = 0;
        let serviceChargeAmount = 0;

        for (const line of groupLines) {
          grossAmount += Number(line.subtotal || 0);
          discountAmount += Number(line.discount || 0);
          billDiscountAmount += Number(line.bill_discount || 0);
          taxAmount += Number(line.tax || 0);
          serviceChargeAmount += Number(line.service_charge || 0);
        }

        // Bill after discount = gross + tax + service_charge - (discount + bill_discount)
        const billAfterDiscount =
          grossAmount +
          taxAmount +
          serviceChargeAmount -
          (discountAmount + billDiscountAmount);

        // 🔥 Calculate transaction count dari unique bill_number dalam grup
        const uniqueBillNumbers = new Set(
          groupLines.map((line: any) => line.bill_number),
        );
        const transactionCount = uniqueBillNumbers.size;

        // Get payment method ID dari lookup result ONLY for non-split payments
        // We will validate split payment methods later inside the split logic block
        let pmResult: any = {
          id: 0,
          fee_percentage: 0,
          fee_fixed_amount: 0,
          fee_fixed_per_transaction: false,
        };

        if (!isTrueSplit) {
          const pmKey = normalizePaymentMethodName(rawPm);
          const lookup = pmLookupResult.get(pmKey);

          if (!lookup || lookup.id === 0) {
            // Payment method NOT FOUND - mark as FAILED
            const errorMsg = `Payment method "${firstLine.payment_method}" tidak ditemukan di database`;

            failedRecords.push({
              data: {
                branch_name: firstLine.branch?.trim() || null,
                source_type: "POS" as AggregatedTransactionSourceType,
                source_id: posImportId,
                source_ref: sourceRef,
                transaction_date:
                  firstLine.sales_date ||
                  new Date().toISOString().split("T")[0],
                payment_method_id: null, // Temporary, will be fixed during retry
                gross_amount: grossAmount,
                discount_amount: discountAmount + billDiscountAmount,
                tax_amount: taxAmount,
                service_charge_amount: serviceChargeAmount,
                bill_after_discount: billAfterDiscount,
                percentage_fee_amount: 0,
                fixed_fee_amount: 0,
                total_fee_amount: 0,
                nett_amount: billAfterDiscount,
                rounding_amount: 0, delivery_cost: 0, order_fee: 0,
                voucher_discount_amount: 0, promotion_discount_amount: 0, menu_discount_amount: 0,
                voucher_payment_amount: 0, other_vat_amount: 0, pax_total: 0,
                currency: "IDR",
                journal_id: null,
                is_reconciled: false,
                status: "FAILED" as AggregatedTransactionStatus,
                deleted_at: null,
                deleted_by: null,
                failed_at: new Date().toISOString(),
                failed_reason: errorMsg,
              },
              error: errorMsg,
            });
            continue;
          }
          pmResult = lookup;
        }

        // 🔥 CALCULATE FEE from payment method configuration
        // percentage_fee = bill_after_discount × fee_percentage / 100
        const percentageFeeAmount =
          pmResult.fee_percentage > 0
            ? billAfterDiscount * (pmResult.fee_percentage / 100)
            : 0;

        // fixed_fee = fee_fixed_amount × transaction_count (jika fee_fixed_per_transaction = true)
        //            fee_fixed_amount (jika fee_fixed_per_transaction = false)
        const fixedFeeAmount = pmResult.fee_fixed_per_transaction
          ? transactionCount * (pmResult.fee_fixed_amount || 0)
          : pmResult.fee_fixed_amount || 0;

        // total_fee = percentage + fixed
        const totalFeeAmount = percentageFeeAmount + fixedFeeAmount;

        // Nett amount = bill after discount - total fee
        const nettAmount = billAfterDiscount - totalFeeAmount;

        if (i % 500 === 0 && !isTrueSplit) {
          logInfo("Fee calculated for transaction - sample", {
            source_ref: sourceRef,
            gross_amount: grossAmount,
            discount_amount: discountAmount + billDiscountAmount,
            tax_amount: taxAmount,
            bill_after_discount: billAfterDiscount,
            fee_percentage: pmResult.fee_percentage,
            percentage_fee: percentageFeeAmount,
            fixed_fee: fixedFeeAmount,
            total_fee: totalFeeAmount,
            nett_amount: nettAmount,
          });
        }

        // Base insert data (used for single payment or split fallback)
        const baseInsertData = {
          branch_name: firstLine.branch?.trim() || null,
          source_type: "POS" as AggregatedTransactionSourceType,
          source_id: posImportId,
          source_ref: sourceRef,
          transaction_date:
            firstLine.sales_date || new Date().toISOString().split("T")[0],
          payment_method_id: pmResult.id,
          gross_amount: grossAmount,
          discount_amount: discountAmount + billDiscountAmount,
          tax_amount: taxAmount,
          service_charge_amount: serviceChargeAmount,
          bill_after_discount: billAfterDiscount,
          percentage_fee_amount: percentageFeeAmount,
          fixed_fee_amount: fixedFeeAmount,
          total_fee_amount: totalFeeAmount,
          nett_amount: nettAmount,
          rounding_amount: 0, delivery_cost: 0, order_fee: 0,
          voucher_discount_amount: 0, promotion_discount_amount: 0, menu_discount_amount: 0,
          voucher_payment_amount: 0, other_vat_amount: 0, pax_total: 0,
          currency: "IDR",
          journal_id: null,
          is_reconciled: false,
          status: "READY" as AggregatedTransactionStatus,
          deleted_at: null,
          deleted_by: null,
          failed_at: null,
          failed_reason: null,
        };

        // ─────────────────────────────────────────────────────────────────
        // POST-AGGREGATION SPLIT PAYMENT HANDLING
        //
        // Resolve split only AFTER we have the true billAfterDiscount.
        // This prevents the mismatch where per-line ratios create systematic
        // reconciliation gaps (e.g. 200k/500k × 60k = 24k instead of needed
        // proportional allocation of the 464k aggregate).
        // ─────────────────────────────────────────────────────────────────
        const totalSplitPaymentAmount = splitParts.reduce(
          (sum, s) => sum + s.amount,
          0,
        );

        if (splitParts.length > 1 && totalSplitPaymentAmount > 0) {
          // ✅ FIX: Scale split amounts by number of unique bills in this group
          // Each bill has the same split string (e.g. "Deposit (100k), Cash (100k)")
          // so the actual total payment = amount × bill count
          const scaledSplitParts = splitParts.map(s => ({
            ...s,
            amount: s.amount * transactionCount  // transactionCount = uniqueBillNumbers.size (sudah dihitung di atas)
          }))
          const scaledTotalSplitAmount = scaledSplitParts.reduce((sum, s) => sum + s.amount, 0)
          if (Math.abs(totalSplitPaymentAmount - billAfterDiscount) > 10000) {
            logInfo(
              "Split payment amount differs from aggregated sales. FCFS allocation logic applied.",
              {
                source_ref: sourceRef,
                total_split_payment_amount: totalSplitPaymentAmount,
                bill_after_discount: billAfterDiscount,
                difference: Math.abs(
                  totalSplitPaymentAmount - billAfterDiscount,
                ),
                raw_payment_method: rawPm,
              },
            );
          }

          // ✅ Apply FCFS (First-Come-First-Served) Split to Aggregated Sales
          let remaining = billAfterDiscount;

          for (let si = 0; si < scaledSplitParts.length; si++) { 
            const split = scaledSplitParts[si];                  
                    const splitPmKey = normalizePaymentMethodName(split.name);
            const splitPmResult = pmLookupResult.get(splitPmKey);

            const isLastSplit = si === splitParts.length - 1;

            // FCFS: take up to split.amount, or ALL remaining if it's the last payment
            const allocated = isLastSplit
              ? remaining
              : Math.min(split.amount, remaining);

            remaining -= allocated;

            // Ratio derived from the allocated FCFS result vs actual bill
            // This ensures derived fields are perfectly consistent with the FCFS values
            const actualRatio =
              billAfterDiscount > 0 ? allocated / billAfterDiscount : 0;

            // Recalculate fee for this split's allocated amount
            const splitPmFeePerc = splitPmResult?.fee_percentage || 0;
            const splitPmFeeFixed = splitPmResult?.fee_fixed_amount || 0;
            const splitPmFeePerTxn =
              splitPmResult?.fee_fixed_per_transaction || false;
            const splitPctFee =
              splitPmFeePerc > 0 ? allocated * (splitPmFeePerc / 100) : 0;
            const splitFixedFee = splitPmFeePerTxn
              ? transactionCount * splitPmFeeFixed
              : splitPmFeeFixed;
            const splitTotalFee = splitPctFee + splitFixedFee;

            insertDataArray.push({
              data: {
                ...baseInsertData,
                source_ref: `${sourceRef}-split${si + 1}`,
                payment_method_id: splitPmResult?.id || null,
                bill_after_discount: allocated,
                percentage_fee_amount: splitPctFee,
                fixed_fee_amount: splitFixedFee,
                total_fee_amount: splitTotalFee,
                nett_amount: allocated - splitTotalFee,
                // For split rows: distribute gross/tax/service_charge using actual FCFS ratio
                gross_amount: Math.round(grossAmount * actualRatio),
                tax_amount: Math.round(taxAmount * actualRatio),
                service_charge_amount: Math.round(
                  serviceChargeAmount * actualRatio,
                ),
                discount_amount: Math.round(
                  (discountAmount + billDiscountAmount) * actualRatio,
                ),
                status:
                  splitPmResult && splitPmResult.id > 0
                    ? ("READY" as AggregatedTransactionStatus)
                    : ("FAILED" as AggregatedTransactionStatus),
                failed_reason:
                  splitPmResult && splitPmResult.id > 0
                    ? null
                    : `Split payment method "${split.name}" tidak ditemukan`,
              },
              sourceRef: `${sourceRef}-split${si + 1}`,
            });
          }

          logInfo("Split payment allocated post-aggregation (FCFS)", {
            source_ref: sourceRef,
            bill_after_discount: billAfterDiscount,
            bill_count: transactionCount,                    // ← tambah ini
            total_split_amount: scaledTotalSplitAmount,      // ← ganti dari totalSplitPaymentAmount
            splits: scaledSplitParts.map((s) => ({           // ← ganti dari splitParts
              name: s.name,
              amount: s.amount,
            })),
          });
        } else {
          // Single payment (or no valid split) → use as-is
          insertDataArray.push({ data: baseInsertData, sourceRef });
        }
      } catch (error) {
        logError("Failed to prepare transaction", {
          source_ref: sourceRef,
          error,
        });
        failedRecords.push({
          data: {
            branch_name: null,
            source_type: "POS",
            source_id: posImportId,
            source_ref: sourceRef,
            transaction_date: new Date().toISOString().split("T")[0],
            payment_method_id: 20,
            gross_amount: 0,
            discount_amount: 0,
            tax_amount: 0,
            service_charge_amount: 0,
            bill_after_discount: 0,
            percentage_fee_amount: 0,
            fixed_fee_amount: 0,
            total_fee_amount: 0,
            nett_amount: 0,
            rounding_amount: 0, delivery_cost: 0, order_fee: 0,
            voucher_discount_amount: 0, promotion_discount_amount: 0, menu_discount_amount: 0,
            voucher_payment_amount: 0, other_vat_amount: 0, pax_total: 0,
            currency: "IDR",
            journal_id: null,
            is_reconciled: false,
            status: "FAILED",
            deleted_at: null,
            deleted_by: null,
            failed_at: new Date().toISOString(),
            failed_reason:
              error instanceof Error ? error.message : "Unknown error",
          },
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }

      // Progress update every 500 groups
      if (i % 500 === 0) {
        const progress =
          50 + Math.min(20, Math.floor((i / groupArray.length) * 20));
        onProgress?.({
          current: progress,
          total: 100,
          phase: "preparing",
          message: `Preparing ${i}/${totalGroups}...`,
        });
      }
    }

    // PHASE 6: Bulk insert dengan chunked processing
    onProgress?.({
      current: 70,
      total: 100,
      phase: "inserting",
      message: "Inserting transactions...",
    });

    let createdCount = 0;
    const insertErrors: Array<{ source_ref: string; error: string }> = [];

    // Split insert data into batches
    for (let i = 0; i < insertDataArray.length; i += BATCH_SIZE) {
      const batch = insertDataArray.slice(i, i + BATCH_SIZE);
      const batchData = batch.map((b) => b.data);

      try {
        const result = await posAggregatesRepository.createBatchBulk(
          batchData,
          (current, total) => {
            // Progress dalam batch
          },
        );

        createdCount += result.success.length;
        insertErrors.push(
          ...result.failed.map((f) => ({
            source_ref: f.source_ref,
            error: f.error,
          })),
        );
      } catch (error) {
        logError("Batch insert failed", { batch_start: i, error });
        // Fallback: try one by one
        for (const item of batch) {
          try {
            await posAggregatesRepository.create(item.data);
            createdCount++;
          } catch (err) {
            insertErrors.push({
              source_ref: item.sourceRef,
              error: err instanceof Error ? err.message : "Unknown error",
            });
          }
        }
      }

      // Progress update
      const progress =
        70 + Math.min(25, Math.floor((i / insertDataArray.length) * 25));
      onProgress?.({
        current: progress,
        total: 100,
        phase: "inserting",
        message: `Inserting ${Math.min(i + BATCH_SIZE, insertDataArray.length)}/${insertDataArray.length}...`,
      });
    }

    // PHASE 6b: Auto-supersede manual entries where POS_SYNC already exists
    if (createdCount > 0) {
      try {
        logInfo("Phase 6b: starting supersede check", { createdCount, posImportId });

        // Lookup by source_id (posImportId) — reliable regardless of source_ref casing
        const { rows: found } = await pool.query(
          `SELECT id FROM aggregated_transactions
           WHERE source_type = 'POS' AND source_id = $1
             AND deleted_at IS NULL AND superseded_by IS NULL`,
          [posImportId]
        );

        const manualIds = found.map((r: { id: string }) => r.id);
        logInfo("Phase 6b: manual IDs collected", { manualIdsCount: manualIds.length });

        if (manualIds.length > 0) {
          const supersededCount = await posSyncAggregatesRepository.supersedeManualIfPosSyncExists(manualIds);
          logInfo("Manual CSV entries auto-superseded by POS_SYNC", {
            superseded: supersededCount,
            total_manual: manualIds.length,
            total_created: createdCount,
          });
        } else {
          logInfo("Phase 6b: no manual IDs found to supersede");
        }
      } catch (supErr: any) {
        logWarn("Auto-supersede after CSV import failed (non-blocking)", { error: supErr.message, stack: supErr.stack });
      }
    }

    // PHASE 6c: Store failed transactions
    let failedStoredCount = 0;
    if (failedRecords.length > 0) {
      onProgress?.({
        current: 85,
        total: 100,
        phase: "storing_failed",
        message: "Storing failed transactions...",
      });
      failedStoredCount = await storeFailedTransactions(failedRecords);
    }

    // Combine all errors
    const allErrors = [
      ...insertErrors,
      ...failedRecords.map((f) => ({
        source_ref: f.data.source_ref,
        error: f.error,
      })),
    ];

    // PHASE 7: Finalization
    onProgress?.({
      current: 95,
      total: 100,
      phase: "finalizing",
      message: "Updating import status...",
    });

    // Update pos_import status ke MAPPED jika ada yang berhasil atau sudah ada sebelumnya
    if (createdCount > 0 || skippedGroups.length > 0) {
      try {
        logInfo("Updating pos_import status to MAPPED", {
          pos_import_id: posImportId,
          created: createdCount,
          skipped: skippedGroups.length,
        });

        await pool.query(
          `UPDATE pos_imports SET status = 'MAPPED', updated_at = NOW() WHERE id = $1`,
          [posImportId]
        );
      } catch (statusError) {
        logError("Failed to update pos_import status to MAPPED", {
          pos_import_id: posImportId,
          error: statusError,
        });
      }
    }
    // Jika tidak ada yang berhasil/skip, dan ada yang gagal, set ke FAILED
    else if (failedStoredCount > 0) {
      try {
        logInfo("Updating pos_import status to FAILED", {
          pos_import_id: posImportId,
          failed: failedStoredCount,
        });

        await pool.query(
          `UPDATE pos_imports SET status = 'FAILED', error_message = $1, updated_at = NOW() WHERE id = $2`,
          [`${failedStoredCount} transactions failed - check /pos-aggregates/failed-transactions`, posImportId]
        );
      } catch (statusError) {
        logError("Failed to update pos_import status to FAILED", {
          pos_import_id: posImportId,
          error: statusError,
        });
      }
    }
    // Kasus edge: lines ada tapi tidak ada group yang bisa diproses (sangat jarang)
    else {
      logInfo(
        "No transactions were created, skipped, or failed. Status remains unchanged.",
        {
          pos_import_id: posImportId,
          total_groups: totalGroups,
        },
      );
    }

    const duration = Date.now() - startTime;

    onProgress?.({
      current: 100,
      total: 100,
      phase: "complete",
      message: "Done!",
    });

    logInfo("Optimized aggregated transaction generation complete", {
      pos_import_id: posImportId,
      total_groups: totalGroups,
      created: createdCount,
      skipped: skippedGroups.length,
      failed: failedStoredCount,
      total_failed: allErrors.length,
      duration_ms: duration,
    });

    return {
      created: createdCount,
      skipped: skippedGroups.length,
      failed: failedStoredCount,
      errors: allErrors,
      total_groups: totalGroups,
    };
  } catch (error) {
    logError("generateAggregatedTransactionsOptimized failed", {
      pos_import_id: posImportId,
      error,
    });
    throw error;
  }
}

/**
 * Simple version tanpa progress callback
 */
export async function generateAggregatedTransactions(
  posImportId: string,
  branchName: string | undefined,
  companyId: string,
): Promise<GenerateAggregatedResult> {
  return generateAggregatedTransactionsOptimized(
    posImportId,
    branchName,
    companyId,
  );
}
