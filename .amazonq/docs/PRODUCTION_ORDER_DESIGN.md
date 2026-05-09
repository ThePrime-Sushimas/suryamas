# Production Order / Daily Production — Design Document

> **Revisi:** Semua fixes dari code review sudah diapply:
> - FK `auth_users` → diganti UUID plain (no FK) konsisten dengan sistem
> - COA query filter by `company_id` (bukan assume single row)
> - `superseded_by` dihapus (tidak ada flow konkret)
> - `waste_qty` CHECK constraint ditambah di DB level
> - Index `production_line_id` ditambah
> - Daily summary query diperbaiki (no double-count)
> - Void + reverse journal flow didokumentasikan lengkap
> - `sort_order` tiebreaker dengan `created_at`

---

## Tujuan

Mencatat produksi harian per cabang — WIP apa yang diproduksi, berapa batch, bahan apa
saja yang terpakai, dan berapa waste-nya. Generate jurnal otomatis untuk perpindahan
inventory (Bahan Baku → Barang Dalam Proses).

---

## Prinsip Desain

1. **No approval flow** — langsung DRAFT → COMPLETED → JOURNALED
2. **Multiple WIP per order** — 1 order bisa isi beberapa WIP sekaligus
3. **Waste per bahan** — tracking waste di level material, bukan di level WIP line
4. **Snapshot cost saat create** — cost di-freeze dari `wip_ingredients.cost_per_unit`
   (primary) atau `products.average_cost` (fallback)
5. **App-calculated totals** — tidak pakai GENERATED COLUMN, hitung di service layer
6. **UUID plain untuk user references** — tidak pakai FK ke tabel users (konsisten dengan
   pola di sistem: `created_by`, `updated_by` di tabel lain juga UUID tanpa FK)
7. **COA selalu filter by `company_id`** — ada 2 row per account_code (multi-company),
   harus eksplisit filter

---

## Database Tables

### 1. `production_orders` — Header

```sql
CREATE TABLE production_orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id),
  branch_id           UUID NOT NULL REFERENCES branches(id),
  order_number        VARCHAR(30) NOT NULL,
  production_date     DATE NOT NULL,
  status              VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                        CHECK (status IN ('DRAFT', 'COMPLETED', 'JOURNALED', 'VOID')),
  total_material_cost NUMERIC(20,4) NOT NULL DEFAULT 0,
  total_waste_cost    NUMERIC(20,4) NOT NULL DEFAULT 0,
  notes               TEXT,

  -- User references: UUID plain, no FK (konsisten dengan pola sistem)
  completed_by        UUID,
  completed_at        TIMESTAMPTZ,
  voided_by           UUID,
  voided_at           TIMESTAMPTZ,
  void_reason         TEXT,

  -- Journal link
  journal_id          UUID REFERENCES journal_headers(id),

  -- Soft delete
  is_deleted          BOOLEAN NOT NULL DEFAULT false,
  deleted_at          TIMESTAMPTZ,
  deleted_by          UUID,

  -- Audit
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID,
  updated_by          UUID,

  UNIQUE(company_id, order_number)
);

CREATE INDEX idx_production_orders_company
  ON production_orders(company_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_production_orders_branch_date
  ON production_orders(branch_id, production_date)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_production_orders_status
  ON production_orders(status)
  WHERE deleted_at IS NULL;
```

> **Catatan:** `superseded_by` dihapus — tidak ada flow konkret yang membutuhkannya.
> Jika nanti ada kebutuhan revisi order, bisa ditambah saat itu.

---

### 2. `production_order_lines` — WIP per order

```sql
CREATE TABLE production_order_lines (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id   UUID NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  wip_id                UUID NOT NULL REFERENCES wip_items(id),

  -- Snapshot dari wip_items (di-freeze saat create)
  wip_name              VARCHAR(150) NOT NULL,
  wip_code              VARCHAR(50) NOT NULL,
  yield_per_batch       NUMERIC(20,4) NOT NULL,
  uom                   VARCHAR(20) NOT NULL,
  cost_per_batch        NUMERIC(20,4) NOT NULL,

  -- Planned (diisi saat create)
  planned_batch_qty     NUMERIC(20,4) NOT NULL,

  -- Actual (diisi saat complete)
  actual_batch_qty      NUMERIC(20,4),
  total_yield           NUMERIC(20,4),   -- app-calculated: actual_batch_qty × yield_per_batch
  total_cost            NUMERIC(20,4),   -- app-calculated: actual_batch_qty × cost_per_batch

  -- Ordering: sort_order eksplisit, tiebreaker created_at
  sort_order            INT NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index untuk query by order
CREATE INDEX idx_prod_lines_order
  ON production_order_lines(production_order_id);

-- Index untuk ordering yang konsisten
CREATE INDEX idx_prod_lines_order_sort
  ON production_order_lines(production_order_id, sort_order, created_at);
```

