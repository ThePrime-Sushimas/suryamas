---
type: module
slug: shortage-report
status: active
domain: "[[20-DOMAINS/Inventory/_Index|Inventory]]"
backend_path: backend/src/modules/shortage-report
frontend_path: frontend/src/features/shortage-report
api_base: /api/v1/shortage-report
permission_module: shortage_report
depends_on:
  - "[[30-MODULES/M-Stock|M-Stock]]"
  - "[[30-MODULES/M-Daily-Stock-Opname|M-Daily Stock Opname]]"
  - "[[30-MODULES/M-Stock-Adjustments|M-Stock Adjustments]]"
  - "[[30-MODULES/M-Products|M-Products]]"
  - "[[30-MODULES/M-Employees|M-Employees]]"
  - "[[30-MODULES/M-Departments|M-Departments]]"
  - "[[30-MODULES/M-Warehouses|M-Warehouses]]"
  - "[[30-MODULES/M-Branches|M-Branches]]"
used_by:
  - "[[70-FLOWS/Stock-Opname-Flow]]"
related_tables:
  - shortage_vcl (variance control lines — per-item shortage records from opname)
  - shortage_division_allocations (bagi rata antar karyawan per divisi)
  - stock_adjustments (when shortage converted to waste)
last_updated: 2026-06-16
---

# M-Shortage Report

## Purpose

Laporan **selisih kurang** (shortage) hasil dari stock opname — baik harian (daily opname) maupun bulanan (monthly opname). Digunakan untuk:

- Melacak semua item yang qty aktualnya **kurang** dari qty sistem.
- **Menyelesaikan** (resolve) shortage dengan dua opsi:
  1. **RESOLVE** — potong gaji karyawan (individu atau bagi rata divisi).
  2. **CONVERT_TO_WASTE** — konversi ke stock adjustment (waste) dan buat jurnal.
- Melihat total potongan yang sudah dibayar vs masih pending per karyawan/divisi.

## Kongsi — Hubungan dengan Modul Lain

| Modul | Peran |
|-------|-------|
| **Daily Stock Opname** | Sumber `source_type = 'DAILY_OPNAME'` — shortage muncul dari closing harian |
| **Monthly Stock Opname** | Sumber `source_type = 'MONTHLY_OPNAME'` — shortage muncul dari opname bulanan |
| **Stock Adjustments** | Saat `CONVERT_TO_WASTE`, shortage membuat stock adjustment + jurnal |
| **Employees, Departments** | Data karyawan/divisi untuk potongan gaji |
| **Warehouses, Branches** | Filter cabang & gudang |

## Layer Map

```
Routes → Controller → Service → Repository
  Schema    handleError      Audit        SQL queries
```

