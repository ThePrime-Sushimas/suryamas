import { pool } from "@/config/db";
import { toSaleRow, toSaleItemRow, toSalePaymentRow } from "./pos-sync.mapper";
import { SaleInput, SaleItemInput, SalePaymentInput, MasterBranchInput, MasterPaymentMethodInput, MasterMenuCategoryInput, MasterMenuGroupInput, MasterMenuInput, StagingTable, StagingListParams, StagingUpdatePayload } from "./pos-sync.types";
import { logWarn } from "@/config/logger";

// ── Allowed staging tables (prevent SQL injection) ──
const VALID_STAGING_TABLES: Record<StagingTable, string> = {
  branches: 'pos_staging_branches',
  payment_methods: 'pos_staging_payment_methods',
  menu_categories: 'pos_staging_menu_categories',
  menu_groups: 'pos_staging_menu_groups',
  menus: 'pos_staging_menus',
};

function getStagingTableName(table: StagingTable): string {
  const name = VALID_STAGING_TABLES[table];
  if (!name) throw new Error(`Invalid staging table: ${table}`);
  return name;
}

// ── Helper: bulk upsert via unnest ──
async function bulkUpsert<T extends Record<string, unknown>>(
  tableName: string,
  rows: T[],
  columns: string[],
  conflictColumn: string
): Promise<void> {
  if (rows.length === 0) return;

  const BATCH_SIZE = 500;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const values: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    for (const row of batch) {
      const placeholders: string[] = [];
      for (const col of columns) {
        placeholders.push(`$${paramIdx++}`);
        params.push(row[col] ?? null);
      }
      values.push(`(${placeholders.join(', ')})`);
    }

    const setClauses = columns
      .filter(c => c !== conflictColumn)
      .map(c => `${c} = EXCLUDED.${c}`)
      .join(', ');

    await pool.query(
      `INSERT INTO ${tableName} (${columns.join(', ')})
       VALUES ${values.join(', ')}
       ON CONFLICT (${conflictColumn}) DO UPDATE SET ${setClauses}`,
      params
    );
  }
}

// ── Sales columns ──
const SALE_COLUMNS = [
  'sales_num', 'bill_num', 'book_num', 'queue_num', 'sales_date', 'sales_date_in',
  'order_time_out', 'sales_date_out', 'branch_id', 'member_id', 'employee_code',
  'employee_name', 'employee_type', 'member_code', 'table_id', 'visit_purpose_id',
  'visitor_type_id', 'pax_total', 'subtotal', 'discount_total', 'menu_discount_total',
  'promotion_discount', 'voucher_discount_total', 'other_tax_total', 'vat_total',
  'other_vat_total', 'delivery_cost', 'order_fee', 'grand_total', 'voucher_total',
  'rounding_total', 'payment_total', 'billing_print_count', 'payment_print_count',
  'additional_info', 'remarks', 'promotion_id', 'promotion_voucher_code',
  'flag_inclusive', 'lock_table', 'transaction_mode_id', 'delivery_time',
  'external_membership_type_id', 'flag_external_api', 'flag_external_member_id',
  'flag_external_member_phone', 'flag_external_card_id', 'external_member_name',
  'external_trans_id', 'external_cancel_trans_id', 'terminal_id', 'print_eso_fs_qr',
  'status_id', 'created_by', 'edited_by', 'edited_date', 'sync_date',
] as const;

const SALE_ITEM_COLUMNS = [
  'external_id', 'local_id', 'sales_num', 'batch_id', 'menu_ref_id', 'menu_group_id',
  'menu_id', 'custom_menu_name', 'qty', 'original_price', 'price', 'inclusive_price',
  'discount', 'discount_value', 'inclusive_discount_value', 'other_tax', 'other_tax_value',
  'vat', 'vat_value', 'other_vat', 'other_vat_value', 'other_tax_on_vat', 'total',
  'notes', 'status_id', 'promotion_detail_id', 'menu_promotion_id',
  'promotion_voucher_code', 'cancel_notes', 'sales_type', 'flag_pending',
  'created_by', 'created_date', 'edited_by', 'edited_date', 'sync_date',
] as const;

const SALE_PAYMENT_COLUMNS = [
  'external_id', 'sales_num', 'local_id', 'payment_method_id', 'voucher_code',
  'voucher_category_id', 'notes', 'card_number', 'bank_name', 'account_name',
  'self_order_id', 'verification_code', 'edc_terminal_id', 'trace_number',
  'canceled_verification_code', 'flag_external_voucher_api', 'external_voucher_code',
  'external_transaction_id', 'external_batch_number', 'external_canceled_transaction_id',
  'external_canceled_batch_number', 'coa_no', 'payment_amount', 'full_payment_amount',
  'sync_date',
] as const;