---

### 3. `production_order_materials` — Bahan baku terpakai

```sql
CREATE TABLE production_order_materials (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id   UUID NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  production_line_id    UUID NOT NULL REFERENCES production_order_lines(id) ON DELETE CASCADE,
  product_id            UUID NOT NULL REFERENCES products(id),

  -- Snapshot dari products (di-freeze saat create)
  product_name          VARCHAR(150) NOT NULL,
  product_code          VARCHAR(50) NOT NULL,

  -- Planned (diisi saat create, dari wip_ingredients × planned_batch)
  planned_qty           NUMERIC(20,4) NOT NULL,

  -- Actual (diisi saat complete, default = planned × actual_ratio)
  actual_qty            NUMERIC(20,4),
  total_cost            NUMERIC(20,4),   -- app-calculated: actual_qty × cost_per_unit

  uom                   VARCHAR(20) NOT NULL,

  -- Cost snapshot
  cost_per_unit         NUMERIC(20,4) NOT NULL,
  cost_source           VARCHAR(20) NOT NULL DEFAULT 'wip_ingredient'
                          CHECK (cost_source IN ('wip_ingredient', 'average_cost')),

  -- Waste per bahan
  waste_qty             NUMERIC(20,4) NOT NULL DEFAULT 0,
  waste_reason          TEXT,

  -- DB-level safety: waste tidak boleh melebihi actual (atau planned jika actual belum diisi)
  CONSTRAINT chk_waste_not_exceed_actual
    CHECK (waste_qty <= COALESCE(actual_qty, planned_qty)),

  sort_order            INT NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index untuk query by order (paling sering)
CREATE INDEX idx_prod_materials_order
  ON production_order_materials(production_order_id);

-- Index untuk query by line (join saat load detail)
CREATE INDEX idx_prod_materials_line
  ON production_order_materials(production_line_id);

-- Index untuk aggregate report per produk
CREATE INDEX idx_prod_materials_product
  ON production_order_materials(product_id);
```

---

## Kolom Explanation

### Snapshot Fields (di-freeze saat create)

| Field | Source | Kenapa Snapshot |
|-------|--------|-----------------|
| `lines.wip_name` | `wip_items.wip_name` | WIP bisa di-rename |
| `lines.wip_code` | `wip_items.wip_code` | Identifier stability |
| `lines.yield_per_batch` | `wip_items.yield_qty` | Yield bisa berubah |
| `lines.cost_per_batch` | `wip_items.estimated_cost` | Cost berubah saat recalculate |
| `materials.product_name` | `products.product_name` | Product bisa di-rename |
| `materials.product_code` | `products.product_code` | Identifier stability |
| `materials.cost_per_unit` | `wip_ingredients.cost_per_unit` atau `products.average_cost` | Cost berubah |

### cost_source

| Value | Source | Kapan Dipakai |
|-------|--------|---------------|
| `wip_ingredient` | `wip_ingredients.cost_per_unit` | Default — ini yang di-maintain manual |
| `average_cost` | `products.average_cost` | Fallback jika `wip_ingredients.cost_per_unit = 0` |

---

## Status Flow

```
DRAFT ──────→ COMPLETED ──────→ JOURNALED
  │               │                  │
  ↓               ↓                  ↓
VOID            VOID              VOID
                                (+ reverse journal)
```

| Status | Bisa Edit | Bisa Delete | Generate Journal | Void |
|--------|-----------|-------------|------------------|------|
| DRAFT | ✅ planned qty, tambah/hapus line | ✅ soft delete | ❌ | ✅ |
| COMPLETED | ❌ | ❌ | ✅ | ✅ |
| JOURNALED | ❌ | ❌ | ❌ (sudah ada) | ✅ (+ reverse) |
| VOID | ❌ | ❌ | ❌ | ❌ |

---

## order_number Strategy

Format: `PRD-{BRANCH_CODE}-YYYYMMDD-XXX`

