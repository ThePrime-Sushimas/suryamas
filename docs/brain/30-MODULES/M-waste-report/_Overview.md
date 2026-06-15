---
type: module
slug: waste-report
status: active
domain: "[[20-DOMAINS/Inventory/_Index|Inventory]]"
backend_path: backend/src/modules/waste-report
frontend_path: frontend/src/features/waste-report
api_base: /api/v1/waste-report
permission_module: waste_report
depends_on:
  - "[[30-MODULES/M-goods-processing]]"
  - "[[30-MODULES/M-stock-adjustments]]"
  - "[[30-MODULES/M-production-orders]]"
  - "[[30-MODULES/M-daily-stock-opname]]"
  - "[[30-MODULES/M-monthly-stock-opname]]"
  - "[[30-MODULES/M-food-production]]"
  - "[[30-MODULES/M-products]]"
  - "[[30-MODULES/M-warehouses]]"
  - "[[30-MODULES/M-branches]]"
  - "[[30-MODULES/M-shortage-report]]"
used_by:
  - "[[70-FLOWS/Waste-Analysis-Flow]]"
related_tables:
  - goods_processing_inputs (waste from GP — qty negative / bahan rusak)
  - goods_processing_outputs (waste output from GP)
  - stock_adjustments (waste via stock adjustment — reason = waste/rusak/expired)
  - production_orders (waste from daily production)
  - production_order_materials (waste per material in production)
  - daily_stock_opname (selisih harian — qty aktual < qty sistem)
  - monthly_stock_opname (selisih bulanan untuk indikasi kebocoran)
last_updated: 2026-06-15
---

# M-Waste Report

## Purpose

Laporan agregasi **waste** (barang terbuang/rusak/hilang) dari 4 sumber yang terverifikasi di Suryamas ERP. Digunakan untuk:

- Melacak **semua waste** dari berbagai modul dalam satu dashboard.
- Mengidentifikasi item mana yang paling banyak waste.
- **Benchmark antar cabang** — cabang mana yang waste-nya paling besar.
- **Membandingkan dua periode** — apakah waste naik atau turun.
- **Variance Summary** — membandingkan variance aktual vs teoretis (dari food production) dengan waste yang tercatat, untuk mengidentifikasi **unexplained qty** (selisih yang tidak terjelaskan oleh waste).

## Arsitektur — Adapter Pattern

Waste Report menggunakan **adapter pattern** untuk mengumpulkan data waste dari 4 modul berbeda. Setiap adapter mengimplementasikan interface yang sama (`getWasteRecords(ctx)`), sehingga agregator bisa fetch paralel.

```
                    ┌─────────────────────────────┐
                    │   WasteAggregatorService    │
                    │   (waste-aggregator.service)│
                    └──────┬──────────┬───────────┘
                           │          │
              ┌────────────┼──────────┼────────────┐
              ▼            ▼          ▼            ▼
    ┌─────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
    │ GP Adapter  │ │ StockAdj │ │ ProdOrd  │ │ DailyOpname  │
    │ (goods-proc)│ │ Adapter  │ │ Adapter  │ │ Adapter      │
    └─────────────┘ └──────────┘ └──────────┘ └──────────────┘
         goods_        stock_     production_    daily_stock_
       processing   adjustments   orders          opname
```

| Adapter | Source Module | Data yang Diambil |
|---------|--------------|-------------------|
| `goods-processing.adapter.ts` | Goods Processing | Waste dari input (bahan rusak) & output produksi |
| `stock-adjustment.adapter.ts` | Stock Adjustments | Waste dari stock adjustment (alasan waste/rusak/expired) |
| `production-order.adapter.ts` | Production Orders | Waste dari produksi harian (per material) |
| `daily-opname.adapter.ts` | Daily Stock Opname | Selisih kurang dari opname harian (qty aktual < qty sistem) |

Selain itu ada `monthly-opname.adapter.ts` untuk **indikasi kebocoran bulanan** (selisih opname bulanan yang tidak wajar).

## Layer Map

```
Routes → Controller → Service (WasteAggregatorService) → Adapters + Repository
  Schema    handleError                                       SQL queries
```

