# Theoretical Consumption — Design Document

> **Revisi:** Semua fixes dari code review sudah diapply:
> - Branch filter mismatch di variance query → dokumentasikan resolver eksplisit
> - UNION ALL outer GROUP BY diperjelas → wrap dalam CTE + final aggregation
> - `status_id` filter diklarifikasi dari data aktual (13=valid, 19=void)
> - Performance threshold ditambahkan
> - Variance empty state di-spec
> - Parameter standardized: frontend kirim UUID, backend resolve ke pos_id
> - Coverage threshold di-define eksplisit
> - Export CSV ditambah di semua tab
> - `pos_sync_aggregates` fallback strategy didokumentasikan

---

## Tujuan

Menghitung **bahan baku yang seharusnya terpakai** berdasarkan menu yang terjual di POS.
Ini adalah kalkulasi otomatis (bukan input manual) yang menjawab pertanyaan:

> "Berdasarkan penjualan hari ini, seharusnya berapa bahan baku yang terpakai?"

Lalu dibandingkan dengan **actual consumption** (dari Production Order) untuk mendeteksi
variance/shrinkage.

---

## Prinsip Desain

1. **Read-only calculation** — tidak generate jurnal, murni report/analisa
2. **Reverse BOM** — dari qty terjual → explode ke bahan baku via recipe + WIP ingredients
3. **Per branch, per periode** — bisa drill down per cabang per hari/minggu/bulan
4. **Coverage tracking** — menu tanpa resep di-flag, tidak dihitung tapi dilaporkan
5. **Compare dengan actual** — variance = actual (production order) - theoretical (sales)
6. **Frontend selalu kirim UUID** — backend yang resolve ke POS branch_id integer

---

## Data Sources

### Tables yang Dibaca

| Table | Field yang Dipakai | Keterangan |
|-------|-------------------|------------|
| `tr_salesmenu` | `sales_num`, `menu_id` (int), `qty`, `status_id` | Item terjual per transaksi |
| `tr_saleshead` | `sales_num`, `sales_date`, `branch_id` (int) | Header transaksi (tanggal + cabang POS) |
| `menus` | `id`, `pos_menu_id` (int), `has_recipe` | Mapping POS menu_id → internal menu |
| `recipe_lines` | `menu_id`, `product_id`, `wip_id`, `qty`, `uom`, `cost_per_unit` | BOM per menu |
| `wip_items` | `id`, `yield_qty` | Yield per batch WIP |
| `wip_ingredients` | `wip_id`, `product_id`, `qty`, `uom`, `cost_per_unit` | Bahan baku per WIP |
| `pos_sync_aggregates` | `branch_pos_id`, `branch_id` (UUID) | Mapping POS branch → internal branch |

---

## status_id — Confirmed Values

Dari data aktual `tr_salesmenu`:

| status_id | Count | Arti | Include? |
|-----------|-------|------|----------|
| 13 | 102.980 | Valid sale (terjual) | ✅ YES |
| 19 | 234 | Void / cancelled | ❌ NO |

**Filter yang benar:**
```sql
WHERE sm.status_id = 13
-- BUKAN: WHERE sm.status_id != 2 (assumption lama, salah)
```

---

## Branch ID Resolution

### Masalah

`tr_saleshead.branch_id` = integer (POS ID: 2–8), bukan UUID.
`production_orders.branch_id` = UUID.
User input dari frontend = UUID.

Backend harus resolve 1 UUID input ke 2 ID berbeda untuk query theoretical vs actual.

### Resolver