Contoh: `PRD-DPK-20250620-001`

```typescript
async generateOrderNumber(
  companyId: string,
  branchId: string,
  date: Date
): Promise<string> {
  const branch = await getBranch(branchId)
  const dateStr = formatDate(date, 'YYYYMMDD')
  const prefix = `PRD-${branch.branch_code}-${dateStr}`

  const { rows } = await pool.query(`
    SELECT order_number
    FROM production_orders
    WHERE company_id = $1
      AND order_number LIKE $2
    ORDER BY order_number DESC
    LIMIT 1
  `, [companyId, `${prefix}-%`])

  const lastSeq = rows.length > 0
    ? parseInt(rows[0].order_number.split('-').pop() || '0')
    : 0

  return `${prefix}-${String(lastSeq + 1).padStart(3, '0')}`
}
```

Collision handling: `UNIQUE(company_id, order_number)` + retry max 3x dengan increment.

---

## Create Flow (Detail)

### User Input
- Pilih branch
- Pilih tanggal produksi
- Tambah WIP lines: pilih WIP + planned batch qty

### System Auto-Calculate

```typescript
async createProductionOrder(dto: CreateProductionOrderDto): Promise<ProductionOrder> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 1. Generate order number (dengan retry on collision)
    let orderNumber: string
    let attempt = 0
    while (attempt < 3) {
      try {
        orderNumber = await generateOrderNumber(dto.company_id, dto.branch_id, dto.production_date)
        break
      } catch (e) {
        if (e.code === '23505') { attempt++; continue } // unique violation
        throw e
      }
    }

    // 2. Insert header
    const order = await insertHeader(client, { ...dto, order_number: orderNumber, status: 'DRAFT' })

    // 3. For each WIP line
    for (let i = 0; i < dto.lines.length; i++) {
      const lineDto = dto.lines[i]
      const wip = await getWipWithIngredients(lineDto.wip_id)

      const lineRecord = await insertLine(client, {
        production_order_id: order.id,
        wip_id: wip.id,
        wip_name: wip.wip_name,           // snapshot
        wip_code: wip.wip_code,           // snapshot
        yield_per_batch: wip.yield_qty,   // snapshot
        uom: wip.uom,                     // snapshot
        cost_per_batch: wip.estimated_cost, // snapshot
        planned_batch_qty: lineDto.planned_batch_qty,
        sort_order: i,
      })

      // 4. Explode ingredients → materials (planned qty = ingredient qty × batch)
      for (let j = 0; j < wip.ingredients.length; j++) {
        const ingredient = wip.ingredients[j]
        const product = await getProduct(ingredient.product_id)

        const costPerUnit = ingredient.cost_per_unit > 0
          ? ingredient.cost_per_unit
          : product.average_cost
        const costSource = ingredient.cost_per_unit > 0
          ? 'wip_ingredient'
          : 'average_cost'

        await insertMaterial(client, {
          production_order_id: order.id,
          production_line_id: lineRecord.id,
          product_id: ingredient.product_id,
          product_name: product.product_name,   // snapshot
          product_code: product.product_code,   // snapshot
          planned_qty: ingredient.qty * lineDto.planned_batch_qty,
          uom: ingredient.uom,
          cost_per_unit: costPerUnit,            // snapshot
          cost_source: costSource,
          sort_order: j,
        })
      }
    }

    await client.query('COMMIT')
    return order
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}
```

---

## Complete Flow (Detail)

### User Input
- Per WIP line: `actual_batch_qty` (default = planned)
- Per material: `actual_qty` (default = planned × actual_ratio) + `waste_qty` + `waste_reason`

### Validation
- `actual_batch_qty >= 0`
- `actual_qty >= 0`
- `waste_qty <= actual_qty` (juga di-enforce CHECK constraint di DB)
- Order harus status `DRAFT`

### System Calculate

