# 📊 POS Reconciliation Module - Project Plan

## 📌 Ringkasan Eksekutif

Module reconciliation ini berfungsi untuk mencocokkan data POS aggregates dengan mutasi bank, serta menghitung dan memvalidasi fee/biaya yang dikenakan (seperti Gojek, MDR, iklan).

**Alur Kerja:**
1. POS IMPORT -> DATABASE
2. POS AGGREGATES BERDASARKAN PAYMENT TYPE
3. HITUNG BIAYA (MDR, PLATFORM FEE)
4. COCOKAN DENGAN MUTASI BANK
5. SELISIH = BIAYA IKLAN / BIAYA LAIN (MANUAL REVIEW)
6. MASUK KE JOURNAL

**Status Saat Ini (Per Update):**
- ✅ Types & Interfaces - 100% Done
- ✅ Error Handling - 100% Done  
- ✅ Orchestrator Service - 100% Done
- ✅ Fee Calculation Service - 100% Done
- ✅ Marketing Fee Service - 100% Done
- ✅ Database Migrations - 100% Done
- ✅ Fee Reconciliation Service - 100% Done
- ✅ Payment Methods + Fee Config (Backend) - 100% Done
- ✅ Payment Methods + Fee Config (Frontend) - 100% Done
- 🚧 POS Reconciliation - In Progress
- 🚧 Bank Statement Import - In Progress
- ⏳ Bank Reconciliation Service - Pending
- ⏳ Controllers - Pending
- ⏳ Repositories - Pending
- ⏳ Manual Review & Journal - Pending

---

## 🎯 Fitur Utama

1. **POS Import** - Import dan agregasi transaksi dari berbagai platform
2. **POS Aggregates** - Agregasi berdasarkan payment type (Tunai, QRIS, Kartu, dll)
3. **Fee Calculation** - Perhitungan biaya compound (percentage + fixed per transaction)
4. **Bank Reconciliation** - Pencocokan dengan mutasi bank
5. **Marketing Fee Identification** - Identifikasi biaya iklan dari selisih
6. **Journal Generation** - Generate jurnal dengan jumlah NETT
7. **Manual Review** - Review untuk biaya iklan/biaya lain yang tidak teridentifikasi otomatis

---

## 🚀 FASE PENGEMBANGAN

### 📅 PHASE 1: CORE FOUNDATION (Minggu 1-2)

**Fokus:** Setup database schema, types, dan core services

| Item | Status | Estimasi | Priority |
|------|--------|----------|----------|
| Database Schema Design | ⏳ Pending | 3 hari | HIGH |
| Migration Scripts | ⏳ Pending | 5 hari | HIGH |
| Repository Layer | ⏳ Pending | 5 hari | HIGH |
| Types & Interfaces | ✅ Done | - | - |
| Error Handling | ✅ Done | - | - |
| Orchestrator Service | ✅ Done | 3 hari | - |

**Deliverable:** Schema database siap, repositories tersedia untuk semua entities

### 📅 PHASE 2: POS AGGREGATION (Minggu 3-4)

**Fokus:** Agregasi data POS berdasarkan payment type

| Item | Status | Estimasi | Priority |
|------|--------|----------|----------|
| POS Import Parser | ⏳ Pending | 3 hari | HIGH |
| Payment Type Aggregation | ⏳ Pending | 4 hari | HIGH |
| POS Aggregation Service | ⏳ Pending | 3 hari | HIGH |
| Duplicate Detection | ⏳ Pending | 1 hari | MEDIUM |
| POS Reconciliation Service | 🚧 In Progress | 3 hari | HIGH |

**Deliverable:** Data POS teragregasi berdasarkan payment type

### 📅 PHASE 3: FEE CALCULATION (Minggu 5-6) - ✅ COMPLETE

**Fokus:** Perhitungan biaya (MDR, platform fee, dll)