### Rute API

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/` | Report shortage utama + summary, bisa filter `summary_only=true` |
| GET | `/by-item` | Grouping shortage per item |
| GET | `/by-employee` | Grouping shortage per karyawan (potongan individu + alokasi divisi) |
| GET | `/by-department` | Grouping shortage per divisi (alokasi bagi rata) |
| GET | `/department-employees` | Preview karyawan aktif di suatu divisi/posisi |
| POST | `/resolve` | Selesaikan satu/beberapa baris shortage (RESOLVE / CONVERT_TO_WASTE) |
| PATCH | `/:id/deduction-paid` | Tandai potongan sudah dibayar / belum |
| PATCH | `/:id/edit-resolution` | Edit resolusi yang sudah ada |

## Key Business Rules

### 1. Multi-tenant + Soft Delete
- Semua query filter `company_id` dan `deleted_at IS NULL`.

### 2. Tipe Shortage (`source_type`)
| Source | Berasal Dari | Contoh |
|--------|-------------|--------|
| `DAILY_OPNAME` | Closing harian (daily_stock_opname) | Selisih shift malam |
| `MONTHLY_OPNAME` | Opname bulanan (monthly_stock_opname) | Selisih akhir bulan |

### 3. Status Resolve (`resolve_status`)
| Status | Arti |
|--------|------|
| `UNRESOLVED` | Belum diproses |
| `RESOLVED` | Sudah selesai (potong gaji) |
| `CONVERTED_TO_WASTE` | Dikonversi ke waste (stock adjustment + jurnal) |

### 4. Mode Potongan (`deduction_mode`)
| Mode | Cara Kerja |
|------|-----------|
| `INDIVIDUAL` | Potong ke satu karyawan (`deducted_employee_id`) |
| `DIVISION` | Bagi rata ke semua karyawan aktif di divisi (insert ke `shortage_division_allocations`) |

### 5. Validasi Resolve
- **`CONVERT_TO_WASTE`**: semua baris harus dari cabang, sesi opname, dan posisi yang **sama**. Reason (notes) wajib diisi. Membuat stock adjustment dan langsung confirm.
- **`RESOLVE`**: mode individu vs divisi. DIVISION membutuhkan `department_id`, akan split rata biaya ke seluruh karyawan aktif.

### 6. Audit Trail
Semua CREATE / UPDATE / DELETE / RESTORE tercatat via `AuditService.log` dengan metadata `{ action, vcl_ids?, id? }`.

## Panduan Penggunaan (User Guide)

### 🖥️ Cara Membuka Halaman
1. Login ke Suryamas ERP.
2. Navigasi: **Inventory → Shortage Report** (atau dari dashboard shortcut).
3. Halaman akan menampilkan report periode hari ini secara default.

### 📅 Filter Periode
- **Rentang Tanggal**: Pilih start date dan end date.
- **Cabang**: Filter per cabang. Default menampilkan semua cabang yang user punya akses.
- **Item / Kategori**: Filter berdasarkan produk atau kategori tertentu.
- **Posisi**: Filter berdasarkan posisi opname (jika dari daily opname).
- **Status Resolve**: UNRESOLVED / RESOLVED / CONVERTED_TO_WASTE atau semua.

### 📊 View yang Tersedia
| Tab | Deskripsi |
|-----|-----------|
| **Summary** | Total qty, cost, breakdown per status resolve, total potongan, pending potongan |
| **Per Item** | Grouping shortage per produk — lihat item mana paling sering shortage |
| **Per Karyawan** | Lihat total potongan per karyawan, berapa yang sudah dibayar |
| **Per Divisi** | Lihat total potongan per divisi, berapa karyawan terlibat |

### ✏️ Cara Resolve Shortage

#### Opsi A: Potong Gaji (RESOLVE)
1. Pilih satu/beberapa baris shortage yang statusnya **UNRESOLVED**.
2. Klik tombol **Resolve**.
3. Pilih action: **RESOLVE**.
4. Pilih mode:
   - **Individu**: Pilih karyawan yang bertanggung jawab. Jumlah potongan otomatis = total cost shortage, atau bisa diisi manual.
   - **Bagi Rata (Divisi)**: Pilih divisi. Biaya akan dibagi rata ke semua karyawan aktif di divisi tersebut.
5. Isi notes jika perlu.
6. Klik **Submit**.

#### Opsi B: Konversi ke Waste (CONVERT_TO_WASTE)
1. Pilih satu/beberapa baris shortage dari **sesi dan posisi yang sama**.
2. Klik **Resolve** → pilih **CONVERT_TO_WASTE**.
3. Isi **alasan konversi** (wajib).
4. Sistem akan: buat stock adjustment → confirm → jurnal otomatis.
5. Hasil: barang dianggap waste (biaya dibebankan ke operasional).

### 💰 Tanda Potongan Sudah Dibayar
- Setelah resolve, jika potong gaji individu → bisa ditandai **sudah dibayar** via tombol/toggle.
- Sistem akan update `deduction_paid_at`.
- Untuk mode DIVISI, pembayaran bisa di track per alokasi.

### ✏️ Edit Resolusi
- Karyawan atau divisi yang sudah dipilih bisa diubah.
- Mode resolusi bisa diganti (individu ↔ divisi).
- Notes bisa diperbarui.

## Query Flow Diagram

```
User pilih filter
       ↓
ShortageReportPage (frontend)
       ↓  GET /api/v1/shortage-report?start_date=...&end_date=...&branch_id=...
shortageReportController.getReport()
       ↓
    getBranchReadScope(req) → branchIds
       ↓
    buildFilter(req, branchIds)
       ↓
shortageReportService.getReport(filter)
       ↓
    buildContext(filter) → ShortageQueryContext
       ↓
    shortageReportRepository.getShortageRows(ctx)
       ↓
        SQL: SELECT dari shortage_vcl + JOIN branches, products, employees, dll
        WHERE company_id=?, deleted_at IS NULL, date BETWEEN start AND end
       ↓
    computeSummary(records)
       ↓
sendSuccess(res, { summary, records })
       ↓
Frontend render tabel + summary cards
```

## Known Gotchas / Pitfalls

- **Konversi ke waste butuh sesi & posisi sama**: Jika user pilih baris dari sesi berbeda → error. Pilih baris dari closing yang sama.
- **Division mode butuh karyawan aktif**: Jika divisi tidak punya karyawan aktif → error. Pastikan ada karyawan terdaftar di divisi & cabang terkait.
- **Lock concurrent**: Saat resolve, sistem hold row lock (`FOR UPDATE`) untuk mencegah double-process.
- **Hanya UNRESOLVED yang bisa diproses**: Baris yang sudah RESOLVED / CONVERTED_TO_WASTE tidak bisa dipilih.
- **COGS / Jurnal**: `CONVERT_TO_WASTE` menghasilkan jurnal (debit expense, credit inventory). Tergantung konfigurasi COA mapping.
- **Range maksimal**: Tidak ada limit ketat, tapi disarankan ≤ 366 hari.

## Related
- **API:** [[_API-Reference]]
- **Data:** [[_Data-Model]]
- **Relations:** [[_Relations]]
- **Flow:** [[70-FLOWS/Stock-Opname-Flow]]
- **Related Module:** [[30-MODULES/M-Waste-Report|M-Waste Report]]