```typescript
async completeOrder(orderId: string, dto: CompleteProductionOrderDto): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const order = await getOrder(orderId)
    if (order.status !== 'DRAFT') throw new ProductionOrderError('ORDER_NOT_DRAFT')

    let totalMaterialCost = 0
    let totalWasteCost = 0

    for (const lineDto of dto.lines) {
      const line = await getLine(lineDto.id)
      const actualBatch = lineDto.actual_batch_qty

      // Hitung dari snapshot (bukan dari WIP current)
      const totalYield = actualBatch * line.yield_per_batch
      const totalLineCost = actualBatch * line.cost_per_batch

      await updateLine(client, line.id, {
        actual_batch_qty: actualBatch,
        total_yield: totalYield,
        total_cost: totalLineCost,
      })

      for (const matDto of lineDto.materials) {
        const mat = await getMaterial(matDto.id)
        const actualQty = matDto.actual_qty
        const wasteQty = matDto.waste_qty ?? 0

        // Validasi waste di app layer (DB juga enforce via CHECK)
        if (wasteQty > actualQty) {
          throw new ProductionOrderError('WASTE_EXCEEDS_ACTUAL', {
            product: mat.product_name,
            wasteQty,
            actualQty,
          })
        }

        // Cost pakai snapshot cost_per_unit (bukan ambil ulang dari produk)
        const totalCost = actualQty * mat.cost_per_unit
        const wasteCost = wasteQty * mat.cost_per_unit

        await updateMaterial(client, mat.id, {
          actual_qty: actualQty,
          waste_qty: wasteQty,
          waste_reason: matDto.waste_reason ?? null,
          total_cost: totalCost,
        })

        totalMaterialCost += totalCost
        totalWasteCost += wasteCost
      }
    }

    await updateHeader(client, orderId, {
      status: 'COMPLETED',
      total_material_cost: totalMaterialCost,
      total_waste_cost: totalWasteCost,
      completed_by: dto.user_id,
      completed_at: new Date(),
    })

    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}
```

---

## Journal Entry

### Trigger
- Manual: user klik "Generate Journal" setelah status `COMPLETED`
- Pre-condition: fiscal period untuk `production_date` harus `is_open = true`

### COA Query (selalu filter by company_id)

```typescript
// ⚠️ Ada 2 row per account_code (multi-company) — WAJIB filter company_id
async function getCOAByCode(companyId: string, accountCode: string) {
  const { rows } = await pool.query(`
    SELECT id, account_name FROM chart_of_accounts
    WHERE company_id = $1 AND account_code = $2
    LIMIT 1
  `, [companyId, accountCode])

  if (!rows.length) throw new Error(`COA ${accountCode} not found for company ${companyId}`)
  return rows[0]
}

// Akun yang dipakai:
// 110501 → Bahan Baku (CREDIT)
// 110502 → Barang Dalam Proses (DEBIT)
// 510301 → Selisih HPP (DEBIT, hanya jika waste > 0)
```

### Entry Pattern

```
Kondisi Normal (waste = 0):
  DEBIT  110502 Barang Dalam Proses     = total_material_cost
  CREDIT 110501 Bahan Baku              = total_material_cost

Kondisi Ada Waste:
  DEBIT  110502 Barang Dalam Proses     = total_material_cost - total_waste_cost
  DEBIT  510301 Selisih HPP             = total_waste_cost
  CREDIT 110501 Bahan Baku              = total_material_cost
```

### Journal Metadata

```typescript
const journalHeader = {
  company_id: order.company_id,
  branch_id: order.branch_id,
  journal_date: order.production_date,
  journal_type: 'GENERAL',
  source_module: 'food_production',
  reference_type: 'production_order',
  reference_id: order.id,
  reference_number: order.order_number,
  description: `Produksi ${formatDate(order.production_date)} - ${branch.branch_name}`,
  status: 'POSTED',       // langsung posted (system-generated)
  is_auto: true,
}
```

---

## Void Flow (Lengkap)

### Kasus 1: Void dari DRAFT atau COMPLETED (belum ada jurnal)

```typescript
async voidOrder(orderId: string, dto: VoidDto): Promise<void> {
  // Validasi
  if (!['DRAFT', 'COMPLETED'].includes(order.status)) {
    throw new ProductionOrderError('CANNOT_VOID_FROM_STATUS', { status: order.status })
  }

  // Update header saja, tidak perlu reverse journal
  await updateHeader(client, orderId, {
    status: 'VOID',
    voided_by: dto.user_id,
    voided_at: new Date(),
    void_reason: dto.reason,
  })
}
```

### Kasus 2: Void dari JOURNALED (sudah ada jurnal)