| Item | Status | Estimasi | Priority |
|------|--------|----------|----------|
| Fee Calculation Service | ✅ Done | 3 hari | HIGH |
| Compound Fee Logic | ✅ Done | - | - |
| MDR Calculation (0.7%) | ✅ Done | 2 hari | HIGH |
| Platform Fee (20% + Fixed) | ✅ Done | 2 hari | HIGH |
| Marketing Fee Service | ✅ Done | 2 hari | MEDIUM |
| Unit Tests (50+ cases) | ✅ Done | 1 hari | HIGH |

**Deliverable:** Biaya terhitung dengan akurat untuk setiap transaksi

### 📅 PHASE 4: BANK RECONCILIATION (Minggu 7-8)

**Fokus:** Import mutasi bank dan pencocokan dengan POS aggregates

| Item | Status | Estimasi | Priority |
|------|--------|----------|----------|
| Bank Statement Import | 🚧 In Progress | 3 hari | HIGH |
| Bank Reconciliation Service | ⏳ Pending | 4 hari | HIGH |
| Difference Calculation | ⏳ Pending | 2 hari | HIGH |
| Auto-Matching Algorithm | ⏳ Pending | 3 hari | HIGH |

**Deliverable:** POS aggregates cocok dengan mutasi bank

### 📅 PHASE 5: MANUAL REVIEW & JOURNAL (Minggu 9-10)

**Fokus:** Review selisih dan generate jurnal

| Item | Status | Estimasi | Priority |
|------|--------|----------|----------|
| Manual Review Interface | ⏳ Pending | 3 hari | MEDIUM |
| Journal Generation | ⏳ Pending | 4 hari | HIGH |
| Approval Workflow | ⏳ Pending | 2 hari | MEDIUM |
| Reporting | ⏳ Pending | 3 hari | MEDIUM |

**Deliverable:** Jurnal tergenerate, selisih di-review

---

## 🔧 FEE CALCULATION STRATEGY

### Rumus Perhitungan Biaya

**Compound Fee (Percentage + Fixed):**
```
Total Fee = (Gross Amount × Percentage) + (Fixed Amount × Transaction Count)
```

**Contoh:**
- MDR 0.7%: (1,000,000 × 0.007) = 7,000
- Platform Fee 20% + Fixed 2,000 per transaksi: (1,000,000 × 0.20) + 2,000 = 202,000

### Kategori Biaya

| Jenis Biaya | Tipe | Rate | Keterangan |
|-------------|------|------|------------|
| MDR | Percentage | 0.7% | Biaya mesin EDC |
| Platform Online | Compound | 20% + 2,000 | Biaya platform (Gojek, Grab, dll) |
| Iklan | Manual | - | Selisih dari perhitungan, perlu review |

---

## 📊 RECONCILIATION WORKFLOW

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   POS IMPORT    │ -> │      DB         │ -> │ POS AGGREGATES  │
│                 │    │                 │    │ (by Payment)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                      │
                                                      v
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     JOURNAL     │ <- │  MANUAL REVIEW  │ <- │  BANK MUTATION  │
│                 │    │  (Ads/Other)    │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
       ▲                                              │
       │                                              v
       │                                    ┌─────────────────┐
       │                                    │  RECONCILIATION │
       │                                    │ (Match + Diff)  │
       │                                    └─────────────────┘
       │                                              │
       +----------------------------------------------+
                         │
                         v
               ┌─────────────────┐
               │ FEE CALCULATION │
               │ (MDR, Platform) │
               └─────────────────┘
