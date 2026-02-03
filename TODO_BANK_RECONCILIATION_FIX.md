# TODO: Fix Bank Reconciliation POS Match Not Showing

## Problem
Kolom POS Match showing "-" karena `matched_aggregate` tidak ter-fetch dari database.

## Root Cause
1. Di `bank-reconciliation.repository.ts:206`, semua row di-set `matched_aggregate: null`
2. Query tidak join dengan `aggregated_transactions` untuk mengambil data reconciliation

## Plan

### Step 1: Update Repository
**File:** `backend/src/modules/reconciliation/bank-reconciliation/bank-reconciliation.repository.ts`

Modifikasi `getByDateRange` untuk:
- Join ke `aggregated_transactions` menggunakan `reconciliation_id`
- Select data POS match (nett_amount, payment_method_name, etc)

### Step 2: Update Service
**File:** `backend/src/modules/reconciliation/bank-reconciliation/bank-reconciliation.service.ts`

Update `getStatements` untuk:
- Parse `matched_aggregate` dari data yang sudah di-join
- Hapus default `matched_aggregate: null`

## Progress

- [ ] Step 1: Update Repository - Join aggregated_transactions
- [ ] Step 2: Update Service - Parse matched_aggregate data
- [ ] Step 3: Test di browser