```typescript
interface BranchIds {
  branchUuid: string       // untuk query production_order_materials
  branchPosId: number      // untuk query tr_saleshead
}

async function resolveBranchIds(branchUuid: string): Promise<BranchIds> {
  // Primary: dari pos_sync_aggregates (sudah punya data lengkap)
  const { rows } = await pool.query(`
    SELECT DISTINCT branch_pos_id
    FROM pos_sync_aggregates
    WHERE branch_id = $1
    LIMIT 1
  `, [branchUuid])

  if (rows.length > 0) {
    return { branchUuid, branchPosId: rows[0].branch_pos_id }
  }

  // Fallback: dari pos_staging_branches join ke branches by name matching
  // (dipakai jika pos_sync_aggregates belum punya data untuk branch tertentu)
  const { rows: fallback } = await pool.query(`
    SELECT psb.pos_id
    FROM pos_staging_branches psb
    JOIN branches b ON LOWER(b.branch_name) LIKE '%' || LOWER(SPLIT_PART(psb.branch_name, ' ', 2)) || '%'
    WHERE b.id = $1
    LIMIT 1
  `, [branchUuid])

  if (fallback.length > 0) {
    return { branchUuid, branchPosId: fallback[0].pos_id }
  }

  throw new Error(`Cannot resolve POS branch_id for branch UUID: ${branchUuid}`)
}
```

### Confirmed Mapping (dari pos_sync_aggregates)

| POS branch_id (int) | UUID | Nama |
|---------------------|------|------|
| 2 | bb192f6a-ce66-4654-90eb-7bf8fbeaf955 | Sushimas Serpong |
| 3 | 37e05672-0297-4b19-967d-c357afa0409f | Sushimas Condet |
| 4 | 881e82ef-6d75-430a-8359-9ca81161fb4c | Sushimas Grand Galaxy |
| 5 | e3be5f67-25e6-422b-b1b1-6f98afac24ed | Sushimas Depok |
| 6 | fb9ffdf8-3586-4a35-99f4-d27e563713f8 | Sushimas Cibinong |
| 7 | ee32e465-c087-4b02-a036-06a960725ecb | Sushimas Grand Wisata |
| 8 | 3697da69-b99b-49b9-8be2-f7cc1ee5cf2a | Sushimas Harapan Indah |

---

## Calculation Logic

### Flow

```
tr_salesmenu (qty terjual, status_id = 13)
    │
    ├── JOIN menus ON pos_menu_id = menu_id
    │
    ├── JOIN recipe_lines ON menu_id
    │       │
    │       ├── product_id NOT NULL → bahan baku langsung
    │       │   theoretical_qty = recipe_line.qty × sales_qty
    │       │
    │       └── wip_id NOT NULL → explode via wip_ingredients
    │           theoretical_qty = (recipe_line.qty / wip.yield_qty) × ingredient.qty × sales_qty
    │
    └── Menu tanpa recipe → flagged as unmapped (coverage report)
```

### Detail Calculation per Bahan

#### Case 1: Bahan baku langsung di recipe

```
Menu "Agedashi Tofu" terjual 10 porsi
Recipe: 20 gram Avocado Powder per porsi

Theoretical = 20 × 10 = 200 gram Avocado Powder
```

#### Case 2: WIP di recipe → explode ke bahan baku

```
Menu "Salmon Roll" terjual 5 porsi
Recipe: 150 gram Nasi Sushi (WIP) per porsi

WIP "Nasi Sushi":
  yield_qty = 1000 gram per batch
  ingredients: 10 pcs Black Tea, 100 gram Avocado Powder

Theoretical:
  Total WIP = 150 × 5 = 750 gram
  Ratio ke batch = 750 / 1000 = 0.75

  Black Tea:    10 × 0.75 = 7.5 pcs
  Avocado Pow: 100 × 0.75 = 75 gram
```

---

## Master Query (Theoretical Consumption)

Struktur: 2 CTE (direct + via WIP) → UNION ALL → outer GROUP BY untuk eliminasi
double-count jika product yang sama muncul di kedua path.

