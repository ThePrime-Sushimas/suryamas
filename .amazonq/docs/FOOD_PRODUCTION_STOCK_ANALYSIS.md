# Food Production & Stock — Analisis Sistem Saat Ini

> Dokumen ini merangkum diskusi tentang bagaimana modul Food Production berinteraksi dengan inventory/stock, penerapan gudang MAIN vs READY, dan gap yang perlu dibangun.

---

## Modul Food Production — Ringkasan

### 1. Menu Categories
Pengelompokan menu level tertinggi (Makanan, Minuman, Dessert). Bisa di-mapping ke CoA untuk jurnal akuntansi.

### 2. Menu Groups
Sub-pengelompokan di bawah kategori (Nasi, Mie, Snack di bawah "Makanan").

### 3. Menus
Master data menu/produk jadi yang dijual. Punya harga jual, estimasi biaya, flag `has_recipe`, dan sync dari POS.

### 4. Menu Branch Prices
Harga jual menu yang berbeda per cabang. Sync otomatis dari POS.

### 5. Recipes
Bill of Material (BOM) per menu. Bahan bisa berupa product (bahan mentah) atau WIP (bahan setengah jadi). Otomatis propagasi cost jika harga bahan berubah.

### 6. WIP (Work In Progress)
Master data bahan setengah jadi (Bumbu Dasar Merah, Adonan Roti). Punya daftar ingredients dan cost_per_unit otomatis.

### 7. Production Orders
Pencatatan order produksi harian. Lifecycle: DRAFT → COMPLETED → JOURNALED (atau VOID). Mencatat actual batch, waste, dan generate jurnal akuntansi.

### 8. COGS (Cost of Goods Sold)
Kalkulasi HPP berdasarkan data penjualan POS × resep. Preview dan finalize dengan jurnal otomatis. Breakdown per hari/kategori/grup/menu.

### 9. Theoretical Consumption
Analisis konsumsi bahan baku teoritis vs aktual. Variance analysis, coverage gap, menu profitability (tier A/B/C), cost trend, dan waste summary.

---

## Alur Keseluruhan

```
Menu Categories → Menu Groups → Menus
                                  ↓
                              Recipes (BOM)
                              ↙        ↘
                     Products          WIP Items (+ ingredients)
                                          ↓
                                  Production Orders
                                  (pencatatan produksi harian)
                                          ↓
                              COGS Calculation (HPP)
                              Theoretical Consumption (analisis varian)
```

---

## Interaksi Food Production ↔ Stock

### Status Saat Ini

**Production Orders TIDAK langsung mengurangi stock.** Yang terjadi:
- Hanya mencatat pemakaian bahan (actual_qty, waste_qty)
- Membuat jurnal akuntansi (Bahan Baku → Barang Dalam Proses)
- Movement type `OUT_PRODUCTION` dan `IN_PRODUCTION` sudah didefinisikan tapi **belum diimplementasikan**

### Yang Sudah Mengurangi/Menambah Stock

| Aksi | Movement Type | Penjelasan |
|------|--------------|------------|
| Goods Processing confirm | `IN_PURCHASE` | Barang masuk ke gudang MAIN setelah diproses |
| Daily Prep Order confirm | `OUT_TRANSFER` + `IN_TRANSFER` | Pindah dari MAIN → READY |
| Stock Adjustment | `OUT_ADJUSTMENT` / `IN_ADJUSTMENT` | Koreksi manual |
| Transfer antar gudang | `OUT_TRANSFER` / `IN_TRANSFER` | Kirim antar cabang |
| Opening Balance | `IN_OPENING` | Saldo awal |

---

## Arsitektur Gudang (Warehouse Types)

```typescript
type WarehouseType = 'MAIN' | 'READY' | 'CENTRAL_STOCK' | 'CENTRAL_KITCHEN'
```

| Type | Nama Operasional | Fungsi |
|------|-----------------|--------|
| MAIN | Gudang 1 | Penyimpanan utama per cabang, terima barang dari supplier/transfer |
| READY | Gudang 2 | Bahan siap pakai, sudah turun ke dapur |
| CENTRAL_STOCK | Gudang Pusat | Bulk storage untuk distribusi ke cabang |
| CENTRAL_KITCHEN | Dapur Pusat | Produksi WIP (saos, bumbu) |

