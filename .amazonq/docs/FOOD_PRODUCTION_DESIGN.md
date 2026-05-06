  # Menu Management & COGS — Design Document (Final)

  ## 📁 Folder Induk: `food-production`

  ```
  backend/src/modules/food-production/
  ├── menus/                    # Master menu (1:1 dengan POS staging)
  ├── menu-categories/          # Kategori menu (dikelola manual)
  ├── menu-groups/              # Group menu (dikelola manual)
  ├── recipes/                  # BOM/Resep (menu → bahan baku + WIP)
  ├── wip/                      # Work In Progress (bahan setengah jadi)
  └── cogs/                     # Kalkulasi & jurnal COGS

  frontend/src/features/food-production/
  ├── menus/
  ├── menu-categories/
  ├── menu-groups/
  ├── recipes/
  ├── wip/
  └── cogs/
  ```

  ---

  ## 🗄️ Database Tables

  ### Phase 1: Master Menu

  #### 1. `menu_categories`

  ```sql
  CREATE TABLE menu_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    category_name VARCHAR(100) NOT NULL,
    category_code VARCHAR(20) NOT NULL,
    sales_coa_id UUID REFERENCES chart_of_accounts(id),
    cogs_coa_id UUID REFERENCES chart_of_accounts(id),
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth_users(id),
    updated_by UUID REFERENCES auth_users(id),
    UNIQUE(company_id, category_code)
  );
  ```

  **Data awal:** FOOD → 510101, BEVERAGE → 510102, OTHER → 510103

  #### 2. `menu_groups`

  ```sql
  CREATE TABLE menu_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    category_id UUID NOT NULL REFERENCES menu_categories(id),
    group_name VARCHAR(100) NOT NULL,
    group_code VARCHAR(20) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth_users(id),
    updated_by UUID REFERENCES auth_users(id),
    UNIQUE(company_id, group_code)
  );
  ```

  #### 3. `menus`

  ```sql
  CREATE TABLE menus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    pos_menu_id INT,                                       -- FK ke pos_staging_menus.pos_id (nullable)
    category_id UUID NOT NULL REFERENCES menu_categories(id),
    group_id UUID REFERENCES menu_groups(id),
    menu_code VARCHAR(50) NOT NULL,
    menu_name VARCHAR(150) NOT NULL,
    selling_price NUMERIC(20,4) NOT NULL DEFAULT 0,
    estimated_cost NUMERIC(20,4) NOT NULL DEFAULT 0,       -- auto-calculated dari recipe
    cost_percentage NUMERIC(5,2) GENERATED ALWAYS AS (
      CASE WHEN selling_price > 0 THEN (estimated_cost / selling_price * 100) ELSE 0 END
    ) STORED,
    has_recipe BOOLEAN NOT NULL DEFAULT false,             -- flag: sudah punya BOM atau belum
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    sync_enabled BOOLEAN NOT NULL DEFAULT true,            -- true = ikut update dari POS sync
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth_users(id),
    updated_by UUID REFERENCES auth_users(id),
    deleted_at TIMESTAMPTZ,
    UNIQUE(company_id, menu_code),
    UNIQUE(company_id, pos_menu_id)
  );

  CREATE INDEX idx_menus_company_active ON menus(company_id, is_active) WHERE deleted_at IS NULL;
  CREATE INDEX idx_menus_pos_menu_id ON menus(pos_menu_id) WHERE pos_menu_id IS NOT NULL;
  ```

  ---

  ### Phase 2: WIP & Recipe/BOM

  #### 4. `wip_items`

  ```sql
  CREATE TABLE wip_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    wip_code VARCHAR(50) NOT NULL,
    wip_name VARCHAR(150) NOT NULL,
    uom VARCHAR(20) NOT NULL DEFAULT 'gram',
    yield_qty NUMERIC(20,4) NOT NULL DEFAULT 1,            -- fixed per batch
    estimated_cost NUMERIC(20,4) NOT NULL DEFAULT 0,       -- SUM(wip_ingredients.line_cost)
    cost_per_unit NUMERIC(20,4) GENERATED ALWAYS AS (
      CASE WHEN yield_qty > 0 THEN (estimated_cost / yield_qty) ELSE 0 END
    ) STORED,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth_users(id),
    updated_by UUID REFERENCES auth_users(id),
    deleted_at TIMESTAMPTZ,
    UNIQUE(company_id, wip_code)
  );
  ```

  #### 5. `wip_ingredients`

  ```sql
  CREATE TABLE wip_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wip_id UUID NOT NULL REFERENCES wip_items(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    qty NUMERIC(20,4) NOT NULL,
    uom VARCHAR(20) NOT NULL DEFAULT 'gram',
    cost_per_unit NUMERIC(20,4) NOT NULL DEFAULT 0,        -- dari products.average_cost
    line_cost NUMERIC(20,4) GENERATED ALWAYS AS (qty * cost_per_unit) STORED,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(wip_id, product_id)
  );
  ```

  #### 6. `recipe_lines`

  ```sql
  CREATE TABLE recipe_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_id UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),               -- bahan baku langsung
    wip_id UUID REFERENCES wip_items(id),                  -- ATAU bahan setengah jadi
    qty NUMERIC(20,4) NOT NULL,
    uom VARCHAR(20) NOT NULL DEFAULT 'gram',
    cost_per_unit NUMERIC(20,4) NOT NULL DEFAULT 0,        -- dari product.average_cost atau wip.cost_per_unit
    line_cost NUMERIC(20,4) GENERATED ALWAYS AS (qty * cost_per_unit) STORED,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (
      (product_id IS NOT NULL AND wip_id IS NULL) OR
      (product_id IS NULL AND wip_id IS NOT NULL)
    )
  );

  CREATE INDEX idx_recipe_lines_menu ON recipe_lines(menu_id);
  CREATE INDEX idx_recipe_lines_product ON recipe_lines(product_id) WHERE product_id IS NOT NULL;
  CREATE INDEX idx_recipe_lines_wip ON recipe_lines(wip_id) WHERE wip_id IS NOT NULL;
  ```

  ---

  ### Phase 3: COGS Calculation & Journal

  #### 7. `cogs_calculations`

  ```sql
  CREATE TABLE cogs_calculations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    branch_id UUID REFERENCES branches(id),
    calculation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_food_cogs NUMERIC(20,4) NOT NULL DEFAULT 0,
    total_beverage_cogs NUMERIC(20,4) NOT NULL DEFAULT 0,
    total_other_cogs NUMERIC(20,4) NOT NULL DEFAULT 0,
    total_cogs NUMERIC(20,4) NOT NULL DEFAULT 0,
    total_revenue NUMERIC(20,4) NOT NULL DEFAULT 0,
    cogs_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
    unmapped_menu_count INT NOT NULL DEFAULT 0,            -- menu tanpa resep yang terjual
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',           -- DRAFT, JOURNALED, VOID
    superseded_by UUID REFERENCES cogs_calculations(id),   -- kalau di-recalculate
    journal_id UUID REFERENCES journal_headers(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth_users(id)
  );

  CREATE INDEX idx_cogs_calc_company_period ON cogs_calculations(company_id, period_start, period_end);
  CREATE INDEX idx_cogs_calc_status ON cogs_calculations(status);
  ```

  > **Tidak pakai UNIQUE constraint ketat** — kalau re-calculate, record lama di-supersede (superseded_by diisi), record baru dibuat. History tetap tersimpan.

  #### 8. `cogs_calculation_lines`

  ```sql
  CREATE TABLE cogs_calculation_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_id UUID NOT NULL REFERENCES cogs_calculations(id) ON DELETE CASCADE,
    menu_id UUID REFERENCES menus(id),
    menu_name VARCHAR(150) NOT NULL,
    category_name VARCHAR(100),
    qty_sold NUMERIC(20,4) NOT NULL,
    cost_per_unit NUMERIC(20,4) NOT NULL,                  -- snapshot saat calculate
    total_cogs NUMERIC(20,4) NOT NULL,
    revenue NUMERIC(20,4) NOT NULL DEFAULT 0,
    cogs_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
    has_recipe BOOLEAN NOT NULL DEFAULT false              -- flag saat calculate
  );

  CREATE INDEX idx_cogs_lines_calc ON cogs_calculation_lines(calculation_id);
  ```

  > `cogs_calculation_lines` berfungsi sekaligus sebagai **recipe costing snapshot** — karena `cost_per_unit` di-snapshot saat calculate, historical COGS bisa di-reproduce. Tidak perlu tabel snapshot terpisah.

  ---

  ## 🔑 Keputusan Desain (Dari Diskusi)

  ### 1. Resep global, kalkulasi per branch
  - `recipe_lines` → **tidak ada branch_id** (resep sama untuk semua outlet)
  - `cogs_calculations` → **punya branch_id** (jurnal & laporan per branch)
  - `menus.estimated_cost` → satu nilai global
  - Filter branch via `tr_saleshead.branch_id` saat calculate

  ### 2. Cost update: triggered propagation
  Setiap kali `products.average_cost` berubah (purchase confirmed):
  ```
  products.average_cost berubah
    → recalculate wip_ingredients.cost_per_unit (WHERE product_id = ?)
    → recalculate wip_items.estimated_cost = SUM(wip_ingredients.line_cost)
    → recalculate recipe_lines.cost_per_unit (WHERE product_id = ? OR wip_id IN affected_wips)
    → recalculate menus.estimated_cost = SUM(recipe_lines.line_cost)
    → update menus.has_recipe = (COUNT(recipe_lines) > 0)
  ```
  Implementasi: `recalculateCostFromProduct(productId)` — satu service function, dipanggil saat purchase confirmed. Bukan trigger Postgres.

  ### 3. WIP yield: fixed per batch
  - `yield_qty` = konstanta (misal: 1 batch Nasi Sushi = 5000 gram)
  - `cost_per_unit` = generated column (estimated_cost / yield_qty)
  - Kalau resep berubah → update yield_qty → otomatis propagate ke recipe_lines

  ### 4. Menu tanpa resep: tetap masuk, di-flag
  - `has_recipe = false` → `estimated_cost = 0`
  - Tetap masuk `cogs_calculation_lines` dengan `cost_per_unit = 0`
  - `cogs_calculations.unmapped_menu_count` → jumlah menu tanpa resep yang terjual
  - Laporan COGS punya section "Menu Tanpa Resep" sebagai reminder

  ### 5. Periode COGS: dual mode
  - **Preview/Estimasi** → range bebas, tidak disimpan, tidak generate jurnal
  - **Finalize/Journalize** → align dengan fiscal period, simpan ke `cogs_calculations`, generate jurnal

  ### 6. Journal entry: credit ke 1 akun (Bahan Baku)
  ```
  Debit:  510101 HPP Makanan        (total_food_cogs)
  Debit:  510102 HPP Minuman        (total_beverage_cogs)
  Debit:  510103 HPP Lainnya        (total_other_cogs)
  Credit: 110501 Bahan Baku         (total_cogs)
  ```
  > Jika nanti butuh diferensiasi credit per kategori bahan, bisa ditambahkan di `menu_categories` sebagai `inventory_coa_id`. Untuk sekarang cukup 1 akun.

  ### 7. Re-calculation: supersede pattern
  - Kalau perlu re-calculate (koreksi purchase, resep berubah):
    - Record lama: `superseded_by = new_id`
    - Record baru dibuat fresh
    - Jurnal lama di-void, jurnal baru di-generate
    - History tetap tersimpan untuk audit

  ---

  ## 🔄 Flow: Menu → Journal (Detail)

  ```
  ┌─────────────────────────────────────────────────────────────────┐
  │ 1. POS SYNC (otomatis harian)                                   │
  │    pos_staging_menus → menus (jika sync_enabled = true)         │
  │    - Update: menu_name, selling_price, is_active                │
  │    - TIDAK update: category_id, group_id (manual)               │
  │    - Menu baru di POS → auto-insert ke menus (default category) │
  │    tr_salesmenu → data penjualan per menu per hari              │
  ├─────────────────────────────────────────────────────────────────┤
  │ 2. RECIPE/BOM (setup manual, cost auto-propagate)               │
  │    menus.id → recipe_lines → product_id / wip_id               │
  │    wip_items → wip_ingredients → product_id                     │
  │    Purchase confirmed → recalculateCostFromProduct()            │
  │      → wip_ingredients → wip_items → recipe_lines → menus      │
  ├─────────────────────────────────────────────────────────────────┤
  │ 3. COGS CALCULATION                                             │
  │    Mode Preview: range bebas, tidak simpan, untuk monitoring    │
  │    Mode Finalize: align fiscal period, simpan + generate jurnal │
  │                                                                 │
  │    Process:                                                     │
  │      a. Query tr_salesmenu WHERE sales_date BETWEEN period      │
  │         JOIN tr_saleshead untuk filter branch                   │
  │      b. JOIN menus ON pos_menu_id = menu_id                     │
  │      c. COGS per menu = qty_sold × estimated_cost               │
  │      d. Menu tanpa resep → cost = 0, flag unmapped              │
  │      e. Group by category → total FOOD/BEVERAGE/OTHER           │
  │      f. Simpan ke cogs_calculations + lines (snapshot cost)     │
  ├─────────────────────────────────────────────────────────────────┤
  │ 4. GENERATE JOURNAL                                             │
  │    Debit:  510101 HPP Makanan      (total_food_cogs)            │
  │    Debit:  510102 HPP Minuman      (total_beverage_cogs)        │
  │    Debit:  510103 HPP Lainnya      (total_other_cogs)           │
  │    Credit: 110501 Bahan Baku       (total_cogs)                 │
  │                                                                 │
  │    journal_type: GENERAL                                        │
  │    source_module: food_production                                │
  │    status: POSTED                                               │
  └─────────────────────────────────────────────────────────────────┘
  ```

  ---

  ## 🔗 Relasi Antar Tabel

  ```
  pos_staging_menus (POS)
        │ pos_menu_id (1:1, sync_enabled)
        ▼
      menus ──────────── menu_categories ── chart_of_accounts (sales + cogs COA)
        │                     │
        │                menu_groups
        │
        ├── recipe_lines ──── products (bahan baku, average_cost)
        │         │
        │         └────────── wip_items
        │                        │
        │                   wip_ingredients ── products
        │
        ▼ (via pos_menu_id = tr_salesmenu.menu_id)
  tr_salesmenu (penjualan harian)
        │
        ▼
  cogs_calculations ── cogs_calculation_lines (snapshot)
        │
        ▼
  journal_headers + journal_lines
  ```

  ---

  ## ⚡️ Sync Logic (menus ↔ pos_staging_menus)

  ### POS Staging Tables — Data Ownership

  | Tabel | company_id? | Keterangan |
  |-------|-------------|------------|
  | `pos_staging_menus` | ❌ Tidak ada | Single-company by design. Semua data milik 1 company. |
  | `pos_staging_menu_groups` | ❌ Tidak ada | Single-company by design. |
  | `pos_staging_menu_categories` | ❌ Tidak ada | Single-company by design. |

  > PENTING: Tabel pos_staging tidak punya company_id. Query ke tabel ini tidak perlu filter company, tapi HARUS didokumentasikan di code dengan comment.

  ### POS Category Mapping

  Mapping dari `pos_staging_menu_categories.pos_id` ke `menu_categories.category_code`:

  | pos_id | category_code | Keterangan |
  |--------|--------------|------------|
  | 2 | FOOD | Sesuai setup POS Sushimas |
  | 3 | BEVERAGE | |
  | lainnya | OTHER | Fallback + log warning |

  > Jika POS system berubah, update mapping di `batchSyncFromPos()` repository method.
  > TODO: Refactor ke constants file atau mapping table untuk decoupling.

  ### Sync Behavior:

  ```
  Saat POS sync jalan (harian):

  FOR EACH menu IN pos_staging_menus yang berubah:
    existing = SELECT FROM menus WHERE pos_menu_id = menu.pos_id

    IF existing AND existing.sync_enabled = true:
      UPDATE menus SET
        menu_name = menu.menu_name,
        selling_price = menu.price,
        is_active = (menu.flag_active = 1),
        last_synced_at = now()
      -- TIDAK sentuh: category_id, group_id, estimated_cost

    ELSE IF NOT existing:
      -- Auto-detect category dari pos_staging_menu_groups → pos_staging_menu_categories
      default_category = lookup category by menu.pos_group_id → group.pos_category_id
      INSERT INTO menus (pos_menu_id, category_id, menu_code, menu_name, selling_price, ...)

    -- sync_enabled = false → SKIP, tidak update
  ```

  **Break sync:** `UPDATE menus SET sync_enabled = false WHERE id = ?`
  **Resume sync:** `UPDATE menus SET sync_enabled = true WHERE id = ?`

  ---

  ## 🧮 Cost Propagation Logic

  ```typescript
  async recalculateCostFromProduct(productId: string): Promise<void> {
    const product = await getProduct(productId)

    // 1. Update wip_ingredients yang pakai product ini
    await pool.query(`
      UPDATE wip_ingredients SET cost_per_unit = $1, updated_at = now()
      WHERE product_id = $2
    `, [product.average_cost, productId])

    // 2. Recalculate affected wip_items
    const affectedWips = await pool.query(`
      SELECT DISTINCT wip_id FROM wip_ingredients WHERE product_id = $1
    `, [productId])

    for (const { wip_id } of affectedWips.rows) {
      await pool.query(`
        UPDATE wip_items SET estimated_cost = (
          SELECT COALESCE(SUM(qty * cost_per_unit), 0) FROM wip_ingredients WHERE wip_id = $1
        ), updated_at = now()
        WHERE id = $1
      `, [wip_id])
    }

    // 3. Update recipe_lines yang pakai product langsung
    await pool.query(`
      UPDATE recipe_lines SET cost_per_unit = $1, updated_at = now()
      WHERE product_id = $2
    `, [product.average_cost, productId])

    // 4. Update recipe_lines yang pakai affected WIPs
    const wipIds = affectedWips.rows.map(r => r.wip_id)
    if (wipIds.length > 0) {
      await pool.query(`
        UPDATE recipe_lines rl SET
          cost_per_unit = wi.cost_per_unit,
          updated_at = now()
        FROM wip_items wi
        WHERE rl.wip_id = wi.id AND rl.wip_id = ANY($1::uuid[])
      `, [wipIds])
    }

    // 5. Recalculate affected menus
    await pool.query(`
      UPDATE menus m SET
        estimated_cost = COALESCE((
          SELECT SUM(qty * cost_per_unit) FROM recipe_lines WHERE menu_id = m.id
        ), 0),
        has_recipe = EXISTS(SELECT 1 FROM recipe_lines WHERE menu_id = m.id),
        updated_at = now()
      WHERE m.id IN (
        SELECT DISTINCT menu_id FROM recipe_lines
        WHERE product_id = $1 OR wip_id = ANY($2::uuid[])
      )
    `, [productId, wipIds])
  }
  ```

  ---

  ## 📋 Urutan Implementasi

  | Phase | Tabel/Module | Dependency |
  |-------|-------------|------------|
  | **1a** | `menu_categories` + `menu_groups` + CRUD | Tidak ada |
  | **1b** | `menus` + sync logic dari POS | 1a (category harus ada) |
  | **2a** | `wip_items` + `wip_ingredients` + CRUD | products table |
  | **2b** | `recipe_lines` + CRUD + cost propagation | 1b + 2a |
  | **3a** | `cogs_calculations` + calculate (preview mode) | 1b + 2b + tr_salesmenu |
  | **3b** | Finalize + generate journal | 3a + journal_headers service |

  ---

  ## 🚨 Edge Cases & Mitigasi

  | Case | Handling |
  |------|----------|
  | Menu di POS tapi belum ada di `menus` | Auto-insert saat sync, default category |
  | Menu di `menus` tapi tidak ada di POS | Tetap ada, bisa dipakai manual |
  | `tr_salesmenu.menu_id` tidak match `menus.pos_menu_id` | Masuk `unmapped_menu_count`, log warning |
  | Product tanpa `average_cost` (= 0) | Recipe line cost = 0, propagate 0 ke menu |
  | WIP tanpa ingredients | `estimated_cost = 0`, `cost_per_unit = 0` |
  | Re-calculate COGS setelah koreksi | Supersede pattern: old.superseded_by = new.id |
  | Fiscal period belum open | Block finalize, hanya bisa preview |
  | Menu dihapus tapi ada di historical COGS | `cogs_calculation_lines.menu_name` = snapshot, tidak FK cascade |