```sql
WITH
-- Path 1: bahan baku langsung dari recipe
direct_consumption AS (
  SELECT
    rl.product_id,
    p.product_name,
    p.product_code,
    rl.uom,
    SUM(rl.qty * sm.qty)                        AS theoretical_qty,
    SUM(rl.qty * sm.qty * rl.cost_per_unit)     AS theoretical_cost
  FROM tr_salesmenu sm
  JOIN tr_saleshead sh ON sh.sales_num = sm.sales_num
  JOIN menus m ON m.pos_menu_id = sm.menu_id
    AND m.deleted_at IS NULL
  JOIN recipe_lines rl ON rl.menu_id = m.id
    AND rl.product_id IS NOT NULL
  JOIN products p ON p.id = rl.product_id
  WHERE sm.status_id = 13                        -- ✅ valid sale only
    AND sh.sales_date BETWEEN $1 AND $2
    AND sh.branch_id = $3                        -- POS int ID (resolved by backend)
  GROUP BY rl.product_id, p.product_name, p.product_code, rl.uom
),

-- Path 2: WIP di recipe → explode ke bahan baku via wip_ingredients
wip_consumption AS (
  SELECT
    wi.product_id,
    p.product_name,
    p.product_code,
    wi.uom,
    SUM(
      (rl.qty * sm.qty / NULLIF(wip.yield_qty, 0)) * wi.qty
    )                                            AS theoretical_qty,
    SUM(
      (rl.qty * sm.qty / NULLIF(wip.yield_qty, 0)) * wi.qty * wi.cost_per_unit
    )                                            AS theoretical_cost
  FROM tr_salesmenu sm
  JOIN tr_saleshead sh ON sh.sales_num = sm.sales_num
  JOIN menus m ON m.pos_menu_id = sm.menu_id
    AND m.deleted_at IS NULL
  JOIN recipe_lines rl ON rl.menu_id = m.id
    AND rl.wip_id IS NOT NULL
  JOIN wip_items wip ON wip.id = rl.wip_id
  JOIN wip_ingredients wi ON wi.wip_id = wip.id
  JOIN products p ON p.id = wi.product_id
  WHERE sm.status_id = 13                        -- ✅ valid sale only
    AND sh.sales_date BETWEEN $1 AND $2
    AND sh.branch_id = $3                        -- POS int ID (resolved by backend)
  GROUP BY wi.product_id, p.product_name, p.product_code, wi.uom
),

-- Gabungkan kedua path, GROUP BY lagi untuk eliminasi double-count
all_consumption AS (
  SELECT * FROM direct_consumption
  UNION ALL
  SELECT * FROM wip_consumption
)

-- Final aggregation: 1 row per product
SELECT
  product_id,
  product_name,
  product_code,
  uom,
  SUM(theoretical_qty)   AS theoretical_qty,
  SUM(theoretical_cost)  AS theoretical_cost
FROM all_consumption
GROUP BY product_id, product_name, product_code, uom
ORDER BY theoretical_cost DESC
```

> **Catatan `$3`:** Backend selalu resolve UUID input ke `branch_pos_id` integer
> sebelum passing ke query ini. Lihat section Branch ID Resolution.

---

## Variance Query (Actual vs Theoretical)