export const salesRepository = {
  async upsertSales(sales: SaleInput[]): Promise<void> {
    const payload = sales.map(toSaleRow);
    await bulkUpsert('tr_saleshead', payload, [...SALE_COLUMNS], 'sales_num');
  },

  async upsertItems(items: SaleItemInput[]): Promise<void> {
    const payload = items.map(toSaleItemRow);
    await bulkUpsert('tr_salesmenu', payload, [...SALE_ITEM_COLUMNS], 'external_id');
  },

  async upsertPayments(payments: SalePaymentInput[]): Promise<void> {
    const payload = payments.map(toSalePaymentRow);

    // Delete old payment records before upsert
    const salesNums = [...new Set(payload.map((p) => p.sales_num))];
    if (salesNums.length > 0) {
      const placeholders = salesNums.map((_, i) => `$${i + 1}`).join(', ');
      const { rowCount } = await pool.query(
        `DELETE FROM tr_salespayment WHERE sales_num IN (${placeholders})`,
        salesNums
      );
      logWarn("PosSyncRepository: deleted old payments", { deleted: rowCount ?? 0, salesNums: salesNums.length });
    }

    await bulkUpsert('tr_salespayment', payload, [...SALE_PAYMENT_COLUMNS], 'external_id');
  },
};

// ── Master staging columns ──
const STAGING_BRANCH_COLS = ['pos_id', 'branch_name', 'branch_code', 'address', 'phone', 'flag_active', 'pos_synced_at'] as const;
const STAGING_PM_COLS = ['pos_id', 'pos_branch_id', 'name', 'code', 'coa_no', 'flag_active', 'pos_synced_at'] as const;
const STAGING_MENU_CAT_COLS = ['pos_id', 'category_name', 'sales_coa_no', 'flag_active', 'pos_synced_at'] as const;
const STAGING_MENU_GROUP_COLS = ['pos_id', 'pos_category_id', 'group_name', 'group_code', 'flag_active', 'pos_synced_at'] as const;
const STAGING_MENU_COLS = ['pos_id', 'pos_group_id', 'menu_name', 'menu_short_name', 'menu_code', 'price', 'estimated_cost', 'flag_tax', 'flag_other_tax', 'sales_coa_no', 'cogs_coa_no', 'flag_active', 'pos_synced_at'] as const;

export const masterRepository = {
  async upsertBranches(branches: MasterBranchInput[]): Promise<void> {
    await bulkUpsert('pos_staging_branches', branches as unknown as Record<string, unknown>[], [...STAGING_BRANCH_COLS], 'pos_id');
  },
  async upsertPaymentMethods(payments: MasterPaymentMethodInput[]): Promise<void> {
    await bulkUpsert('pos_staging_payment_methods', payments as unknown as Record<string, unknown>[], [...STAGING_PM_COLS], 'pos_id');
  },
  async upsertMenuCategories(categories: MasterMenuCategoryInput[]): Promise<void> {
    await bulkUpsert('pos_staging_menu_categories', categories as unknown as Record<string, unknown>[], [...STAGING_MENU_CAT_COLS], 'pos_id');
  },
  async upsertMenuGroups(groups: MasterMenuGroupInput[]): Promise<void> {
    await bulkUpsert('pos_staging_menu_groups', groups as unknown as Record<string, unknown>[], [...STAGING_MENU_GROUP_COLS], 'pos_id');
  },
  async upsertMenus(menus: MasterMenuInput[]): Promise<void> {
    await bulkUpsert('pos_staging_menus', menus as unknown as Record<string, unknown>[], [...STAGING_MENU_COLS], 'pos_id');
  },
};

export const stagingRepository = {
  async list(table: StagingTable, params: StagingListParams) {
    const tableName = getStagingTableName(table);
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (params.status) {
      conditions.push(`status = $${paramIdx++}`);
      values.push(params.status);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const offset = (page - 1) * limit;

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT * FROM ${tableName} ${where} ORDER BY created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        [...values, limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total FROM ${tableName} ${where}`,
        values
      ),
    ]);

    return {
      data: dataRes.rows,
      total: countRes.rows[0]?.total ?? 0,
      page,
      limit,
    };
  },

  async update(table: StagingTable, posId: number, payload: StagingUpdatePayload) {
    const tableName = getStagingTableName(table);
    const sets: string[] = ['status = $1'];
    const values: unknown[] = [payload.status];
    let paramIdx = 2;

    if (table === 'menus' && payload.mapped_product_id !== undefined) {
      sets.push(`mapped_product_id = $${paramIdx++}`);
      values.push(payload.mapped_product_id);
    } else if ((table === 'branches' || table === 'payment_methods') && payload.mapped_id !== undefined) {
      sets.push(`mapped_id = $${paramIdx++}`);
      values.push(payload.mapped_id);
    }

    values.push(posId);
    const { rows } = await pool.query(
      `UPDATE ${tableName} SET ${sets.join(', ')} WHERE pos_id = $${paramIdx} RETURNING *`,
      values
    );
    return rows[0] ?? null;
  },
};

export const aggregateRepository = {
  async getSalesNumsByDate(salesDate: string): Promise<string[]> {
    const { rows } = await pool.query(
      `SELECT sales_num FROM tr_saleshead WHERE sales_date = $1`,
      [salesDate]
    );
    if (rows.length === 0) throw new Error(`No sales found for date ${salesDate}`);
    return rows.map((r) => r.sales_num);
  },
};
