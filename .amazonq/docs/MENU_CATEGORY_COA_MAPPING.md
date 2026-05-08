# Menu Category & COA Mapping — Revenue Breakdown

## Prinsip Utama

**Category dan Group menu dikelola 100% dari system internal (ERP), BUKAN dari POS Sync.**

POS Sync hanya mengirim `menu_id` (angka). System ERP yang menentukan menu tersebut masuk kategori apa dan akun penjualan mana.

## Data Flow

```
POS System → tr_salesmenu (menu_id, price, qty)
                    ↓
              menus (pos_menu_id → menu_id)
                    ↓
         menus.category_id → menu_categories
                    ↓
      menu_categories.sales_coa_id → chart_of_accounts (Revenue)
      menu_categories.cogs_coa_id  → chart_of_accounts (COGS)
```

## Hierarki

```
menu_categories (Makanan, Minuman, Lainnya)
    └── menu_groups (Sushi, Sashimi, Donburi, Soft Drink, dll)
        └── menus (Salmon Sashimi, Ocha, dll)
```

## COA Mapping (per Category)

| Category | Code | Sales COA | Account |
|----------|------|-----------|---------|
| Makanan | FOOD | 410101 | Penjualan - Makanan |
| Minuman | BEVERAGE | 410102 | Penjualan - Minuman |
| Lainnya | OTHER | 410103 | Penjualan - Lainnya |

## Aturan

1. **Category & Group di-manage di** `/food-production/categories` dan `/food-production/menus`
2. **POS Sync TIDAK mengubah** `category_id` atau `group_id` — hanya sinkronisasi data transaksi
3. **Perubahan kategori berlaku prospektif** — jurnal yang sudah di-generate tidak berubah
4. **Jika ingin retroaktif**: delete jurnal POS lama → re-generate untuk periode tersebut
5. **Semua menu WAJIB punya** `category_id` dengan `sales_coa_id` yang valid

## Penggunaan di Journal

### POS Journal — Revenue Breakdown (Enhancement)

**Sebelum (current):**
```
CREDIT 410101 Penjualan - Makanan = grandGross (semua revenue 1 akun)
```

**Sesudah (target):**
```
CREDIT 410101 Penjualan - Makanan  = SUM(price * qty) WHERE category_code = 'FOOD'
CREDIT 410102 Penjualan - Minuman  = SUM(price * qty) WHERE category_code = 'BEVERAGE'
CREDIT 410103 Penjualan - Lainnya  = SUM(price * qty) WHERE category_code = 'OTHER'
```

**Implementation di `pos-journals.processor.ts`:**

1. Setelah aggregate per date/branch, batch query revenue breakdown:
```sql
SELECT mc.sales_coa_id, coa.account_name, SUM(sm.price * sm.qty)::numeric AS category_revenue
FROM pos_sync_aggregate_lines psal
JOIN tr_salesmenu sm ON sm.sales_num = psal.sales_num AND sm.status_id != 2
JOIN pos_sync_aggregates psa ON psa.id = psal.aggregate_id
LEFT JOIN menus m ON m.pos_menu_id = sm.menu_id AND m.company_id = $1 AND m.deleted_at IS NULL
LEFT JOIN menu_categories mc ON mc.id = m.category_id
LEFT JOIN chart_of_accounts coa ON coa.id = mc.sales_coa_id
WHERE psa.id = ANY($2::uuid[])
GROUP BY mc.sales_coa_id, coa.account_name
```

2. Replace single `pushLine(revenueAccountId, 'POS Sales Revenue', 0, grandGross)` dengan loop per category
3. Fallback: jika `SUM(category_revenues)` != `grandGross`, selisih masuk ke default `revenueAccountId`
4. Jika query return 0 rows (edge case: no tr_salesmenu data), fallback ke behavior lama (1 line)

**Rules (dari CODING_PATTERNS & INTEGRATION_PATTERNS):**
- Batch fetch 1 query per journal group — NO N+1
- Compare by `sales_coa_id` (UUID) — bukan `category_name` (Identifier Stability)
- Fallback dengan log warning jika ada menu tanpa mapping
- Tidak perlu transaction tambahan (sudah di dalam journal creation transaction)

### Full POS Journal Structure (Target)
```
DEBIT  Piutang Penjualan [Payment Method]    = bill_after_discount
DEBIT  Beban MDR (%)                          = percentage_fee
DEBIT  Beban MDR (fixed)                      = fixed_fee
CREDIT Utang MDR [Payment Method]             = total_fee
CREDIT Penjualan - Makanan (410101)           = revenue per FOOD
CREDIT Penjualan - Minuman (410102)           = revenue per BEVERAGE
CREDIT Penjualan - Lainnya (410103)           = revenue per OTHER
CREDIT Utang PB1 (210206)                     = tax_amount
CREDIT Utang Service Charge                   = service_charge (if any)
CREDIT Pendapatan Biaya Order (410202)        = order_fee (if any)
CREDIT Pendapatan Pengiriman (410203)         = delivery (if any)
```