```sql
WITH
-- Theoretical (sama seperti master query di atas, tanpa ORDER BY)
theoretical AS (
  -- ... CTE all_consumption di atas ...
  SELECT
    product_id, product_name, product_code, uom,
    SUM(theoretical_qty)  AS theoretical_qty,
    SUM(theoretical_cost) AS theoretical_cost
  FROM (
    SELECT * FROM direct_consumption
    UNION ALL
    SELECT * FROM wip_consumption
  ) combined
  GROUP BY product_id, product_name, product_code, uom
),

-- Actual (dari production_order_materials — pakai branch UUID)
actual AS (
  SELECT
    pm.product_id,
    pm.product_name,
    pm.product_code,
    pm.uom,
    SUM(pm.actual_qty)   AS actual_qty,
    SUM(pm.total_cost)   AS actual_cost,
    SUM(pm.waste_qty)    AS waste_qty
  FROM production_order_materials pm
  JOIN production_orders po ON po.id = pm.production_order_id
  WHERE po.production_date BETWEEN $1 AND $2
    AND po.branch_id = $4                        -- UUID langsung, bukan POS int
    AND po.status IN ('COMPLETED', 'JOURNALED')
    AND po.deleted_at IS NULL
  GROUP BY pm.product_id, pm.product_name, pm.product_code, pm.uom
)

SELECT
  COALESCE(t.product_id, a.product_id)       AS product_id,
  COALESCE(t.product_name, a.product_name)   AS product_name,
  COALESCE(t.product_code, a.product_code)   AS product_code,
  COALESCE(t.uom, a.uom)                     AS uom,
  COALESCE(t.theoretical_qty, 0)             AS theoretical_qty,
  COALESCE(a.actual_qty, 0)                  AS actual_qty,
  COALESCE(a.waste_qty, 0)                   AS waste_qty,
  -- Variance: positif = pakai lebih banyak dari seharusnya
  COALESCE(a.actual_qty, 0) - COALESCE(t.theoretical_qty, 0)  AS variance_qty,
  CASE
    WHEN COALESCE(t.theoretical_qty, 0) > 0
    THEN ROUND(
      (COALESCE(a.actual_qty, 0) - t.theoretical_qty) / t.theoretical_qty * 100,
      2
    )
    ELSE NULL                                  -- NULL jika tidak ada theoretical (bukan 0%)
  END AS variance_pct
FROM theoretical t
FULL OUTER JOIN actual a USING (product_id)
ORDER BY ABS(COALESCE(a.actual_qty, 0) - COALESCE(t.theoretical_qty, 0)) DESC
```

> **Parameter summary:**
> - `$1` = period_start (DATE)
> - `$2` = period_end (DATE)
> - `$3` = branch_pos_id (INT) — untuk theoretical query (tr_saleshead)
> - `$4` = branch_uuid (UUID) — untuk actual query (production_orders)
>
> Backend resolve keduanya dari 1 UUID input user via `resolveBranchIds()`.
> Jika user pilih "Semua Cabang", hapus kedua filter branch dari query.

### Interpretasi Variance

| Variance | Artinya | Kemungkinan Penyebab |
|----------|---------|---------------------|
| `actual > theoretical` (positif) | Pakai lebih banyak dari seharusnya | Waste tidak tercatat, porsi kebesaran, resep tidak akurat |
| `actual < theoretical` (negatif) | Pakai lebih sedikit dari seharusnya | Porsi dikurangi, production order belum di-input semua |
| Variance ≤ 5% | Normal | Operasi sesuai standar |
| Variance 5–15% | Warning ⚠️ | Perlu investigasi |
| Variance > 15% | Critical 🔴 | Tindakan segera |

---

## Coverage Query

```sql
-- Menu yang terjual tapi belum punya recipe
-- Diurutkan dari paling banyak terjual (prioritas tertinggi untuk dibuatkan resep)
SELECT
  sm.menu_id                         AS pos_menu_id,
  COALESCE(m.menu_name, sm.custom_menu_name, 'Unknown #' || sm.menu_id::text) AS menu_name,
  COALESCE(m.menu_code, '')          AS menu_code,
  SUM(sm.qty)                        AS total_qty_sold,
  COUNT(DISTINCT sh.sales_date)      AS days_sold,
  CASE
    WHEN SUM(sm.qty) > 100 THEN 'high'
    WHEN SUM(sm.qty) > 20  THEN 'medium'
    ELSE                        'low'
  END                                AS priority
FROM tr_salesmenu sm
JOIN tr_saleshead sh ON sh.sales_num = sm.sales_num
LEFT JOIN menus m ON m.pos_menu_id = sm.menu_id
  AND m.deleted_at IS NULL
WHERE sm.status_id = 13
  AND sh.sales_date BETWEEN $1 AND $2
  AND (m.has_recipe = false OR m.id IS NULL)   -- tanpa recipe
GROUP BY sm.menu_id, m.menu_name, sm.custom_menu_name, m.menu_code
ORDER BY total_qty_sold DESC
```