```typescript
async voidOrder(orderId: string, dto: VoidDto): Promise<void> {
  // Validasi
  if (order.status !== 'JOURNALED') throw new ProductionOrderError('ORDER_NOT_JOURNALED')

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 1. Buat reversal journal (debit ↔ credit dibalik)
    const originalJournal = await getJournal(order.journal_id)
    const reversalJournal = await insertJournal(client, {
      ...journalMetadata,
      description: `[REVERSAL] ${originalJournal.description}`,
      lines: originalJournal.lines.map(line => ({
        ...line,
        debit: line.credit,   // swap
        credit: line.debit,   // swap
      })),
    })

    // 2. Mark original journal sebagai reversed
    await updateJournal(client, order.journal_id, {
      is_reversed: true,
      reversed_by_journal_id: reversalJournal.id,
      reversal_date: new Date(),
      reversal_reason: dto.reason,
    })

    // 3. Update production order
    await updateHeader(client, orderId, {
      status: 'VOID',
      voided_by: dto.user_id,
      voided_at: new Date(),
      void_reason: dto.reason,
    })

    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}
```

---

## Report Queries

### Akumulasi Bahan Terpakai per Periode

```sql
-- Tidak ada ambiguity, query langsung dari materials
SELECT
  pm.product_id,
  pm.product_name,
  pm.product_code,
  pm.uom,
  SUM(pm.actual_qty)                    AS total_used,
  SUM(pm.waste_qty)                     AS total_waste,
  SUM(pm.total_cost)                    AS total_cost,
  SUM(pm.waste_qty * pm.cost_per_unit)  AS total_waste_cost
FROM production_order_materials pm
JOIN production_orders po ON po.id = pm.production_order_id
WHERE po.company_id = $1
  AND po.branch_id = $2          -- optional, hapus jika semua cabang
  AND po.production_date BETWEEN $3 AND $4
  AND po.status IN ('COMPLETED', 'JOURNALED')
  AND po.deleted_at IS NULL
GROUP BY pm.product_id, pm.product_name, pm.product_code, pm.uom
ORDER BY total_cost DESC
```

### Daily Summary (FIXED — no double-count)

```sql
-- ⚠️ FIX: total_batches dihitung di subquery terpisah dari total_cost
-- Jika join langsung ke lines, total_cost dari header akan ter-multiply per line

SELECT
  po.production_date,
  po.branch_id,
  b.branch_name,
  COUNT(DISTINCT po.id)                         AS order_count,
  COALESCE(lines_agg.total_batches, 0)          AS total_batches,
  SUM(po.total_material_cost)                   AS total_cost,
  SUM(po.total_waste_cost)                      AS total_waste_cost
FROM production_orders po
JOIN branches b ON b.id = po.branch_id
LEFT JOIN (
  -- Aggregate lines terpisah untuk hindari double-count di header
  SELECT
    production_order_id,
    SUM(actual_batch_qty) AS total_batches
  FROM production_order_lines
  GROUP BY production_order_id
) lines_agg ON lines_agg.production_order_id = po.id
WHERE po.company_id = $1
  AND po.production_date BETWEEN $2 AND $3
  AND po.status IN ('COMPLETED', 'JOURNALED')
  AND po.deleted_at IS NULL
GROUP BY po.production_date, po.branch_id, b.branch_name, lines_agg.total_batches
ORDER BY po.production_date DESC, b.branch_name
```

---

## Backend Module Structure

```
backend/src/modules/food-production/production-orders/
├── production-orders.types.ts       # Interface: ProductionOrder, ProductionOrderLine, ...
├── production-orders.errors.ts      # Error codes: ORDER_NOT_DRAFT, WASTE_EXCEEDS_ACTUAL, ...
├── production-orders.schema.ts      # Zod/Joi validation schema
├── production-orders.repository.ts  # DB queries (insert, update, get, list, reports)
├── production-orders.service.ts     # Business logic (create, complete, journal, void)
├── production-orders.controller.ts  # Request/response handling
└── production-orders.routes.ts      # Route definitions + permission middleware
```

### Types Reference

