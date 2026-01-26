# TODO: Performance Fix - Audit & Optimization

## 🚨 HIGH PRIORITY (Akan diperbaiki sekarang)

### 1. Frontend - AccountSelector N+1 Problem ⚠️ CRITICAL
**File:** `frontend/src/features/accounting/journals/shared/AccountSelector.tsx`
- **Masalah:** Fetch accounts setiap component mount (20+ requests per halaman!)
- **Solusi:** Global caching dengan Zustand store + lazy loading
- **Dampak:** Mengurangi request dari 20+ menjadi 1
- **Status:** ✅ SELESAI

### 2. Backend - Journal Headers Service N+1 ⚠️ CRITICAL
**File:** `backend/src/modules/accounting/journals/journal-headers/journal-headers.service.ts:85-88`
```typescript
// N+1 Query - currently loops for each line
for (const line of data.lines) {
  await this.validateAccount(line.account_id, companyId)
}
```
- **Solusi:** Bulk validation dengan `IN` clause
- **Dampak:** 20 lines = 20 queries → 1 query
- **Status:** ✅ SELESAI

---

## 🔴 MEDIUM PRIORITY (Perlu diperbaiki)

### 3. Products Export Service N+1
**File:** `backend/src/services/products.export.service.ts`
```typescript
for (const product of products) {
  const uoms = await productUomsRepository.findByProductId(product.id)  // N+1!
}
```

### 4. Employee Branches Bulk Operations
**File:** `backend/src/modules/employee_branches/employee_branches.service.ts`
```typescript
for (const id of ids) {
  const existing = await employeeBranchesRepository.findById(id)  // N+1!
}
```

### 5. Payment Methods Bulk Operations
**File:** `backend/src/modules/payment-methods/payment-methods.service.ts`
```typescript
for (const id of ids) {
  const paymentMethod = await this.repository.findById(id, trx)  // N+1!
}
```

### 6. Chart of Accounts Bulk Operations
**File:** `backend/src/modules/accounting/chart-of-accounts/chart-of-accounts.service.ts`
```typescript
for (const id of ids) {
  const account = await this.repository.findById(id, trx)  // N+1!
}
```

### 7. Accounting Purpose Accounts Bulk Operations
**File:** `backend/src/modules/accounting/accounting-purpose-accounts/accounting-purpose-accounts.service.ts`
```typescript
for (const accountData of data.accounts) {
  const { data: account, error } = await supabase  // N+1!
}
```

### 8. Pos Aggregates Processing
**File:** `backend/src/modules/pos-imports/pos-aggregates/pos-aggregates.service.ts`
```typescript
for (const tx of transactions) {
  try { await this.repository.updateStatus(tx.id, 'FAILED', reason) }  // Batch individually!
}
```

### 9. Permission Service Bulk Operations
**File:** `backend/src/services/permission.service.ts`
```typescript
for (const update of updates) {
  const { data: oldPerm } = await supabase  // N+1!
}
```

---

## ✅ COMPLETED TASKS
- [x] Analisis awal - AccountSelector.tsx (20+ requests per page load!)
- [x] Analisis backend - journal-headers.service.ts (N+1 validation)
- [x] Audit menyeluruh - Ditemukan 276+ pola N+1 potensial
- [x] Kategorisasi masalah berdasarkan prioritas
- [x] Implement global caching store (Zustand)
- [x] Refactor AccountSelector.tsx untuk menggunakan cached store

