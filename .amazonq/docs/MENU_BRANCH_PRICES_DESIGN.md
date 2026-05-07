# Menu Branch Prices — Design Document

## Tujuan

Menyimpan harga jual menu per cabang. Saat ini harga sama semua cabang, tapi data aktual dari POS menunjukkan ada variasi harga antar cabang (contoh: Akira Roll = 38.000 di Serpong, 41.800 di Condet, 52.250 di Cibinong).

---

## Data Reality (dari tr_salesmenu)

| Menu | Serpong | Condet | Grand Galaxy | Depok | Cibinong | Grand Wisata | Harapan Indah |
|------|---------|--------|--------------|-------|----------|--------------|---------------|
| Akira Roll | 38.000 | 41.800 | 41.800 | 41.800 | 52.250 | 41.800 | 38.000 |
| Agedashi Tofu | 25.000 | varies | varies | varies | varies | varies | 25.000 |

Variasi harga disebabkan oleh:
- **PB1 inclusion** — beberapa cabang harga sudah include PB1, beberapa belum
- **Delivery channel** — GoFood/Grab markup ÷ 0.8 dari DINE IN
- **Promo/diskon** — harga berubah sementara
- **Regional pricing** — cabang tertentu memang beda harga dasar

---

## Schema

### `menu_branch_prices`

```sql
CREATE TABLE menu_branch_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  menu_id UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id),
  selling_price NUMERIC(20,4) NOT NULL,
  price_type VARCHAR(20) NOT NULL DEFAULT 'DINE_IN'
    CHECK (price_type IN ('DINE_IN', 'DELIVERY', 'TAKEAWAY')),
  source VARCHAR(20) NOT NULL DEFAULT 'MANUAL'
    CHECK (source IN ('MANUAL', 'POS_SYNC', 'IMPORT')),
  synced_at TIMESTAMPTZ,                               -- last POS sync timestamp
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth_users(id),
  updated_by UUID REFERENCES auth_users(id),
  deleted_at TIMESTAMPTZ
);

-- CRITICAL: DB-level uniqueness — 1 active price per menu + branch + price_type
CREATE UNIQUE INDEX idx_menu_branch_prices_unique_active
  ON menu_branch_prices(menu_id, branch_id, price_type)
  WHERE is_deleted = false;

CREATE INDEX idx_menu_branch_prices_company ON menu_branch_prices(company_id) WHERE is_deleted = false;
CREATE INDEX idx_menu_branch_prices_branch ON menu_branch_prices(branch_id) WHERE is_deleted = false;
CREATE INDEX idx_menu_branch_prices_menu ON menu_branch_prices(menu_id) WHERE is_deleted = false;
```

### Schema Simplification (vs v1 draft)

| Removed | Reason |
|---------|--------|
| `valid_from` / `valid_to` | Over-engineering. Cukup 1 active record per combo. History via soft-delete / audit log. |
| `is_active` | Redundant dengan `is_deleted`. Active = not deleted. |
| `notes` | Tidak perlu di MVP. Tambah nanti jika ada kebutuhan. |

| Added | Reason |
|-------|--------|
| `synced_at` | Track kapan terakhir POS sync update record ini. |
| CHECK constraints | Prevent typo di `price_type` dan `source` di DB level. |
| Partial unique index | Race-condition safe. No duplicate active records possible. |

---

## Price Type

| Type | Keterangan | Contoh |
|------|-----------|--------|
| `DINE_IN` | Harga makan di tempat (base price) | 41.800 |
| `DELIVERY` | Harga delivery (GoFood/Grab/Shopee) | 52.250 (= base ÷ 0.8) |
| `TAKEAWAY` | Harga bawa pulang (jika beda dari dine in) | 41.800 |

> Untuk MVP, cukup `DINE_IN` saja. `DELIVERY` dan `TAKEAWAY` bisa ditambah nanti.
> Delivery markup sudah di-handle di pos_aggregates (fee calculation), jadi mungkin tidak perlu disimpan di sini.

---

## Relasi dengan `menus.selling_price`

```
menus.selling_price = harga DEFAULT (fallback jika branch price tidak ada)

Lookup priority:
1. menu_branch_prices WHERE menu_id AND branch_id AND price_type = 'DINE_IN' AND is_deleted = false
2. menus.selling_price (fallback)
```

`menus.selling_price` tetap ada sebagai:
- Default price untuk cabang yang belum di-set
- Display price di halaman master menu (list view)
- Base untuk kalkulasi cost percentage

---

## Flow & Use Cases

### 1. Set harga per cabang (Manual)
```
User buka halaman menu → tab "Harga Cabang"
→ Lihat tabel: semua cabang + harga masing-masing
→ Edit harga per cabang
→ Save
```

