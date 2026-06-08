---
type: module
slug: ap-payments
status: active
domain: "[[20-DOMAINS/Purchasing/_Index|Purchasing]]"
backend_path: backend/src/modules/ap-payments
api_base: /api/v1/ap-payments
permission_module: ap_payments
depends_on:
  - "[[30-MODULES/M-purchase-invoices]]"
  - "[[30-MODULES/M-suppliers]]"
  - "[[30-MODULES/M-bank-accounts]]"
  - "[[30-MODULES/M-accounting]]"
  - "[[30-MODULES/M-branches]]"
used_by:
  - "[[30-MODULES/M-accounting]]"
  - "[[30-MODULES/M-bank-accounts]]"
related_tables:
  - ap_payments
  - ap_payment_batches
  - ap_payment_invoice_lines
last_updated: 2026-06-08
---

# M-AP Payments

## Purpose
Manages payments to suppliers against purchase invoices. Supports batch payments, bank account assignment, and payment reconciliation.

## Layer Map
```
Routes → Controller → Service → Repository
```

## Key Business Rules
- Payment requires at least one posted PI
- Batch payments via `ap_payment_batches` table (`20260522_ap_payment_batches`)
- Bank account routing via `pi_assigned_bank_account` on PI header
- Payment posts to General AP Liability COA (see `20260526_seed_general_ap_liability`)
- Payment terms calculation type check (`20260523_payment_terms_calculation_type_check`)

## Known Gotchas / Pitfalls
- Payment release flow: `draft → approved → released`
- Released payments post journals automatically
- Batch index on `ap_payment_invoice_lines` for performance

## Related
- [[70-FLOWS/PO-to-Payment]]
- [[_Data-Model]]