## Query Pattern (Revenue per Category)

```sql
-- Used by: pos-journals.processor.ts (journal generation)
-- Context: batch query per journal group (date + branch)
-- Input: $1 = company_id, $2 = array of pos_sync_aggregate IDs in this group
-- Note: pos_sync_aggregates & tr_salesmenu tidak punya company_id (single-company by design)
--       Multi-tenant filter via menus.company_id saja
SELECT mc.sales_coa_id, coa.account_name, SUM(sm.price * sm.qty)::numeric AS category_revenue
FROM pos_sync_aggregate_lines psal
JOIN tr_salesmenu sm ON sm.sales_num = psal.sales_num AND sm.status_id != 2
JOIN pos_sync_aggregates psa ON psa.id = psal.aggregate_id
LEFT JOIN menus m ON m.pos_menu_id = sm.menu_id AND m.company_id = $1 AND m.deleted_at IS NULL
LEFT JOIN menu_categories mc ON mc.id = m.category_id
LEFT JOIN chart_of_accounts coa ON coa.id = mc.sales_coa_id
WHERE psa.id = ANY($2::uuid[])
GROUP BY mc.sales_coa_id, coa.account_name
```

```sql
-- Used by: cogs.repository.ts (COGS calculation)
-- Already implemented, reference only
SELECT sm.menu_id, mc.category_code, mc.category_name, SUM(sm.qty) AS qty_sold, SUM(sm.total) AS revenue
FROM tr_salesmenu sm
JOIN tr_saleshead sh ON sh.sales_num = sm.sales_num
LEFT JOIN menus m ON m.pos_menu_id = sm.menu_id
LEFT JOIN menu_categories mc ON mc.id = m.category_id
WHERE ...
GROUP BY sm.menu_id, mc.category_code, mc.category_name
```

## Aggregate ID Resolution

POS journal processor groups transactions by `date + branch`. To get `pos_sync_aggregate` IDs:
```sql
-- From aggregated_transactions (which are the source of POS journals)
-- Each aggregated_transaction has source_type = 'POS_SYNC' and source_id = pos_sync_aggregate.id
SELECT source_id FROM aggregated_transactions
WHERE id = ANY($1::uuid[]) AND source_type = 'POS_SYNC'
```

Or directly from the processor's existing `txGroup` which already has `source_id` per transaction.

## Validasi Data (Confirmed)

| Check | Result |
|-------|--------|
| Semua `sales_num` di pos_sync ada di tr_salesmenu | ✅ 0 gap |
| `SUM(price * qty)` = `gross_amount` per aggregate | ✅ Exact match (diff = 0) |
| Semua menu punya category + sales_coa_id | ✅ 105/105 (100%) |
| Total menu dengan category & group | ✅ 281/281 (100%) |

## Catatan

- `tr_salesmenu.total` = inclusive price (sudah termasuk PPN) — **JANGAN pakai untuk revenue**
- `tr_salesmenu.price * qty` = exclusive price (sebelum PPN) — **PAKAI ini untuk revenue**
- `sm.status_id = 2` = cancelled item — **EXCLUDE dari perhitungan**

## Edge Cases & Fallback Strategy

| Scenario | Handling |
|----------|----------|
| Menu tidak ada di `menus` table (pos_menu_id not found) | Revenue masuk default `revenueAccountId` (410101) + log warning |
| Menu ada tapi `category_id` NULL | Revenue masuk default `revenueAccountId` + log warning |
| Category ada tapi `sales_coa_id` NULL | Revenue masuk default `revenueAccountId` + log warning |
| `SUM(category_revenues)` < `grandGross` (rounding) | Selisih masuk ke category dengan revenue terbesar ("last line gets remainder") |
| `SUM(category_revenues)` > `grandGross` | Tidak mungkin (validated: exact match) |
| `tr_salesmenu` tidak punya data untuk sales_num | Fallback ke behavior lama (1 line = grandGross) |
| `sm.status_id = 2` (cancelled item) | Excluded dari SUM |
| `sales_coa_id` = NULL (grouped as 1 row) | Masuk default `revenueAccountId` + log warning |

## Backward Compatibility

- Jurnal yang sudah di-generate **TIDAK berubah** (immutable setelah POSTED)
- Perubahan hanya berlaku untuk jurnal **baru** yang di-generate setelah deploy
- Jika ingin retroaktif: delete jurnal POS lama → re-generate
- `revenueAccountId` dari `SAL-INV` purpose tetap dipakai sebagai fallback

## COGS Integration

```
menu_categories.cogs_coa_id → akun HPP per kategori (dipakai di /food-production/cogs)
```

COGS module sudah pakai `tr_salesmenu → menus → menu_categories` untuk hitung qty sold per menu. Revenue breakdown di POS journal mengikuti pattern yang sama — sehingga angka di Trial Balance (revenue per category) akan konsisten dengan COGS report.
