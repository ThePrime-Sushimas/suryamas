# Task: Add Fee Breakdown Columns to Aggregated Transactions

## Overview
Menambahkan 3 kolom breakdown fee ke tabel `aggregated_transactions` untuk transparansi dan audit trail perhitungan fee payment method.

## Kolom yang Ditambahkan
1. `percentage_fee_amount` (NUMERIC) - Fee dari persentase
2. `fixed_fee_amount` (NUMERIC) - Fee tetap (per transaksi/total)
3. `total_fee_amount` (NUMERIC) - Total fee (percentage + fixed)

**Validasi:** `net_amount = gross_amount - total_fee_amount`

---

## Progress Tracking

### 1. Database Migration ✅ / ❌
- [ ] Create Supabase migration file
- [ ] Add 3 new columns with default values
- [ ] Add validation constraint
- [ ] Test migration on dev database
- [ ] Update existing records with calculated values

### 2. Backend Updates ✅ / ❌

#### 2.1 Types & Interfaces
- [ ] Update aggregated_transactions type definitions
- [ ] Add fee breakdown to response DTOs
- [ ] Update validation schemas

#### 2.2 POS Aggregates Module
- [ ] Update aggregation logic to calculate fee breakdown
- [ ] Modify insert/update queries to include fee columns
- [ ] Update service methods
- [ ] Add fee calculation helper functions

#### 2.3 Reconciliation Module
- [ ] Update reconciliation orchestrator to use new fee columns
- [ ] Modify matching logic if needed
- [ ] Update fee calculation service integration

#### 2.4 API Responses
- [ ] Ensure fee breakdown fields are included in API responses
- [ ] Update serialization logic

### 3. Frontend Updates ✅ / ❌

#### 3.1 Types
- [ ] Update AggregatedTransaction interface
- [ ] Add fee breakdown types

#### 3.2 Manual Match Modal
- [ ] Display fee breakdown in transaction details
- [ ] Show percentage fee
- [ ] Show fixed fee
- [ ] Show total fee

#### 3.3 Bank Reconciliation Table
- [ ] Add fee breakdown tooltip/details
- [ ] Update POS Match column to show breakdown

---

## Files to Modify

### Database
- [ ] supabase migration file

### Backend
- [ ] backend/src/modules/pos-aggregates/pos-aggregates.types.ts
- [ ] backend/src/modules/pos-aggregates/pos-aggregates.service.ts
- [ ] backend/src/modules/reconciliation/orchestrator/reconciliation-orchestrator.service.ts

### Frontend
- [ ] frontend/src/features/pos-aggregates/types/index.ts
- [ ] frontend/src/features/bank-reconciliation/types/bank-reconciliation.types.ts
- [ ] frontend/src/features/bank-reconciliation/components/reconciliation/ManualMatchModal.tsx

---

## Testing Checklist
- [ ] Migration runs successfully
- [ ] Fee breakdown calculates correctly
- [ ] Display shows in Manual Match modal
- [ ] Bank reconciliation still works