```typescript
// production-orders.types.ts

export type ProductionOrderStatus = 'DRAFT' | 'COMPLETED' | 'JOURNALED' | 'VOID'
export type CostSource = 'wip_ingredient' | 'average_cost'

export interface ProductionOrder {
  id: string
  company_id: string
  branch_id: string
  order_number: string
  production_date: string           // DATE → ISO string
  status: ProductionOrderStatus
  total_material_cost: number
  total_waste_cost: number
  notes: string | null
  completed_by: string | null       // UUID, no FK
  completed_at: string | null
  voided_by: string | null
  voided_at: string | null
  void_reason: string | null
  journal_id: string | null
  is_deleted: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export interface ProductionOrderLine {
  id: string
  production_order_id: string
  wip_id: string
  wip_name: string
  wip_code: string
  planned_batch_qty: number
  actual_batch_qty: number | null
  yield_per_batch: number
  uom: string
  total_yield: number | null
  cost_per_batch: number
  total_cost: number | null
  sort_order: number
  created_at: string
}

export interface ProductionOrderMaterial {
  id: string
  production_order_id: string
  production_line_id: string
  product_id: string
  product_name: string
  product_code: string
  planned_qty: number
  actual_qty: number | null
  total_cost: number | null
  uom: string
  cost_per_unit: number
  cost_source: CostSource
  waste_qty: number
  waste_reason: string | null
  sort_order: number
  created_at: string
}

export interface ProductionOrderWithDetails extends ProductionOrder {
  lines: (ProductionOrderLine & { materials: ProductionOrderMaterial[] })[]
}

// DTOs
export interface CreateProductionOrderLineDto {
  wip_id: string
  planned_batch_qty: number
}

export interface CreateProductionOrderDto {
  company_id: string
  branch_id: string
  production_date: string
  notes?: string
  created_by?: string
  lines: CreateProductionOrderLineDto[]
}

export interface CompleteMaterialDto {
  id: string
  actual_qty: number
  waste_qty?: number
  waste_reason?: string
}

export interface CompleteLineDto {
  id: string
  actual_batch_qty: number
  materials: CompleteMaterialDto[]
}

export interface CompleteProductionOrderDto {
  user_id: string
  lines: CompleteLineDto[]
}

export interface VoidProductionOrderDto {
  user_id: string
  reason: string
}

// Report types
export interface MaterialUsageSummary {
  product_id: string
  product_name: string
  product_code: string
  uom: string
  total_used: number
  total_waste: number
  total_cost: number
  total_waste_cost: number
}

export interface DailySummary {
  production_date: string
  branch_id: string
  branch_name: string
  order_count: number
  total_batches: number
  total_cost: number
  total_waste_cost: number
}
```

### Error Codes

```typescript
// production-orders.errors.ts

export const PRODUCTION_ORDER_ERRORS = {
  ORDER_NOT_FOUND: 'Production order tidak ditemukan',
  ORDER_NOT_DRAFT: 'Order harus berstatus DRAFT untuk operasi ini',
  ORDER_NOT_COMPLETED: 'Order harus berstatus COMPLETED untuk generate jurnal',
  ORDER_NOT_VOIDABLE: 'Order berstatus VOID tidak bisa di-void lagi',
  WASTE_EXCEEDS_ACTUAL: 'Waste tidak boleh melebihi actual qty',
  FISCAL_PERIOD_CLOSED: 'Periode fiskal untuk tanggal produksi ini sudah ditutup',
  COA_NOT_FOUND: 'Akun COA tidak ditemukan untuk company ini',
  BRANCH_INACTIVE: 'Cabang tidak aktif, tidak bisa membuat production order',
  WIP_NO_INGREDIENTS: 'WIP tidak memiliki bahan baku (ingredients kosong)',
  ORDER_NUMBER_COLLISION: 'Gagal generate order number setelah 3 percobaan',
} as const

export type ProductionOrderErrorCode = keyof typeof PRODUCTION_ORDER_ERRORS
```

### Endpoints

| Method | Path | Fungsi | Permission |
|--------|------|--------|------------|
| GET | `/api/v1/production-orders` | List (filter: branch, date range, status) | canView |
| GET | `/api/v1/production-orders/summary` | Daily summary cards | canView |
| GET | `/api/v1/production-orders/materials-report` | Akumulasi bahan terpakai | canView |
| GET | `/api/v1/production-orders/:id` | Detail (with lines + materials) | canView |
| POST | `/api/v1/production-orders` | Create (DRAFT) | canInsert |
| PUT | `/api/v1/production-orders/:id` | Update planned (DRAFT only) | canUpdate |
| POST | `/api/v1/production-orders/:id/complete` | Complete (input actual + waste) | canUpdate |
| POST | `/api/v1/production-orders/:id/generate-journal` | Generate journal | canUpdate |
| POST | `/api/v1/production-orders/:id/void` | Void (+ reverse journal jika JOURNALED) | canDelete |
| DELETE | `/api/v1/production-orders/:id` | Soft delete (DRAFT only) | canDelete |