### Rute API

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/` | Report waste utama: records + summary + monthly_selisih |
| GET | `/summary` | Summary saja (tanpa records) |
| GET | `/by-item` | Grouping waste per produk |
| GET | `/monthly-selisih` | Data selisih opname bulanan (indikasi kebocoran) |
| GET | `/by-branch` | Grouping waste per cabang + benchmark |
| GET | `/compare` | Perbandingan dua periode |
| GET | `/variance-summary` | Aktual vs Teoretis + Waste + Unexplained |

## Key Business Rules

### 1. 4 Source Waste — Tipe Waste Terverifikasi

| Source | Label | Berasal Dari |
|--------|-------|-------------|
| `GOODS_PROCESSING` | Barang Diproses | Barang yang rusak/afkir saat proses produksi |
| `STOCK_ADJUSTMENT` | Waste & Breakdown | Penyesuaian stok dengan alasan waste/rusak/expired |
| `PRODUCTION_ORDER` | Produksi Harian | Sisa bahan produksi yang terbuang |
| `DAILY_OPNAME` | Opname Harian | Selisih kurang yang tidak wajar dari opname harian |

### 2. Multi-tenant + Soft Delete
- Semua query filter `company_id` dan `deleted_at IS NULL`.

### 3. Range Maksimal
- Maksimal 366 hari per request. Jika lebih → error.

### 4. Validation Filter
- `start_date` dan `end_date` wajib diisi.
- `start_date` harus ≤ `end_date`.
- User harus memiliki akses ke cabang yang dipilih.

### 5. Variance Summary
- Menggabungkan data **theoretical consumption variance** (dari food production) dengan **waste records**.
- Menghitung **unexplained qty** = max(0, variance_qty - waste_qty).
- Severity: `OK` (≤5%), `WARNING` (5-15%), `CRITICAL` (>15%).
- Jika variance positive (over usage) tapi waste kecil → ada indikasi **kebocoran yang tidak terdeteksi**.

### 6. Perbandingan Periode (Compare)
- Bandingkan dua periode (A vs B) untuk melihat tren waste.
- Menampilkan diff cost, diff qty, dan diff cost percentage.

## Panduan Penggunaan (User Guide)

### 🖥️ Cara Membuka Halaman
1. Login ke Suryamas ERP.
2. Navigasi: **Inventory → Laporan Waste**.
3. Atur filter tanggal, lalu klik **Tampilkan**.

### 📅 Filter
| Filter | Deskripsi |
|--------|-----------|
| **Dari Tanggal / Sampai Tanggal** | Rentang wajib. Gunakan tombol "30 hari terakhir" untuk quick pick. |
| **Cabang** | Filter per cabang. Default: semua cabang yang user punya akses. |
| **Kategori** | Filter per kategori produk. |
| **Modul** | Filter sumber waste: Barang Diproses / Waste & Breakdown / Produksi Harian / Opname Harian. |

### 📊 Tab yang Tersedia

#### 1. Ringkasan (Summary)
- **Waste Trend Chart**: Grafik garis tren waste per hari dalam periode.
- **Compare Panel**: Bandingkan dengan periode sebelumnya.
  - Klik **Bandingkan Periode** → isi periode B → klik **Bandingkan**.
  - Tampilkan: total cost A vs B, diff, dan percentage change.

#### 2. Detail Transaksi
- Tabel semua records waste dengan kolom: tanggal, cabang, item, qty, unit cost, total cost, sumber, alasan, reference code.
- **Search**: filter records lokal (item, cabang, referensi, alasan, sumber).
- Badge per source dengan warna berbeda.
- Peringatan jika ada PO produksi yang belum final (provisional).

#### 3. Aktual vs Teoretis (Variance)
Menampilkan per-item:
| Kolom | Arti |
|-------|------|
| **Actual Qty** | Pemakaian aktual dari food production |
| **Teoretis Qty** | Pemakaian seharusnya berdasarkan resep |
| **Variance Qty** | Selisih (actual - teoretis) — positif = over usage |
| **Variance %** | Persentase terhadap teoretis |
| **Severity** | OK / WARNING / CRITICAL (warna badge) |
| **Waste Qty** | Waste yang tercatat dari 4 sumber |
| **Unexplained Qty** | Variance - waste (positif = ada selisih yang belum terjelaskan) |

> **Interpretasi**: Jika variance besar tapi waste kecil → ada indikasi kebocoran, pencatatan produksi tidak akurat, atau waste tidak dilaporkan.

#### 4. Per Alasan (By Reason)
- Grouping waste berdasarkan alasan/reason.
- Menampilkan total qty dan cost per alasan.
- Berguna untuk investigasi akar masalah — alasan apa yang paling dominan.

#### 5. Per Produk (By Item)
- Grouping waste per produk.
- Lihat item mana yang paling sering waste.
- Breakdown per source (GOODS_PROCESSING / STOCK_ADJUSTMENT / PRODUCTION_ORDER / DAILY_OPNAME).

#### 6. Benchmark Cabang (By Branch)
- Perbandingan waste antar cabang.
- **Percentage of total**: seberapa besar kontribusi waste cabang terhadap total waste.
- Berguna untuk mengevaluasi performa operasional per cabang.

#### 7. Indikasi Kebocoran Bulanan (Monthly)
- Data dari opname bulanan — selisih qty dan nilai.
- Menampilkan catatan investigasi jika ada.
- Berguna untuk audit bulanan.

### 🔗 Hubungan dengan Shortage Report
- Di halaman waste report, jika ada **shortage unresolved** (dari shortage report), akan muncul banner merah/oranye:
  > "Shortage Belum Terselesaikan: Rp X.XXX — klik untuk investigasi."
- Shortage yang di-`CONVERT_TO_WASTE` akan tercatat sebagai waste via **STOCK_ADJUSTMENT** source.
- Sebaiknya resolve shortage **sebelum** atau **bersamaan** dengan review waste report.

### 📤 Export
- Data dari setiap tab bisa di-export ke CSV/XLSX (via `wasteReportExport.ts`).

### ⚠️ Catatan Penting
- **Data bersifat read-only** — waste report hanya menampilkan agregasi. Untuk mengubah data, gunakan modul asalnya.
- **PO Produksi Provisional**: Waste dari production order yang belum final tetap dihitung. Tandai dengan badge/warning di tab Detail.
- **Monthly Selisih**: Tidak semua branch memiliki data opname bulanan. Jika kosong, berarti belum ada opname bulanan di periode tersebut.
- **Variance Summary membutuhkan data food production**: Jika branch tidak punya POS mapping, theoretical variance akan kosong.
- **Performance**: Range date terlalu lebar (>6 bulan) bisa lambat karena fetch dari 4 sumber paralel.

## Architecture Notes

### Adapter Interface
Setiap adapter harus mengimplementasikan:
```typescript
interface WasteAdapter {
  getWasteRecords(ctx: WasteQueryContext): Promise<WasteRecord[]>
}
```

### Query Flow Diagram (Main Report)
```
User klik "Tampilkan"
       ↓
