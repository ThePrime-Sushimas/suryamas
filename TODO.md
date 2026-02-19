# TODO: Refactoring Audit Log Structure

## Goal
Rapihkan struktur audit log dengan memisahkan concerns: Service ↔ Repository

## Tasks

- [x] 1. Buat `monitoring.errors.ts` - Error classes untuk monitoring module
- [x] 2. Buat `monitoring.repository.ts` - Repository layer untuk audit & error logs
- [x] 3. Update `audit.service.ts` - Gunakan monitoringRepository
- [x] 4. Update `monitoring/index.ts` - Export AuditService
- [x] 5. Identifikasi module lain yang perlu register ke monitoring

## Progress
```
[██████████████████████████] 100%
```

---

## 📋 Module yang Menggunakan AuditService

Berikut adalah **17 module** yang sudah menggunakan `AuditService`:

| No | Module | Path |
|----|--------|------|
| 1 | product-uoms | `modules/product-uoms/product-uoms.service.ts` |
| 2 | products | `modules/products/products.service.ts` |
| 3 | categories | `modules/categories/categories.service.ts` |
| 4 | companies | `modules/companies/companies.service.ts` |
| 5 | employees | `modules/employees/employees.service.ts` |
| 6 | employee_branches | `modules/employee_branches/employee_branches.service.ts` |
| 7 | branches | `modules/branches/branches.service.ts` |
| 8 | payment-methods | `modules/payment-methods/payment-methods.service.ts` |
| 9 | payment-terms | `modules/payment-terms/payment-terms.service.ts` |
| 10 | metric-units | `modules/metric-units/metricUnits.service.ts` |
| 11 | sub-categories | `modules/sub-categories/sub-categories.service.ts` |
| 12 | supplier-products | `modules/supplier-products/supplier-products.service.ts` |
| 13 | permissions/roles | `modules/permissions/roles.service.ts` |
| 14 | accounting/fiscal-periods | `modules/accounting/fiscal-periods/fiscal-periods.service.ts` |
| 15 | accounting/accounting-purposes | `modules/accounting/accounting-purposes/accounting-purposes.service.ts` |
| 16 | accounting/accounting-purpose-accounts | `modules/accounting/accounting-purpose-accounts/accounting-purpose-accounts.service.ts` |
| 17 | accounting/chart-of-accounts | `modules/accounting/chart-of-accounts/chart-of-accounts.service.ts` |

---

## ⚠️ Module yang BELUM Menggunakan AuditService

Berikut adalah **module yang punya service tapi TIDAK menggunakan AuditService**:

| No | Module | Kemungkinan Perlu Audit |
|----|--------|------------------------|
| 1 | banks | ✅ Ya - master data |
| 2 | bank-accounts | ✅ Ya - master data |
| 3 | jobs | ⚠️ Cek - bisa jadi tidak perlu |
| 4 | users | ✅ Ya - master data |
| 5 | suppliers | ✅ Ya - master data |
| 6 | pricelists | ✅ Ya - master data |
| 7 | pos-imports | ✅ Ya - ada import data |
| 8 | reconciliation | ✅ Ya - transaksi sensitif |

---

## 📁 Struktur File Monitoring Module

```
backend/src/modules/monitoring/
├── index.ts                    ✅ Updated - export all
├── monitoring.routes.ts        ✅ Already exists
├── monitoring.controller.ts   ✅ Already exists
├── monitoring.types.ts        ✅ Already exists
├── monitoring.errors.ts       ✅ NEW - error classes
└── monitoring.repository.ts    ✅ NEW - repository layer
```

---

## ✅ Summary

- **File baru dibuat**: 2 file (`monitoring.errors.ts`, `monitoring.repository.ts`)
- **File diupdate**: 2 file (`audit.service.ts`, `monitoring/index.ts`)
- **Module menggunakan AuditService**: 17 module
- **Module perlu dicek**: ~8 module