---

## Frontend Pages

```
frontend/src/features/food-production/pages/
├── ProductionOrdersPage.tsx        # List + Daily Summary + Pemakaian Bahan tab
├── ProductionOrderForm.tsx         # Create/Edit (DRAFT only)
└── ProductionOrderDetailPage.tsx   # View + Complete + Generate Journal + Void
```

### Routing

| Path | Page |
|------|------|
| `/food-production/production` | ProductionOrdersPage |
| `/food-production/production/new` | ProductionOrderForm |
| `/food-production/production/:id` | ProductionOrderDetailPage |

---

### ProductionOrdersPage — Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Produksi Harian                          [+ Buat Order Baru]    │
├─────────────────────────────────────────────────────────────────┤
│ Filter: [Hari ini ▼]  [Semua Cabang ▼]                          │
│                                                                  │
│ ┌──────────────┬──────────────┬──────────────┬────────────────┐ │
│ │ Total Order  │ Total Batch  │ Total Cost   │ Waste Cost     │ │
│ │ 3            │ 8            │ Rp 98.400    │ Rp 2.100       │ │
│ └──────────────┴──────────────┴──────────────┴────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ [Daftar Order]  [Pemakaian Bahan]                                │
│                                                                  │
│  Tab: Daftar Order                                               │
│  ┌──────────────┬────────────┬────────────┬────────┬─────────┐  │
│  │ No Order     │ Cabang     │ Tanggal    │ Status │ Cost    │  │
│  │ PRD-DPK-001  │ Depok      │ 20-Jun     │ DRAFT  │ 52.199  │  │
│  └──────────────┴────────────┴────────────┴────────┴─────────┘  │
│                                                                  │
│  Tab: Pemakaian Bahan                                            │
│  Periode: [01-Jun] s/d [30-Jun]    Cabang: [Semua ▼]            │
│  ┌──────────────┬──────────┬──────────┬──────────┬────────────┐ │
│  │ Bahan        │ Terpakai │ Waste    │ Cost     │ Waste Cost │ │
│  │ Black Tea    │ 900 pcs  │ 12 pcs   │ Rp 396K  │ Rp 5.280   │ │
│  └──────────────┴──────────┴──────────┴──────────┴────────────┘ │
│                                              [Export CSV]        │
└─────────────────────────────────────────────────────────────────┘
```

### ProductionOrderForm — Create

```
┌─────────────────────────────────────────────────────────────────┐
│ Buat Production Order                                            │
├─────────────────────────────────────────────────────────────────┤
│ Cabang: [Sushimas Depok ▼]        Tanggal: [2025-06-20]         │
│ Catatan: [                    ]                                  │
├─────────────────────────────────────────────────────────────────┤
│ WIP yang Diproduksi                                              │
│                                                                  │
│ ┌─────────────────────┬─────────┬──────────────┬─────────────┐  │
│ │ WIP                 │ Batch   │ Yield/Batch  │ Est. Cost   │  │
│ │ [Nasi Sushi ▼]      │ [3]     │ 1.000 Liter  │ Rp 12.400   │  │
│ │ [Saus Teriyaki ▼]   │ [2]     │ 500 ml       │ Rp 15.000   │  │
│ │ [+ Tambah WIP]      │         │              │             │  │
│ └─────────────────────┴─────────┴──────────────┴─────────────┘  │
│                                                                  │
│ ⚠️  Nasi Sushi: tidak memiliki bahan baku (warning saja)         │
│                                                                  │
│ Total Estimasi: Rp 52.199                                        │
│                                          [Batal]  [Buat Order]  │
└─────────────────────────────────────────────────────────────────┘
```

### ProductionOrderDetailPage — Complete Mode

```
┌─────────────────────────────────────────────────────────────────┐
│ PRD-DPK-20250620-001          Status: DRAFT                      │
│ Depok · 20 Juni 2025                                             │
├─────────────────────────────────────────────────────────────────┤
│ ── Nasi Sushi ─────────────────────────────────────────────────  │
│ Planned: 3 batch   Actual: [3  ]                                 │
│                                                                  │
│ Bahan Terpakai:                                                  │
│ ┌────────────┬──────────┬──────────┬────────┬──────────────────┐ │
│ │ Bahan      │ Planned  │ Actual   │ Waste  │ Alasan           │ │
│ │ Black Tea  │ 30 pcs   │ [30   ]  │ [2  ]  │ [Pecah        ]  │ │
│ │ Avocado Pw │ 300 gram │ [300  ]  │ [0  ]  │                  │ │
│ └────────────┴──────────┴──────────┴────────┴──────────────────┘ │
│                                                                  │
│ ── Saus Teriyaki ──────────────────────────────────────────────  │
│ Planned: 2 batch   Actual: [2  ]                                 │
│ ...                                                              │
├─────────────────────────────────────────────────────────────────┤
│ Total Material Cost: Rp 52.199                                   │
│ Total Waste Cost:    Rp  1.200                                   │
│                               [Void]  [Selesaikan Produksi]     │
└─────────────────────────────────────────────────────────────────┘
```

### ProductionOrderDetailPage — Completed (siap journal)

```
┌─────────────────────────────────────────────────────────────────┐
│ PRD-DPK-20250620-001          Status: COMPLETED                  │
│ Depok · 20 Juni 2025                                             │
├─────────────────────────────────────────────────────────────────┤
│ [Detail produksi — read only]                                    │
│                                                                  │
│ Jurnal yang akan dibuat:                                         │
│ DEBIT  110502 Barang Dalam Proses   Rp 51.000                   │
│ DEBIT  510301 Selisih HPP           Rp  1.200                   │
│ CREDIT 110501 Bahan Baku            Rp 52.200                   │
├─────────────────────────────────────────────────────────────────┤
│                     [Void]  [Generate Jurnal]                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Edge Cases