```

---

## 📁 FOLDER STRUCTURE

```
reconciliation/
├── index.ts                          # Main exports
├── reconsiliation.md                 # Documentation
├── shared/
│   ├── reconciliation.types.ts       # Types & interfaces
│   ├── reconciliation.constants.ts   # Constants
│   ├── reconciliation.errors.ts      # Error definitions
│   └── types.ts                      # Additional types
├── orchestrator/
│   └── reconciliation-orchestrator.service.ts
├── fee-reconciliation/
│   ├── fee-reconciliation.service.ts
│   ├── fee-reconciliation.controller.ts
│   ├── fee-reconciliation.repository.ts
│   ├── fee-calculation.service.ts
│   ├── marketing-fee.service.ts
│   └── index.ts
├── bank-statement-import/            # Import mutasi bank
│   ├── bank-statement-import.service.ts
│   ├── bank-statement-import.controller.ts
│   └── index.ts
├── bank-reconciliation/              # Pencocokan bank
│   ├── bank-reconciliation.service.ts
│   ├── bank-reconciliation.controller.ts
│   ├── bank-reconciliation.repository.ts
│   └── index.ts
└── review-approval/                  # Manual review
    ├── manual-review.service.ts
    └── manual-review.controller.ts
```

**Catatan:** 
- Folder `pos-reconciliation` **DIHAPUS** karena sudah ada feature `pos-aggregates` yang lengkap di frontend dan API.
- Folder `settlement-import` tidak diperlukan untuk alur POS reconciliation ini.

---

## 🗄️ DATABASE SCHEMA (Draft)

### Tables Needed

1. **pos_aggregates** - Hasil agregasi POS per payment type
2. **fee_masters** - Konfigurasi biaya (MDR, platform fee)
3. **applied_fees** - Biaya yang sudah dihitung per transaksi
4. **marketing_fees** - Biaya iklan yang diidentifikasi dari selisih
5. **reconciliation_runs** - Log proses reconciliation
6. **reconciliation_discrepancies** - Selisih yang perlu di-review

### ER Diagram (Simplified)

```
pos_aggregates
├── id (PK)
├── company_id
├── branch_id
├── transaction_date
├── payment_type
├── gross_amount
├── transaction_count
├── nett_amount (gross - fees)
└── reconciled (boolean)

fee_masters
├── id (PK)
├── company_id
├── fee_type (MDR, PLATFORM, ADS)
├── platform_code (GOJEK, GRAB, etc)
├── calculation_method (PERCENTAGE, FIXED, COMPOUND)
├── percentage_rate
├── fixed_amount
├── apply_to (PER_TRANSACTION, TOTAL)
└── is_active

applied_fees
├── id (PK)
├── pos_aggregate_id (FK)
├── fee_master_id (FK)
├── expected_amount
├── actual_amount
└── difference_amount

marketing_fees
├── id (PK)
├── pos_aggregate_id (FK)
├── difference_amount
├── identified_amount
├── status (PENDING, APPROVED, REJECTED)
└── notes