### 2. Bulk import dari POS template
```
User upload CSV/Excel (format ESB template)
→ Parse: Menu Template Name → branch mapping
→ Upsert ke menu_branch_prices
→ source = 'IMPORT'
```

### 3. Auto-sync dari transaksi POS
```
Saat POS sync jalan:
→ Untuk setiap menu yang terjual di branch tertentu
→ Jika harga berbeda dari yang tersimpan DAN diff > 5%
→ HANYA update jika source = 'POS_SYNC' (TIDAK override MANUAL)
→ Update menu_branch_prices (source = 'POS_SYNC', synced_at = now())
```

### Sync Policy (CRITICAL)
```
┌─────────────────────────────────────────────────────────────┐
│ POS Sync TIDAK PERNAH override harga MANUAL.                │
│                                                             │
│ Rules:                                                      │
│ 1. Record belum ada → INSERT (source = 'POS_SYNC')         │
│ 2. Record ada, source = 'POS_SYNC' → UPDATE jika           │
│    diff > 5% dari harga tersimpan                           │
│ 3. Record ada, source = 'MANUAL' → SKIP (jangan ubah)      │
│ 4. Record ada, source = 'IMPORT' → SKIP (jangan ubah)      │
│                                                             │
│ User bisa force-override via UI (tombol "Reset ke POS")     │
│ yang akan set source = 'POS_SYNC' lalu trigger sync.        │
└─────────────────────────────────────────────────────────────┘
```

### 4. COGS Calculation impact
```
Saat calculate COGS per branch:
→ Revenue per menu = qty_sold × branch_price (bukan menus.selling_price)
→ Lookup: menu_branch_prices[menu_id][branch_id] ?? menus.selling_price
→ Ini mempengaruhi cogs_percentage per branch
```

---

## Backend Module

```
backend/src/modules/food-production/menu-branch-prices/
├── menu-branch-prices.types.ts
├── menu-branch-prices.errors.ts
├── menu-branch-prices.schema.ts
├── menu-branch-prices.repository.ts
├── menu-branch-prices.service.ts
├── menu-branch-prices.controller.ts
└── menu-branch-prices.routes.ts
```

### Endpoints

| Method | Path | Fungsi | Priority |
|--------|------|--------|----------|
| GET | `/api/v1/menu-branch-prices?menu_id=` | List prices for a menu (all branches) | Must |
| POST | `/api/v1/menu-branch-prices` | Set/upsert price for menu + branch | Must |
| PUT | `/api/v1/menu-branch-prices/:id` | Update price (sets source = 'MANUAL') | Must |
| DELETE | `/api/v1/menu-branch-prices/:id` | Soft delete | Must |
| POST | `/api/v1/menu-branch-prices/sync-from-pos` | Sync MODE prices from tr_salesmenu | Must |
| POST | `/api/v1/menu-branch-prices/bulk` | Bulk set prices | Nice to have |

> Matrix endpoint DROPPED dari MVP. Frontend cukup query per menu_id (dari MenuDetailPage).

### Key Endpoint: Sync from POS

```
POST /api/v1/menu-branch-prices/sync-from-pos

Logic:
1. Query tr_salesmenu grouped by (menu_id, branch_id)
2. Ambil MODE price (most frequent) per menu per branch — bukan latest
3. Compare dengan existing record:
   - Skip jika source = 'MANUAL' atau 'IMPORT'
   - Skip jika diff <= 5% dari harga tersimpan
   - Upsert jika belum ada atau source = 'POS_SYNC' dan diff > 5%
4. Set synced_at = now() pada semua record yang di-update
5. Return: { synced: N, skipped_manual: N, skipped_threshold: N, inserted: N }

MODE price lebih reliable dari latest karena:
- Latest bisa kena promo 1x → harga salah
- MODE = harga yang paling sering muncul = harga standar yang berlaku

Threshold 5%:
- Menghindari update noise dari pembulatan atau variasi kecil
- Hanya sync jika ada perubahan harga yang signifikan
```

---

## Frontend

### Di MenuDetailPage — Tab/Section baru: "Harga Cabang"

```
┌─────────────────────────────────────────────────────────┐
│ Harga Cabang                              [Sync POS]    │
├─────────────────────────────────────────────────────────┤
│ Cabang              │ Harga DINE IN │ Source  │ Aksi    │
│─────────────────────│───────────────│─────────│─────────│
│ Sushimas Cibinong   │ 41.800        │ POS     │ [Edit]  │
│ Sushimas Condet     │ 41.800        │ POS     │ [Edit]  │
│ Sushimas Depok      │ 41.800        │ POS     │ [Edit]  │
│ Sushimas Grand G.   │ 41.800        │ POS     │ [Edit]  │
│ Sushimas Grand W.   │ 41.800        │ POS     │ [Edit]  │
│ Sushimas Serpong    │ 38.000        │ POS     │ [Edit]  │
│ Sushimas H. Indah   │ 38.000        │ POS     │ [Edit]  │
│─────────────────────│───────────────│─────────│─────────│
│ Default (fallback)  │ 41.800        │ —       │         │
└─────────────────────────────────────────────────────────┘
```