### Coverage Priority Thresholds

| Priority | Total Terjual | Label UI |
|----------|--------------|----------|
| 🔴 High | > 100 porsi | Segera buatkan resep |
| 🟡 Medium | 21–100 porsi | Perlu perhatian |
| 🟢 Low | ≤ 20 porsi | Bisa ditunda |


---

## Performance

### Kondisi Saat Ini

Data aktual: ~103K rows `tr_salesmenu` (3 bulan, 7 cabang).
Query join 6–7 tabel dengan GROUP BY — estimated acceptable untuk volume ini.

### Monitoring Threshold

Evaluasi optimasi jika:
- Response time > 3 detik untuk range 1 bulan
- Data `tr_salesmenu` > 500K rows
- Concurrent users > 10 hitting endpoint ini bersamaan

### Opsi Optimasi (jika threshold tercapai)

1. **Materialized view** untuk theoretical per hari per menu — di-refresh nightly
2. **Partial index** di `tr_salesmenu(status_id)` untuk filter `status_id = 13`
3. **Date-based partitioning** di `tr_salesmenu` jika data tumbuh besar

Untuk sekarang: query langsung tanpa cache.

---

## Backend Implementation

### Tidak Perlu Tabel Baru

Theoretical consumption adalah computed report — tidak perlu persist ke database.
Query langsung dari existing tables setiap kali request.

### Module Structure

```
backend/src/modules/food-production/theoretical-consumption/
├── theoretical-consumption.types.ts      # Interface + enums
├── theoretical-consumption.schema.ts     # Query param validation
├── theoretical-consumption.repository.ts # 3 queries: theoretical, variance, coverage
├── theoretical-consumption.service.ts    # Business logic + branch resolver
├── theoretical-consumption.controller.ts # Request/response
└── theoretical-consumption.routes.ts     # Routes + permission middleware
```

Tidak perlu `errors.ts` — module ini read-only, tidak ada state mutation.

### Endpoints

| Method | Path | Fungsi |
|--------|------|--------|
| GET | `/api/v1/theoretical-consumption` | Theoretical per periode + branch |
| GET | `/api/v1/theoretical-consumption/variance` | Actual vs theoretical |
| GET | `/api/v1/theoretical-consumption/coverage` | Menu tanpa recipe yang terjual |

### Query Parameters (semua endpoint)

```
?period_start=2026-05-01    (required, DATE)
&period_end=2026-05-31      (required, DATE)
&branch_id=uuid             (optional, UUID — backend resolve ke pos_id)
```

Frontend **selalu kirim UUID**. Jika `branch_id` tidak ada → query semua cabang.

### Types Reference

```typescript
// theoretical-consumption.types.ts

export interface TheoreticalConsumptionItem {
  product_id: string
  product_name: string
  product_code: string
  uom: string
  theoretical_qty: number
  theoretical_cost: number
}

export interface VarianceItem {
  product_id: string
  product_name: string
  product_code: string
  uom: string
  theoretical_qty: number
  actual_qty: number
  waste_qty: number
  variance_qty: number
  variance_pct: number | null   // null jika tidak ada theoretical
  severity: 'normal' | 'warning' | 'critical'
}

export interface CoverageItem {
  pos_menu_id: number
  menu_name: string
  menu_code: string
  total_qty_sold: number
  days_sold: number
  priority: 'high' | 'medium' | 'low'
}

export interface CoverageSummary {
  total_menus_sold: number     // unique menu yang terjual di periode
  menus_with_recipe: number
  menus_without_recipe: number
  coverage_pct: number
  items: CoverageItem[]
}

export interface TheoreticalConsumptionQuery {
  period_start: string
  period_end: string
  branch_id?: string           // UUID, optional
}
```

