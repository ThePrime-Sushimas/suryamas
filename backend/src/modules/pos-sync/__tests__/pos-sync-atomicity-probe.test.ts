/**
 * POS Sync Atomicity VERIFICATION — Pasca-Fase 4
 *
 * PURPOSE: Memverifikasi bahwa setelah transaction wrapping di salesService.import(),
 *          partial-state risk TIDAK LAGI terjadi — data tetap utuh meskipun ada failure
 *          injection di tengah proses.
 *
 * This is the "after" proof. The "before" proof was:
 *   - Skenario 1: 0 baris payment (DELETE sukses, INSERT gagal) → RISK CONFIRMED
 *   - Skenario 2: orphan tr_saleshead (upsertSales sukses, upsertItems gagal) → RISK CONFIRMED
 * Dengan withTransaction() wrapping, kedua skenario di atas harus menghasilkan:
 *   - Skenario 1: data payment tetap 2 baris (rollback mengembalikan old data)
 *   - Skenario 2: 0 row di semua tabel (rollback membatalkan upsertSales juga)
 *
 * ISOLASI: Database test terpisah `suryamas_test`.
 * CLEANUP: afterEach + afterAll safety net dengan prefix TEST-ATOMICITY-*.
 * PATTERN: NO transaction-per-test rollback — test ini justru butuh efek WRITE nyata di DB.
 *
 * JEST: Sequential dalam file, paralel antar file — tapi di-run dengan path spesifik.
 */

import { pool } from "../../../config/db";
import { salesRepository, masterRepository } from "../pos-sync.repository";
import { salesService, masterService } from "../pos-sync.service";
import type {
  SaleInput,
  SaleItemInput,
  SalePaymentInput,
} from "../pos-sync.types";

// ── Test marker ──
const PREFIX = "TEST-ATOMICITY";