### Di MenusPage — Optional: kolom "Price Range"
```
Harga: 38.000 — 52.250 (jika beda per cabang)
Harga: 41.800 (jika semua sama)
```

---

## Sync from POS Logic (Detail)

```sql
-- Get MODE (most frequent) price per menu per branch
SELECT 
  sm.menu_id,
  sh.branch_id,
  MODE() WITHIN GROUP (ORDER BY sm.original_price) AS mode_price,
  COUNT(*) AS tx_count
FROM tr_salesmenu sm
JOIN tr_saleshead sh ON sh.sales_num = sm.sales_num
WHERE sm.status_id != 12 
  AND sm.original_price > 0
  AND sh.sales_date >= (CURRENT_DATE - INTERVAL '90 days')  -- last 90 days only
GROUP BY sm.menu_id, sh.branch_id
HAVING COUNT(*) >= 3  -- minimum 3 transactions to be reliable
```

Kenapa MODE bukan LATEST:
- Latest bisa kena promo 1x → harga salah
- MODE = harga yang paling sering muncul = harga standar yang berlaku

Kenapa 90 hari:
- Harga bisa berubah seiring waktu
- Data lama tidak relevan
- 90 hari cukup untuk dapat sample yang reliable

Kenapa minimum 3 transaksi:
- 1-2 transaksi bisa outlier
- 3+ = pattern yang bisa dipercaya

---

## Impact ke Existing Code

### 1. COGS Calculation (`cogs.repository.ts`)
Saat ini revenue dihitung dari `tr_salesmenu.total` (actual transaction amount) — ini sudah benar dan tidak perlu diubah. `menu_branch_prices` hanya untuk display/reference, bukan untuk COGS revenue calculation.

### 2. `menus.selling_price` 
Tetap ada sebagai default/fallback. Bisa di-update dari:
- Rata-rata semua branch prices
- Harga cabang utama (primary branch)
- Manual

### 3. Cost Percentage di menu list
Saat ini: `cost_percentage = estimated_cost / selling_price`
Nanti bisa: per branch cost percentage (jika harga beda per cabang)
Untuk MVP: tetap pakai `menus.selling_price` (default)

---

## Urutan Implementasi

| Step | Apa | Priority |
|------|-----|----------|
| 1 | Create table + indexes + unique constraint | Must |
| 2 | Backend CRUD module (upsert pattern) | Must |
| 3 | Sync from POS endpoint (MODE price + threshold + source policy) | Must |
| 4 | Frontend: section "Harga Cabang" di MenuDetailPage | Must |
| 5 | Bulk import dari CSV | Nice to have |
| 6 | Auto-sync saat POS sync jalan (with threshold check) | Nice to have |

---

## Edge Cases

| Case | Handling |
|------|----------|
| Menu baru, belum ada transaksi | Tidak ada branch price, fallback ke `menus.selling_price` |
| Cabang baru, belum ada data | Tidak ada branch price, fallback ke default |
| Harga berubah (naik/turun) | UPDATE existing record (old value di audit log) |
| Promo temporary | Handle di level lain (promo module), bukan di sini |
| Menu dihapus | CASCADE delete dari `menus` table |
| Branch di-close | Data tetap ada (historical), branch.is_active = false |
| Race condition (concurrent upsert) | Partial unique index → DB reject duplicate, app retry/handle conflict |
| POS sync vs manual edit bersamaan | POS sync skip record dengan source = 'MANUAL' → no conflict |

---

## Pertanyaan yang Sudah Dijawab

| Pertanyaan | Jawaban |
|-----------|---------|
| Harga beda per cabang? | Ya, bisa beda |
| Harga beda per channel (dine in/delivery)? | Delivery markup di-handle di pos_aggregates, tidak perlu di sini untuk MVP |
| Source of truth harga? | POS transaction (MODE price) sebagai initial, lalu bisa di-override manual |
| Impact ke COGS? | Tidak langsung — COGS pakai actual revenue dari tr_salesmenu |
| Perlu history? | Cukup via audit log + soft-delete. Tidak perlu valid_from/valid_to. |
| Race condition? | Handled by partial unique index di DB level |
| POS sync override manual? | TIDAK. POS sync hanya update record dengan source = 'POS_SYNC' |
| company_id denormalized? | Ya, konsisten dengan pattern seluruh codebase (RLS-style filtering) |