| Case | Handling |
|------|----------|
| WIP resep berubah setelah order dibuat | Tidak masalah — semua data sudah di-snapshot saat create |
| Actual batch > planned | Boleh — user input bebas, materials di-recalculate proporsional |
| Actual batch = 0 (produksi batal) | Boleh — total_cost = 0, lanjut VOID |
| `waste_qty > actual_qty` | Block: validasi di app layer + CHECK constraint di DB |
| Product dihapus setelah order | Snapshot name/code di materials tetap ada, FK product_id tetap valid |
| 2 user create order bersamaan | UNIQUE constraint + retry max 3x |
| Fiscal period closed | Block generate journal, complete masih bisa |
| Branch inactive/closed | Block create order baru untuk branch tersebut |
| WIP tanpa ingredients | Boleh create, materials kosong — tampilkan warning di UI |
| Same WIP 2x di 1 order | Boleh — beda line record, beda batch count |
| Void setelah JOURNALED | Buat reversal journal → mark original `is_reversed = true` |
| COA tidak ditemukan saat generate journal | Throw error `COA_NOT_FOUND` — jangan generate jurnal partial |

---

## Relasi dengan Module Lain

```
wip_items ──────────────→ production_order_lines (snapshot wip_name, wip_code, yield, cost)
    │
wip_ingredients ─────────→ production_order_materials (explode × planned_batch_qty)
    │
products ────────────────→ production_order_materials.cost_per_unit (snapshot, fallback)

chart_of_accounts ───────→ journal_lines (query by company_id + account_code)
    │
journal_headers ─────────→ production_orders.journal_id (link setelah generate)

production_order_materials → aggregate report (pemakaian bahan per periode)
```

---

## Urutan Implementasi

| Step | Apa | File |
|------|-----|------|
| 1 | SQL migration (3 tables + indexes) | `supabase/migrations/YYYYMMDD_production_orders.sql` |
| 2 | Types | `production-orders.types.ts` |
| 3 | Error codes | `production-orders.errors.ts` |
| 4 | Validation schema | `production-orders.schema.ts` |
| 5 | Repository (CRUD + summary queries) | `production-orders.repository.ts` |
| 6 | Service (create + complete + journal + void) | `production-orders.service.ts` |
| 7 | Controller + Routes | `production-orders.controller.ts`, `.routes.ts` |
| 8 | Frontend: ProductionOrdersPage | `ProductionOrdersPage.tsx` |
| 9 | Frontend: ProductionOrderForm | `ProductionOrderForm.tsx` |
| 10 | Frontend: ProductionOrderDetailPage | `ProductionOrderDetailPage.tsx` |

---

## Permission Module

```typescript
PermissionService.registerModule('production_orders', 'Production Order / Produksi Harian')
// Actions: canView, canInsert, canUpdate, canDelete
```