WasteReportPage (frontend)
       ↓  GET /api/v1/waste-report?start_date=...&end_date=...&branch_id=...
wasteReportController.getReport()
       ↓
    validateFilter(filter)
       ↓
    buildQueryContext(filter) → WasteQueryContext
       ↓
    WasteAggregatorService.getWasteReport(filter)
       │
       ├── goodsProcessingAdapter.getWasteRecords(ctx)      ← GP inputs/outputs
       ├── stockAdjustmentAdapter.getWasteRecords(ctx)      ← stock_adjustments
       ├── productionOrderAdapter.getWasteRecords(ctx)      ← production_orders
       ├── dailyOpnameAdapter.getWasteRecords(ctx)          ← daily_stock_opname
       │
       ├── monthlyOpnameAdapter.getMonthlySelisih(ctx)      ← monthly_stock_opname
       └── wasteReportRepository.getTotalPurchaseCost(ctx)  ← total pembelian
       ↓
    enrichWithBranchNames()  ← JOIN branches table
       ↓
    calculateSummary(records, totalPurchaseCost)
       ↓
sendSuccess(res, { filter, summary, records, monthly_selisih })
       ↓
Frontend render 7 tabs
```

## Known Gotchas / Pitfalls

- **Provisional PO counted**: Waste dari PO yang belum final tetap muncul di total. Perhatikan badge/alert.
- **Monthly selisih bisa negatif**: Jika qty aktual > qty sistem (selisih lebih), tetap ditampilkan sebagai nilai negatif.
- **Variance tanpa waste**: Jika theoretical variance besar tapi waste kosong → investigasi apakah waste tidak dicatat.
- **Branch tanpa POS**: Variance summary tidak bisa menampilkan theoretical data untuk branch tanpa integrasi POS.
- **Range terlalu lebar**: Bisa menyebabkan timeout. Gunakan range maksimal 3 bulan untuk performa optimal.
- **Data tidak real-time**: Waste report adalah agregasi read-only. Data tergantung pada kapan modul sumber dicatat.

## Related
- **API:** [[_API-Reference]]
- **Data:** [[_Data-Model]]
- **Relations:** [[_Relations]]
- **Flow:** [[70-FLOWS/Waste-Analysis-Flow]]
- **Related Module:** [[30-MODULES/M-shortage-report/_Overview|M-Shortage Report]]