reconciliation_discrepancies
├── id (PK)
├── pos_aggregate_id (FK)
├── bank_statement_id (FK)
├── difference_amount
├── discrepancy_type (OVER, UNDER, UNEXPLAINED)
└── resolution_status
```

---

## 🛠️ TECHNICAL STACK

- **Language:** TypeScript
- **Framework:** Node.js + Express
- **Database:** PostgreSQL (Supabase)
- **ORM:** Prisma or TypeORM
- **Queue:** Bull (Redis-based) untuk background jobs
- **Validation:** Zod

---

## 📈 KPIs & METRICS

| Metric | Target | Description |
|--------|--------|-------------|
| Auto-match rate | >90% | Percentage of transactions matched automatically |
| Fee accuracy | >95% | Percentage of fees calculated correctly |
| Processing time | <5 min | Time untuk process 1000 transaksi |
| Manual review rate | <10% | Percentage yang perlu manual review |

---

## 🚨 POTENTIAL ISSUES & SOLUTIONS

| Issue | Impact | Solution |
|-------|--------|----------|
| Uncalculated costs (Gojek, MDR, ads) | HIGH | Fee calculation service dengan compound fee |
| 7 branches x 3 platforms | MEDIUM | Batch processing dengan configurable rules |
| Bank format changes | HIGH | Configurable bank parsers |
| Data corruption | HIGH | Backup before migration, validation checks |
| Performance dengan large data | MEDIUM | Indexing, pagination, caching |

---

## 🎯 SOLUSI DARI USER

### Opsi 1: Import Settlement Table
- Import data settlement dari platform (CR)
- **Kendala:** 7 cabang x 3 platform = 21 kombinasi
- **Solusi:** Batch processing dengan progress tracking

### Opsi 2: Create Cost Table
- Buat table biaya dengan rate yang sudah ditentukan:
  - MDR: 0.7%
  - Platform Online: 20% + 2,000 per transaksi
- **Hasil:** POS aggregates + Cost table = Expected net
- **Cocokan:** Expected net vs Mutasi bank
- **Selisih:** Biaya iklan/biaya lain (Manual review)

**Rekomendasi:** Gunakan Opsi 2 dengan FeeMaster table untuk fleksibilitas.

---

## 📚 NEXT STEPS

1. **Segera:** Review dan approve plan ini
2. **Minggu 1:** Mulai dengan database schema design
3. **Minggu 3:** Implement POS aggregation
4. **Minggu 5:** Implement fee calculation
5. **Minggu 7:** Implement bank reconciliation
6. **Minggu 9:** Implement manual review dan journal

---

## 📚 NEXT STEPS (Berdasarkan Status Saat Ini)

### 🎯 PRIORITAS SELANJUTNYA

#### 1. **Phase 4: Bank Reconciliation (Minggu 7-8)** - HIGH PRIORITY
Setelah Fee Calculation selesai, fokus selanjutnya adalah mencocokkan dengan bank statement:

| Task | Estimasi | Dependency |
|------|----------|------------|
| Bank Statement Import Service | 3 hari | Fee config sudah ada |
| Bank Reconciliation Service | 4 hari | POS aggregates + Fee config |
| Auto-Matching Algorithm | 3 hari | Bank import + Fee calc |

**Deliverable:** Sistem bisa mencocokkan expected net (dari fee config) dengan actual dari bank

#### 2. **Integrasi POS Aggregates**
Fee reconciliation service saat ini masih menggunakan stub untuk:
- `getAggregatedTransactions()` - Perlu integrasi dengan `pos_aggregates` table
- `getBankDeposits()` - Perlu integrasi dengan `bank_statements` table

#### 3. **Database Integration**
Implementasi database untuk:
- `approveMarketingFee()` - Update status di database
- `rejectMarketingFee()` - Update status + reason di database
- `getDailySummary()` - Aggregation query

### 🚀 JALAN CEPAT: Test-Driven Development

Karena fee calculation sudah 100% dengan unit tests, langkah selanjutnya adalah:

1. **Jalankan Migration** di Supabase:
   ```sql
   -- Copy isi migrations/xxxx_add_fee_columns_to_payment_methods.sql
   -- Jalankan di Supabase SQL Editor
   ```

2. **Install Dependencies**:
   ```bash
   npm install --save-dev @types/jest
   ```

3. **Run Tests**:
   ```bash
   npm test
   ```

4. **Test Manual**:
   - Create payment method dengan fee config (Gojek: 20% + 500/tx)
   - Verify fee calculation dengan sample data

### 📁 FILE STRUCTURE SAAT INI

```
reconciliation/
├── reconsiliation.md                          # Documentation (Updated)
├── fee-reconciliation/
│   ├── index.ts                              # Exports
│   ├── fee-calculation.service.ts            # ✅ Core calculation (Done)
│   ├── fee-calculation.service.test.ts       # ✅ 50+ tests (Done)
│   ├── fee-reconciliation.service.ts         # ✅ Reconciliation logic (Done)
│   ├── marketing-fee.service.ts              # ✅ Marketing fee ID (Done)
│   ├── PAYMENT_METHOD_FEE_MD.md              # ✅ Documentation (Done)
│   ├── TODO.md                               # ✅ Implementation notes (Done)
│   └── migrations/
│       └── xxxx_add_fee_columns_to_payment_methods.sql  # ✅ Migration (Done)
```

**Last Updated:** Phase 3 Complete - Fee Calculation Done  
**Version:** 4.0 (Fee Calculation Complete)  
**Maintained By:** Backend Team