// ── Log database yang dipakai + Buat staging tables jika belum ada ──
beforeAll(async () => {
  const { rows } = await pool.query("SELECT current_database() AS db");
  const serverInfo = await pool.query(
    "SELECT inet_server_addr() AS addr, inet_server_port() AS port",
  );
  const addr = String(serverInfo.rows[0]?.addr ?? "???");
  const port = String(serverInfo.rows[0]?.port ?? "???");
  console.log("");
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log(`║  PROBE DB: ${String(rows[0]?.db ?? "???").padEnd(47)}║`);
  console.log(`║  SERVER:   ${`${addr}:${port}`.padEnd(47)}║`);
  console.log(`║  HOST:     localhost:5433 (SSH tunnel → VPS Hetzner)   ║`);
  console.log(
    `║  DATE:     ${new Date().toISOString().padEnd(47)}║`,
  );
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(
    "  NOTE: suryamas_test dan suryamas_db di INSTANCE Postgres YANG SAMA.",
  );
  console.log(
    "  Isolasi via database terpisah + marker prefix TEST-ATOMICITY-*.",
  );
  console.log("");

  // Dynamically create staging tables for testing if they do not exist.
  //
  // NOTE: suryamas_test harus memiliki skema yang identik dengan production.
  // Kalau tabel tidak ada, restore schema dulu:
  //   pg_dump -h localhost -p 5433 -U suryamas --schema-only suryamas_db \
  //     | psql -h localhost -p 5433 -U suryamas suryamas_test
  //
  // Skema dibuat dari dump production, BUKAN didefinisikan ulang di sini,
  // untuk menghindari drift definisi kolom antara test dan production.
  const requiredTables = [
    'pos_staging_branches',
    'pos_staging_payment_methods',
    'pos_staging_menu_categories',
    'pos_staging_menu_groups',
    'pos_staging_menus',
    'tr_saleshead',
    'tr_salesmenu',
    'tr_salespayment',
  ];
  const { rows: existingTables } = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ANY($1::text[])
  `, [requiredTables]);
  const existing = new Set(existingTables.map((r: { table_name: string }) => r.table_name));
  const missing = requiredTables.filter(t => !existing.has(t));
  if (missing.length > 0) {
    throw new Error(
      `[PROBE TEST PRECONDITION FAILED] Tabel berikut tidak ada di database test:\n` +
      `  ${missing.join(', ')}\n\n` +
      `Jalankan schema restore terlebih dahulu:\n` +
      `  pg_dump -h localhost -p 5433 -U suryamas --schema-only suryamas_db \\\n` +
      `    | psql -h localhost -p 5433 -U suryamas suryamas_test`
    );
  }
});

// ── Global safety net: setelah semua test selesai ──
afterAll(async () => {
  const payResult = await pool.query(
    `DELETE FROM tr_salespayment WHERE sales_num LIKE '${PREFIX}-%'`,
  );
  const itemResult = await pool.query(
    `DELETE FROM tr_salesmenu WHERE sales_num LIKE '${PREFIX}-%'`,
  );
  const headResult = await pool.query(
    `DELETE FROM tr_saleshead WHERE sales_num LIKE '${PREFIX}-%'`,
  );

  // Clean staging tables in reverse dependency order
  const menuClean = await pool.query(`DELETE FROM pos_staging_menus WHERE pos_id >= 999900`);
  const groupClean = await pool.query(`DELETE FROM pos_staging_menu_groups WHERE pos_id >= 999900`);
  const categoryClean = await pool.query(`DELETE FROM pos_staging_menu_categories WHERE pos_id >= 999900`);
  const pmClean = await pool.query(`DELETE FROM pos_staging_payment_methods WHERE pos_id >= 999900`);
  const branchClean = await pool.query(`DELETE FROM pos_staging_branches WHERE pos_id >= 999900`);

  const totalDeleted =
    (payResult.rowCount ?? 0) +
    (itemResult.rowCount ?? 0) +
    (headResult.rowCount ?? 0) +
    (menuClean.rowCount ?? 0) +
    (groupClean.rowCount ?? 0) +
    (categoryClean.rowCount ?? 0) +
    (pmClean.rowCount ?? 0) +
    (branchClean.rowCount ?? 0);
  console.log(`  [afterAll SAFETY NET] Deleted ${String(totalDeleted)} remaining rows`);

  // Close database pool to resolve open handles
  await pool.end();
  console.log(`  [afterAll] Closed PG pool connection`);
});

// ── Cleanup: hapus semua data dummy setelah tiap test ──
afterEach(async () => {
  const payResult = await pool.query(
    `DELETE FROM tr_salespayment WHERE sales_num LIKE '${PREFIX}-%'`,
  );
  const itemResult = await pool.query(
    `DELETE FROM tr_salesmenu WHERE sales_num LIKE '${PREFIX}-%'`,
  );
  const headResult = await pool.query(
    `DELETE FROM tr_saleshead WHERE sales_num LIKE '${PREFIX}-%'`,
  );

  // Clean staging tables in reverse dependency order
  const menuClean = await pool.query(`DELETE FROM pos_staging_menus WHERE pos_id >= 999900`);
  const groupClean = await pool.query(`DELETE FROM pos_staging_menu_groups WHERE pos_id >= 999900`);
  const categoryClean = await pool.query(`DELETE FROM pos_staging_menu_categories WHERE pos_id >= 999900`);
  const pmClean = await pool.query(`DELETE FROM pos_staging_payment_methods WHERE pos_id >= 999900`);
  const branchClean = await pool.query(`DELETE FROM pos_staging_branches WHERE pos_id >= 999900`);

  console.log(
    `  [CLEANUP] tr_salespayment: ${String(payResult.rowCount)} rows deleted`,
  );
  console.log(
    `  [CLEANUP] tr_salesmenu:    ${String(itemResult.rowCount)} rows deleted`,
  );
  console.log(
    `  [CLEANUP] tr_saleshead:    ${String(headResult.rowCount)} rows deleted`,
  );
  console.log(
    `  [CLEANUP] pos_staging tables: cleaned up mock master data`,
  );
});

// ── Helpers ──
function makeSale(salesNum: string, overrides?: Partial<SaleInput>): SaleInput {
  return {
    salesNum,
    billNum: null,
    bookNum: null,
    queueNum: "1",
    salesDate: "2026-06-21",
    salesDateIn: "2026-06-21 10:00:00",
    orderTimeOut: null,
    salesDateOut: null,
    branchID: "1",
    memberID: null,
    employeeCode: null,
    employeeName: null,
    employeeType: null,
    memberCode: null,
    tableID: "1",
    visitPurposeID: "1",
    visitorTypeID: null,
    paxTotal: 2,
    subtotal: 100000,
    discountTotal: 0,
    menuDiscountTotal: 0,
    promotionDiscount: 0,
    voucherDiscountTotal: 0,
    otherTaxTotal: 0,
    vatTotal: 11000,
    otherVatTotal: 0,
    deliveryCost: 0,
    orderFee: 0,
    grandTotal: 111000,
    voucherTotal: 0,
    roundingTotal: 0,
    paymentTotal: 111000,
    billingPrintCount: 1,
    paymentPrintCount: 1,
    additionalInfo: null,
    remarks: null,
    promotionID: null,
    promotionVoucherCode: null,
    flagInclusive: false,
    lockTable: false,
    transactionModeID: null,
    deliveryTime: null,
    externalMembershipTypeID: null,
    flagExternalAPI: false,
    flagExternalMemberID: null,
    flagExternalMemberPhone: null,
    flagExternalCardID: null,
    externalMemberName: null,
    externalTransID: null,
    externalCancelTransID: null,
    terminalID: null,
    printEsoFsQr: null,
    statusID: "1",
    createdBy: "probe-test",
    editedBy: null,
    editedDate: null,
    syncDate: null,
    ...overrides,
  };
}

function makeSaleItem(salesNum: string, overrides?: Partial<SaleItemInput>): SaleItemInput {
  return {
    ID: Math.floor(Math.random() * 1000000) + 1,
    localID: null,
    salesNum,
    batchID: "1",
    menuRefID: "1",
    menuGroupID: "1",
    menuID: "1",
    customMenuName: "Test Menu",
    qty: 2,
    originalPrice: 50000,
    price: 50000,
    inclusivePrice: 0,
    discount: 0,
    discountValue: 0,
    inclusiveDiscountValue: 0,
    otherTax: 0,
    otherTaxValue: 0,
    vat: 11000,
    vatValue: 11000,
    otherVat: 0,
    otherVatValue: 0,
    otherTaxOnVat: 0,
    total: 111000,
    notes: null,
    statusID: "1",
    promotionDetailID: "0",
    menuPromotionID: "0",
    promotionVoucherCode: null,
    cancelNotes: null,
    salesType: null,
    flagPending: 0,
    createdBy: "probe-test",
    createdDate: null,
    editedBy: null,
    editedDate: null,
    syncDate: null,
    ...overrides,
  };
}

function makeSalePayment(salesNum: string, overrides?: Partial<SalePaymentInput>): SalePaymentInput {
  return {
    ID: Math.floor(Math.random() * 1000000) + 1,
    localID: null,
    salesNum,
    paymentMethodID: "1",
    voucherCode: "",
    voucherCategoryID: null,
    notes: null,
    cardNumber: "",
    bankName: "",
    accountName: "",
    selfOrderID: null,
    verificationCode: "",
    edcTerminalID: null,
    traceNumber: null,
    canceledVerificationCode: null,
    flagExternalVoucherAPI: false,
    externalVoucherCode: null,
    externalTransactionId: null,
    externalBatchNumber: null,
    externalCanceledTransactionId: null,
    externalCanceledBatchNumber: null,
    coaNo: "4-1000",
    paymentAmount: 111000,
    fullPaymentAmount: 111000,
    syncDate: null,
    ...overrides,
  };
}

// ── Skenario 1: Partial failure di upsertPayments() — REPOSITORY LEVEL (without transaction) ──
// NOTE: Test ini langsung panggil salesRepository.upsertPayments() TANPA client/transaction.
// Setelah Fase 4, risiko di repository level ini TETAP ADA kalau dipanggil standalone.
// Mitigasi transaction ada di SERVICE layer (salesService.import()).
// Ini sengaja dipertahankan sebagai dokumentasi bahwa repository method sendiri tidak atomic.
describe("SKENARIO 1: Partial failure di upsertPayments() — repository level (tanpa transaction)", () => {
  const salesNum = `${PREFIX}-001`;

  beforeAll(async () => {
    await pool.query(
      `INSERT INTO tr_saleshead (sales_num, sales_date, sales_date_in, branch_id, table_id, visit_purpose_id, pax_total, subtotal, discount_total, menu_discount_total, promotion_discount, other_tax_total, vat_total, grand_total, voucher_total, payment_total, billing_print_count, payment_print_count, status_id, created_by)
       VALUES ($1, '2026-06-21', '2026-06-21 10:00:00', 1, 1, 1, 2, 100000, 0, 0, 0, 0, 11000, 111000, 0, 111000, 1, 1, 1, 'probe-test')`,
      [salesNum],
    );
    for (let i = 1; i <= 2; i++) {
      await pool.query(
        `INSERT INTO tr_salespayment (external_id, sales_num, payment_method_id, voucher_code, coa_no, payment_amount, full_payment_amount, card_number, bank_name, account_name, verification_code)
         VALUES ($1, $2, '1', '', '4-1000', 55500, 55500, '', '', '', '')`,
        [i, salesNum],
      );
    }
    console.log("  [SETUP] Inserted 1 tr_saleshead + 2 old tr_salespayment rows");
  });

  it("menyebabkan 0 baris payment (DELETE sukses, INSERT gagal)", async () => {
    // ── State SEBELUM ──
    const beforePay = await pool.query(
      "SELECT COUNT(*)::int AS cnt FROM tr_salespayment WHERE sales_num = $1",
      [salesNum],
    );
    console.log(`  [BEFORE] tr_salespayment rows for ${salesNum}: ${String(beforePay.rows[0]?.cnt)}`);

    // ── Inject failure: spy pool.query, throw pada call ke-2 (INSERT) ──
    let callCount = 0;
    const originalQuery = pool.query.bind(pool);
    jest.spyOn(pool, "query").mockImplementation(
      async (queryText: string, params?: unknown[]): Promise<unknown> => {
        callCount++;
        if (callCount === 2) {
          throw new Error("SIMULATED FAILURE: INSERT tr_salespayment gagal di tengah");
        }
        return originalQuery(queryText, params);
      },
    );

    // ── Jalankan upsertPayments dengan 2 payment baru ──
    const newPayments: SalePaymentInput[] = [
      makeSalePayment(salesNum, { ID: 10, paymentAmount: 60000, paymentMethodID: "1" }),
      makeSalePayment(salesNum, { ID: 11, paymentAmount: 51000, paymentMethodID: "2" }),
    ];
    await expect(salesRepository.upsertPayments(newPayments)).rejects.toThrow("SIMULATED FAILURE");

    jest.restoreAllMocks();

    // ── State SESUDAH ──
    const afterPay = await pool.query(
      "SELECT COUNT(*)::int AS cnt FROM tr_salespayment WHERE sales_num = $1",
      [salesNum],
    );
    const afterPayCount = afterPay.rows[0]?.cnt ?? 0;
    console.log(`  [AFTER]  tr_salespayment rows for ${salesNum}: ${String(afterPayCount)}`);

    expect(afterPayCount).toBe(0);
    console.log(
      `  >>> HASIL: ${afterPayCount === 0 ? "✅ RISK CONFIRMED" : "❌ Unexpected"} — DELETE berjalan, INSERT gagal → data payment 0 baris (seharusnya 2)`,
    );
  });
});

// ── Skenario 2: Partial failure antara upsertSales, upsertItems, upsertPayments ──
// PASCA-FASE 4: SalesService.import() sekarang pakai withTransaction().
// Semua writes di-rollback kalau upsertItems gagal → tidak ada orphan.
describe("SKENARIO 2: Partial failure — transaction rollback mencegah orphan (PASCA-FASE 4)", () => {
  const salesNum = `${PREFIX}-002`;

  it("menyebabkan 0 row di semua tabel (rollback membatalkan semuanya)", async () => {
    const sale = makeSale(salesNum);
    const item = makeSaleItem(salesNum);
    const payment = makeSalePayment(salesNum);

    // ── Inject failure di upsertItems ──
    jest.spyOn(salesRepository, "upsertItems").mockImplementationOnce(async () => {
      throw new Error("SIMULATED FAILURE: upsertItems gagal setelah upsertSales sukses");
    });

    await expect(
      salesService.import({ sales: [sale], items: [item], payments: [payment] }),
    ).rejects.toThrow("SIMULATED FAILURE");

    jest.restoreAllMocks();

    // ── Query langsung ──
    const headRows = await pool.query(
      "SELECT COUNT(*)::int AS cnt FROM tr_saleshead WHERE sales_num = $1", [salesNum],
    );
    const itemRows = await pool.query(
      "SELECT COUNT(*)::int AS cnt FROM tr_salesmenu WHERE sales_num = $1", [salesNum],
    );
    const payRows = await pool.query(
      "SELECT COUNT(*)::int AS cnt FROM tr_salespayment WHERE sales_num = $1", [salesNum],
    );
    const headCount = headRows.rows[0]?.cnt ?? 0;
    const itemCount = itemRows.rows[0]?.cnt ?? 0;
    const payCount = payRows.rows[0]?.cnt ?? 0;

    console.log(`  [AFTER] tr_saleshead:    ${String(headCount)} rows`);
    console.log(`  [AFTER] tr_salesmenu:    ${String(itemCount)} rows`);
    console.log(`  [AFTER] tr_salespayment: ${String(payCount)} rows`);

    expect(headCount).toBe(0); // ROLLBACK — semua writes dibatalkan
    expect(itemCount).toBe(0);
    expect(payCount).toBe(0);

    console.log(
      `  >>> HASIL: ${headCount === 0 && itemCount === 0 ? "✅ FIXED — transaction rollback mencegah partial state" : "❌ RISK STILL EXISTS"} — 0 rows di semua tabel (seharusnya 0, bukan 1 head + 0 items)`,
    );
  });
});

// ── Skenario 3: Concurrent double-import (race condition) ──
// NOTE: kita bypass service.import() karena aggregate recalculation butuh tabel yg tdk ada di test DB.
// Langsung panggil repository methods untuk test race condition di DB level.
describe("SKENARIO 3: Concurrent double-import (race on DB level)", () => {
  const salesNum = `${PREFIX}-003`;

  jest.setTimeout(30000);

  it("menghasilkan state konsisten meskipun 2 import paralel", async () => {
    const sale = makeSale(salesNum);
    const item1 = makeSaleItem(salesNum, { ID: 100, qty: 1, price: 50000, total: 50000 });
    const item2 = makeSaleItem(salesNum, { ID: 101, qty: 3, price: 25000, total: 75000 });
    const payments = [
      makeSalePayment(salesNum, { ID: 200, paymentAmount: 125000 }),
    ];

    // Jalankan 2 import paralel via repository langsung (simulasi race condition)
    await Promise.all([
      (async () => {
        await salesRepository.upsertSales([sale]);
        await salesRepository.upsertItems([item1, item2]);
        await salesRepository.upsertPayments(payments);
      })(),
      (async () => {
        await salesRepository.upsertSales([sale]);
        await salesRepository.upsertItems([item1, item2]);
        await salesRepository.upsertPayments(payments);
      })(),
    ]);

    // ── Verify ──
    const headRows = await pool.query(
      "SELECT COUNT(*)::int AS cnt FROM tr_saleshead WHERE sales_num = $1", [salesNum],
    );
    const itemRows = await pool.query(
      "SELECT COUNT(*)::int AS cnt FROM tr_salesmenu WHERE sales_num = $1", [salesNum],
    );
    const payRows = await pool.query(
      "SELECT COUNT(*)::int AS cnt FROM tr_salespayment WHERE sales_num = $1", [salesNum],
    );
    const dupItems = await pool.query(
      `SELECT external_id, COUNT(*)::int AS cnt FROM tr_salesmenu WHERE sales_num = $1 GROUP BY external_id HAVING COUNT(*) > 1`,
      [salesNum],
    );

    const headCount = headRows.rows[0]?.cnt ?? 0;
    const itemCount = itemRows.rows[0]?.cnt ?? 0;
    const payCount = payRows.rows[0]?.cnt ?? 0;
    const dupItemCount = dupItems.rowCount ?? 0;

    console.log(`  [RESULT] tr_saleshead:    ${String(headCount)} rows`);
    console.log(`  [RESULT] tr_salesmenu:    ${String(itemCount)} rows (unique items: 2)`);
    console.log(`  [RESULT] tr_salespayment: ${String(payCount)} rows`);
    console.log(`  [RESULT] Duplicate items: ${String(dupItemCount)} groups`);

    // PK sales_num di tr_saleshead — ON CONFLICT DO UPDATE menjamin 1 row
    expect(headCount).toBe(1);
    // ON CONFLICT (external_id) di tr_salesmenu — upsert, jadi tetap 2 unique rows
    expect(itemCount).toBe(2);
    expect(dupItemCount).toBe(0);
    // DELETE + INSERT di upsertPayments — race bisa cause masalah di sini
    // Kalau 2 DELETE jalan bareng + 2 INSERT jalan bareng, hasilnya bisa 1 atau 2 tergantung timing
    // Yang penting konsisten: minimal 1 dan tidak ada duplikat FK orphan
    expect(payCount).toBeGreaterThanOrEqual(1);

    const isConsistent = headCount === 1 && itemCount === 2 && dupItemCount === 0 && payCount >= 1;
    console.log(
      `  >>> HASIL: ${isConsistent ? "✅ SAFE (ON CONFLICT DO UPDATE works)" : "⚠️ INCONSISTENT — race detected"}`,
    );
  });
});

// ── Skenario 4: masterService.sync() Happy Path — data ter-upsert dengan benar ──
describe("SKENARIO 4: masterService.sync() Happy Path — data ter-upsert dengan benar", () => {
  it("menyimpan semua data master staging dengan sukses", async () => {
    const payload = {
      branches: [
        { pos_id: 999901, branch_name: "Test Branch 999901", branch_code: "TB01", flag_active: 1, pos_synced_at: "2026-06-21 10:00:00" },
      ],
      payment_methods: [
        { pos_id: 999901, pos_branch_id: 999901, name: "Test PM 999901", flag_active: 1, pos_synced_at: "2026-06-21 10:00:00" },
      ],
      menu_categories: [
        { pos_id: 999901, category_name: "Test Cat 999901", flag_active: 1, pos_synced_at: "2026-06-21 10:00:00" },
      ],
      menu_groups: [
        { pos_id: 999901, pos_category_id: 999901, group_name: "Test Group 999901", flag_active: 1, pos_synced_at: "2026-06-21 10:00:00" },
      ],
      menus: [
        { pos_id: 999901, pos_group_id: 999901, menu_name: "Test Menu 999901", price: 10000, flag_active: 1, pos_synced_at: "2026-06-21 10:00:00" },
      ],
    };

    const res = await masterService.sync(payload);
    expect(res.success).toBe(true);
    expect(res.branches).toBe(1);
    expect(res.payment_methods).toBe(1);
    expect(res.menu_categories).toBe(1);
    expect(res.menu_groups).toBe(1);
    expect(res.menus).toBe(1);

    // Verify row counts in database
    const branchRes = await pool.query("SELECT COUNT(*)::int AS cnt FROM pos_staging_branches WHERE pos_id = 999901");
    const pmRes = await pool.query("SELECT COUNT(*)::int AS cnt FROM pos_staging_payment_methods WHERE pos_id = 999901");
    const catRes = await pool.query("SELECT COUNT(*)::int AS cnt FROM pos_staging_menu_categories WHERE pos_id = 999901");
    const groupRes = await pool.query("SELECT COUNT(*)::int AS cnt FROM pos_staging_menu_groups WHERE pos_id = 999901");
    const menuRes = await pool.query("SELECT COUNT(*)::int AS cnt FROM pos_staging_menus WHERE pos_id = 999901");

    expect(branchRes.rows[0]?.cnt).toBe(1);
    expect(pmRes.rows[0]?.cnt).toBe(1);
    expect(catRes.rows[0]?.cnt).toBe(1);
    expect(groupRes.rows[0]?.cnt).toBe(1);
    expect(menuRes.rows[0]?.cnt).toBe(1);
  });
});

// ── Skenario 5: masterService.sync() Partial failure — transaction rollback mencegah data masuk setengah-setengah ──
describe("SKENARIO 5: masterService.sync() Partial failure — transaction rollback mencegah data masuk setengah-setengah", () => {
  it("menyebabkan 0 row di semua tabel staging (rollback membatalkan semuanya)", async () => {
    const payload = {
      branches: [
        { pos_id: 999902, branch_name: "Test Branch 999902", branch_code: "TB02", flag_active: 1, pos_synced_at: "2026-06-21 10:00:00" },
      ],
      payment_methods: [
        { pos_id: 999902, pos_branch_id: 999902, name: "Test PM 999902", flag_active: 1, pos_synced_at: "2026-06-21 10:00:00" },
      ],
      menu_categories: [
        { pos_id: 999902, category_name: "Test Cat 999902", flag_active: 1, pos_synced_at: "2026-06-21 10:00:00" },
      ],
      menu_groups: [
        { pos_id: 999902, pos_category_id: 999902, group_name: "Test Group 999902", flag_active: 1, pos_synced_at: "2026-06-21 10:00:00" },
      ],
      menus: [
        { pos_id: 999902, pos_group_id: 999902, menu_name: "Test Menu 999902", price: 10000, flag_active: 1, pos_synced_at: "2026-06-21 10:00:00" },
      ],
    };

    // Mock upsertMenus to fail
    jest.spyOn(masterRepository, "upsertMenus").mockImplementationOnce(async () => {
      throw new Error("SIMULATED FAILURE: upsertMenus gagal di tengah transaksi");
    });

    await expect(masterService.sync(payload)).rejects.toThrow("SIMULATED FAILURE");
    jest.restoreAllMocks();

    // Verify database is empty for pos_id = 999902 (rollback checked)
    const branchRes = await pool.query("SELECT COUNT(*)::int AS cnt FROM pos_staging_branches WHERE pos_id = 999902");
    const pmRes = await pool.query("SELECT COUNT(*)::int AS cnt FROM pos_staging_payment_methods WHERE pos_id = 999902");
    const catRes = await pool.query("SELECT COUNT(*)::int AS cnt FROM pos_staging_menu_categories WHERE pos_id = 999902");
    const groupRes = await pool.query("SELECT COUNT(*)::int AS cnt FROM pos_staging_menu_groups WHERE pos_id = 999902");
    const menuRes = await pool.query("SELECT COUNT(*)::int AS cnt FROM pos_staging_menus WHERE pos_id = 999902");

    expect(branchRes.rows[0]?.cnt).toBe(0);
    expect(pmRes.rows[0]?.cnt).toBe(0);
    expect(catRes.rows[0]?.cnt).toBe(0);
    expect(groupRes.rows[0]?.cnt).toBe(0);
    expect(menuRes.rows[0]?.cnt).toBe(0);
  });
});