### Severity Logic (di service layer)

```typescript
function getSeverity(variancePct: number | null): 'normal' | 'warning' | 'critical' {
  if (variancePct === null) return 'normal'
  const abs = Math.abs(variancePct)
  if (abs > 15) return 'critical'
  if (abs > 5)  return 'warning'
  return 'normal'
}
```

---

## Frontend

### Lokasi & Routing

Halaman terpisah dari Production Order:

| Path | Page |
|------|------|
| `/food-production/consumption` | TheoreticalConsumptionPage |

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Analisa Konsumsi Bahan                                           │
├─────────────────────────────────────────────────────────────────┤
│ Periode: [01-Mei-2026] s/d [31-Mei-2026]  Cabang: [Semua ▼]    │
│                                                                  │
│ [Theoretical]  [Variance]  [Coverage]                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ── Tab: Theoretical ──────────────────────────────────────────  │
│                                                                  │
│ ⚠️ Coverage: 1/281 menu punya resep (0.4%).                      │
│    Hasil hanya mencerminkan menu yang sudah memiliki resep.      │
│                                                                  │
│ ┌────────────┬──────────┬──────────┬──────────────┐             │
│ │ Bahan      │ Qty      │ UOM      │ Est. Cost    │             │
│ │ Black Tea  │ 450      │ Pcs      │ Rp 197.982   │             │
│ │ Avocado Pw │ 4.500    │ Gram     │ Rp 360.000   │             │
│ └────────────┴──────────┴──────────┴──────────────┘             │
│                                         [Export CSV]             │
│                                                                  │
│ ── Tab: Variance ─────────────────────────────────────────────  │
│                                                                  │
│ [Empty state jika belum ada Production Order]                    │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │  📊                                                          │ │
│ │  Data actual belum tersedia.                                  │ │
│ │  Variance akan tampil setelah Production Order               │ │
│ │  untuk periode ini di-complete.                               │ │
│ │  → Buat Production Order                                     │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ [Normal state: ada data actual]                                  │
│ ┌────────────┬──────────┬──────────┬──────────┬───────────────┐ │
│ │ Bahan      │ Theoret. │ Actual   │ Variance │ %             │ │
│ │ Black Tea  │ 450 pcs  │ 470 pcs  │ +20      │ +4.4% ✓      │ │
│ │ Avocado Pw │ 4.500 gr │ 5.300 gr │ +800     │ +17.8% 🔴    │ │
│ │ Kecap      │ 200 ml   │ 190 ml   │ -10      │ -5.0% ⚠️     │ │
│ └────────────┴──────────┴──────────┴──────────┴───────────────┘ │
│                                         [Export CSV]             │
│                                                                  │
│ ── Tab: Coverage ─────────────────────────────────────────────  │
│                                                                  │
│ 📊 Coverage: 1/281 menu (0.4%)  ████░░░░░░░░░░░░░░░░░░         │
│                                                                  │
│ Menu tanpa resep yang terjual di periode ini:                    │
│ ┌────────────────────┬──────────┬──────────┬────────────────┐   │
│ │ Menu               │ Terjual  │ Hari     │ Prioritas      │   │
│ │ Salmon Sashimi     │ 1.200    │ 31       │ 🔴 Segera      │   │
│ │ Ocha               │ 980      │ 30       │ 🔴 Segera      │   │
│ │ Extra Shoyu        │ 50       │ 12       │ 🟡 Perhatian   │   │
│ │ Onigiri            │ 15       │ 5        │ 🟢 Tunda       │   │
│ └────────────────────┴──────────┴──────────┴────────────────┘   │
│                                         [Export CSV]             │
└─────────────────────────────────────────────────────────────────┘
```

### Variance Color Coding

| Kondisi | Warna | Icon |
|---------|-------|------|
| variance_pct ≤ 5% | Hijau | ✓ |
| 5% < variance_pct ≤ 15% | Kuning | ⚠️ |
| variance_pct > 15% | Merah | 🔴 |
| variance_pct = null | Abu-abu | — |

### Empty States

| Kondisi | Pesan |
|---------|-------|
| Tidak ada data theoretical | "Tidak ada menu dengan resep yang terjual di periode ini." |
| Tidak ada data actual (variance tab) | "Data actual belum tersedia. Variance akan tampil setelah Production Order untuk periode ini di-complete." + link ke halaman Production Order |
| Tidak ada menu tanpa resep (coverage) | "Semua menu yang terjual sudah memiliki resep. ✅" |

---

## Catatan Penting

### 1. `status_id` Filter — Confirmed dari Data Aktual

```sql
-- BENAR:
WHERE sm.status_id = 13    -- hanya valid sale