### Flow Per Cabang

```
Supplier → GR → Goods Processing → MAIN (gudang penyimpanan)
                                      ↓
                          DPO (Daily Prep Order) confirm
                          [OUT_TRANSFER dari MAIN, IN_TRANSFER ke READY]
                                      ↓
                                   READY (siap jual/pakai)
                                      ↓
                                POS (penjualan) — belum otomatis kurangi stock
```

### Penerapan DPO (Daily Prep Order)

DPO adalah dokumen yang memindahkan bahan dari MAIN ke READY:
1. Generate DPO (bisa dari prediksi/forecast)
2. Tim konfirmasi qty yang benar-benar diambil (`confirmed_qty`)
3. Saat confirm → sistem cek stok MAIN cukup → buat movement OUT dari MAIN + IN ke READY
4. Cost ikut pindah (weighted average)

---

## Waste — Status Saat Ini

### Tempat Waste Dicatat

1. **Production Orders** → saat complete, tiap material bisa diisi `waste_qty` + `waste_reason`. Waste cost masuk jurnal "Selisih HPP" (COA 510301)
2. **Goods Processing** → output ditandai `is_waste: true`. Waste tidak masuk stock (di-skip saat create movement)
3. **Theoretical Consumption** → waste summary dari data production orders

### Yang Belum Ada

- **Halaman Waste Recording standalone** — movement type `OUT_WASTE` sudah didefinisikan tapi belum ada modul/UI yang menggunakannya
- **Stock Opname harian di READY** — timbang sisa malam, bandingkan dengan saldo sistem

---

## Timbang Sisa Ready Malam Hari

### Kebutuhan
- Setiap malam, tim timbang sisa bahan di gudang READY
- Bandingkan dengan saldo READY di sistem
- Selisih = waste (dicatat sebagai `OUT_WASTE`)
- Saat timbang, bisa lihat angka gudang MAIN sebagai referensi

### Status
- **Data saldo MAIN dan READY sudah tersedia** di `stock_balances` per warehouse
- **Belum ada UI/flow khusus** untuk timbang harian
- Perlu dibangun: halaman Stock Opname READY + otomatis catat selisih sebagai waste

---

## Gap & Rencana Pengembangan

| # | Kebutuhan | Status | Prioritas |
|---|-----------|--------|-----------|
| 1 | Stock berkurang otomatis dari produksi | ❌ Belum | Medium — `OUT_PRODUCTION` type sudah ada |
| 2 | Gudang MAIN & READY berfungsi | ✅ Sudah | — DPO memindahkan MAIN → READY |
| 3 | Halaman waste recording standalone | ❌ Belum | High — `OUT_WASTE` type ada tapi belum ada flow |
| 4 | Timbang sisa READY malam (Stock Opname harian) | ❌ Belum | High — inti food cost control |
| 5 | Lihat angka gudang MAIN saat timbang | ✅ Data ada | Low — tinggal tampilkan di UI |
| 6 | POS otomatis kurangi stock READY | ❌ Belum | Medium — theoretical consumption sebagai bridge |

---

## Rencana Build Selanjutnya (Rekomendasi)

### Fase A — Stock Opname Harian (Timbang READY)
- Halaman input hasil timbang per item di gudang READY
- Sistem hitung selisih (saldo sistem vs actual timbang)
- Selisih negatif → `OUT_WASTE` movement otomatis
- Selisih positif → `IN_ADJUSTMENT` (jarang tapi bisa terjadi)
- Tampilkan saldo MAIN sebagai referensi
- Foto timbangan (upload) sebagai bukti
- Audit trail: siapa, kapan, berapa

### Fase B — Production Order ↔ Stock Integration
- Saat Production Order complete → `OUT_PRODUCTION` dari gudang MAIN (bahan baku keluar)
- Saat Production Order complete → `IN_PRODUCTION` ke gudang MAIN/READY (hasil WIP masuk)
- Validasi stok cukup sebelum complete

### Fase C — POS → Stock Deduction (Theoretical)
- Setiap hari, hitung theoretical consumption dari POS sales × recipe
- Bandingkan dengan actual (dari stock opname)
- Variance = indikator waste/fraud

---

*Dokumen ini dibuat: 30 Mei 2026*