-- SALAH (asumsi lama):
WHERE sm.status_id != 2    -- tidak akurat
```

Data aktual: 102.980 rows status 13, 234 rows status 19 (void/cancel).

### 2. `NULLIF` Guard untuk yield_qty = 0

```sql
/ NULLIF(wip.yield_qty, 0)
```

Jika `wip_items.yield_qty = 0` (data error), hasilnya NULL bukan division by zero.
NULL akan di-propagate dan excluded dari SUM (SUM ignores NULL).

### 3. Recipe Coverage Rendah

Saat ini 1/281 menu punya recipe. Theoretical consumption sangat tidak akurat
sampai coverage meningkat. **Setiap tab harus menampilkan coverage disclaimer.**

### 4. Variance Hanya Bermakna Jika Coverage Tinggi

Jika coverage < 50%, variance tab sebaiknya menampilkan warning tambahan:
"Coverage resep masih rendah — variance mungkin tidak representatif."

### 5. UNION ALL Double-Count Prevention

Jika 1 product muncul di **kedua path** (langsung di recipe DAN via WIP ingredients),
UNION ALL akan menghasilkan 2 rows untuk product yang sama. Outer `GROUP BY product_id`
di final CTE akan SUM keduanya — ini **correct behavior** karena memang product itu
dipakai dari 2 sumber berbeda.

---

## Relasi dengan Module Lain

```
tr_salesmenu + tr_saleshead (POS sales data)
    │
    ├── menus (pos_menu_id → internal menu)
    │     │
    │     ├── recipe_lines → products (bahan baku langsung)
    │     │
    │     └── recipe_lines → wip_items → wip_ingredients → products
    │
    ▼
Theoretical Consumption (computed, not stored)
    │
    ├── Compare dengan: production_order_materials (actual)
    │     └── Requires: production_orders status IN ('COMPLETED', 'JOURNALED')
    │
    └── Output:
          ├── Theoretical tab  → berapa seharusnya terpakai
          ├── Variance tab     → selisih actual vs theoretical
          └── Coverage tab     → menu mana yang perlu dibuatkan resep
```

---

## Urutan Implementasi

| Step | Apa | Dependency |
|------|-----|------------|
| 1 | Types + schema | — |
| 2 | Repository: theoretical query | — |
| 3 | Repository: coverage query | — |
| 4 | Repository: variance query | Production Order module harus ada |
| 5 | Service + branch resolver | Step 2–4 |
| 6 | Controller + routes | Step 5 |
| 7 | Frontend: TheoreticalConsumptionPage (Theoretical + Coverage tab) | Step 6 |
| 8 | Frontend: Variance tab | Step 7 + Production Order data ada |

Theoretical dan Coverage tab bisa dibangun dan digunakan tanpa Production Order.
Variance tab baru bermakna setelah Production Order ada datanya.

---

## Permission

```typescript
PermissionService.registerModule('consumption_analysis', 'Analisa Konsumsi Bahan')
// Actions: canView (read-only — tidak ada insert/update/delete)
```
