---
type: module
slug: ap-payments
status: active
domain: "[[20-DOMAINS/Purchasing/_Index|Purchasing]]"
backend_path: backend/src/modules/ap-payments
frontend_path: frontend/src/features/ap-payments
api_base: /api/v1/ap-payments
permission_module: ap_payments
depends_on:
  - "[[30-MODULES/M-purchase-invoices]]"
  - "[[30-MODULES/M-suppliers]]"
  - "[[30-MODULES/M-bank-accounts]]"
  - "[[30-MODULES/M-accounting]]"
  - "[[30-MODULES/M-branches]]"
  - "[[30-MODULES/M-banks]]"
used_by:
  - "[[30-MODULES/M-accounting]]"
  - "[[30-MODULES/M-bank-accounts]]"
  - "[[30-MODULES/M-general-invoices]]"
related_tables:
  - ap_payments
  - ap_payment_batches
  - ap_payment_invoice_lines
last_updated: 2026-06-14
---

# M-AP Payments

## Purpose
Manages payments to suppliers against purchase invoices (PI). Supports single and batch payments, bank account assignment (source + destination), proof upload, journal posting, bank reconciliation, and OCR-based screenshot verification.

## Layer Map

### Backend
```
Routes → Controller → Service → Repository
```

| Layer       | File                             | Key Responsibility                                         |
|-------------|----------------------------------|------------------------------------------------------------|
| Routes      | `ap-payments.routes.ts`          | 30+ endpoints; middleware: `auth → resolveBranchContext → requireWriteAccess → permission → validateSchema` |
| Controller  | `ap-payments.controller.ts`      | Thin handlers with `sendSuccess` / `handleError`           |
| Service     | `ap-payments.service.ts`         | Business logic, state machine, transaction orchestration, audit logging (1424 lines) |
| Repository  | `ap-payments.repository.ts`      | DB queries — filter, pagination, JOINs, bulk operations    |
| Schema      | `ap-payments.schema.ts`          | Zod validation — list, create, update, bulk, reconcile, etc. |
| Types       | `ap-payments.types.ts`           | All interfaces: DB rows, DTOs, filters, dashboard, combined report |
| Errors      | `ap-payments.errors.ts`          | 20+ custom error classes (NotFound, BusinessRule, Conflict, Validation) |

### Frontend (Feature)
```
api/ → hooks/ → pages/ + components/ + utils/
```

| Directory    | Contents                                                    |
|--------------|-------------------------------------------------------------|
| `api/`       | `apPayments.api.ts` — TanStack Query hooks (list, detail, dashboard, outstanding, combined, bulk, create, mutations) |
| `hooks/`     | `useApPaymentFilters.ts` — URL-synced filters; `useBulkCreateState.ts` — bulk creation wizard state; `useCompanyBankAccounts.ts` |
| `pages/`     | `ApPaymentsPage`, `ApPaymentDetailPage`, `ApPaymentEditPage`, `ApPaymentReportPage`, `UnifiedPaymentReportPage`, `BulkCreatePage`, `BulkBatchDetailPage`, `ApDashboardPage` |
| `components/`| 20+ components: `AgingBadge`, `ApDueDatePivotSection`, `ApPaymentCalendarWeek`, `ApPaymentDayDetailDrawer`, `ApPaymentProofModal`, `ApPaymentRejectModal`, `ApPaymentsShell`, `BankAccountSelector`, `BatchProofUpload`, `BulkBadge`, `BulkPaymentBatchRows`, `BulkSelectionBar`, `BulkSummaryPanel`, `OutstandingInvoicesTab`, `PaymentProofUpload`, `SupplierGroupCard`, `VerifyScreenshotModal` |
| `utils/`     | Export (Excel), URL filter helpers, calendar utils, table column configs, session payload helpers |
| `types/`     | `apPaymentFilters.types.ts`, `sessionPayload.types.ts`     |

## API Endpoints

### Dashboard & Overview
| Method | Path | Description |
|--------|------|-------------|
| GET | `/dashboard` | Summary stats, aging buckets, supplier breakdown, due date pivot |
| GET | `/combined` | Unified PI + payment report (purchasing only) |

### Outstanding Invoices
| Method | Path | Description |
|--------|------|-------------|
| GET | `/outstanding-invoices` | Flat list of unpaid PIs |
| GET | `/outstanding-invoices/paginated` | Paginated + filterable outstanding list |
| POST | `/outstanding-invoices/by-ids` | Batch fetch by ID list |
| PATCH | `/outstanding-invoices/:id/assign` | Assign source bank account to PI |
| PATCH | `/outstanding-invoices/:id/assign-supplier-bank` | Assign supplier bank account |

### CRUD
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List (paginated, filterable) |
| GET | `/:id` | Detail with invoice lines, audit trail |
| POST | `/` | Create single payment (DRAFT) |
| PATCH | `/:id` | Update draft payment |
| DELETE | `/:id` | Soft delete |
| DELETE | `/:id/force` | Hard delete (force) |

### Bulk Payments
| Method | Path | Description |
|--------|------|-------------|
| POST | `/bulk` | Create multiple payments in a batch (multipart: JSON payload + optional files) |
| GET | `/batches/:batchId` | Get batch detail with all payments |

### State Transitions
| Method | Path | Description |
|--------|------|-------------|
| POST | `/:id/submit` | DRAFT → PENDING_APPROVAL |
| POST | `/:id/approve` | PENDING_APPROVAL → APPROVED |
| POST | `/:id/reject` | PENDING_APPROVAL → REJECTED |
| POST | `/:id/revert-draft` | REJECTED → DRAFT |
| POST | `/:id/pay` | APPROVED → PAID (with proof required) |
| POST | `/:id/proof` | Upload proof of payment (multipart) |
| POST | `/:id/post-journal` | Generate & post accounting journal |
| DELETE | `/:id/journal` | Delete journal (reversal) |
| POST | `/:id/reconcile` | PAID → RECONCILED (link bank statement) |
| GET | `/:id/reconcile-candidates` | List bank statements available for reconciliation |

### Screenshot Verification
| Method | Path | Description |
|--------|------|-------------|
| POST | `/verify-screenshot` | OCR-based payment verification against screenshot |

## State Machine

```
                    ┌───────────┐
                    │   DRAFT   │
                    └─────┬─────┘
                          │ submit
                          ▼
              ┌───────────────────────┐
              │  PENDING_APPROVAL     │
              └──┬────────────┬───────┘
        approve │            │ reject
                ▼            ▼
          ┌─────────┐  ┌──────────┐
          │APPROVED │  │ REJECTED │
          └────┬────┘  └────┬─────┘
               │ markPaid   │ revert-draft
               ▼             └─────→ DRAFT
          ┌──────────┐
          │   PAID   │
          └────┬─────┘
               │ reconcile
               ▼
          ┌────────────┐
          │ RECONCILED │
          └────────────┘

    Post-journal can be triggered at any point after APPROVAL.
    Force delete can bypass soft-delete at any status.
```

## Key Business Rules
- Payment requires at least one posted PI with `APPROVED` or `POSTED` status
- Amount paid **must not exceed** invoice outstanding balance
- Duplicate invoice check: an invoice cannot be added to two active payments simultaneously
- Line totals must match header `total_amount`
- **Proof required** before marking as PAID (`ApPaymentProofRequiredError`)
- Marking PAID requires all invoices to be POSTED (journal already exists) — `ApPaymentInvoiceNotPostedForPaidError`
- Batch payments via `ap_payment_batches` table (`20260522_ap_payment_batches`)
- Supplier bank account validation per invoice (`ApPaymentInvalidSupplierBankError`)
- COA mapping for payment journal must be complete (General AP Liability)
- Soft delete with `hasChildren()` guard: checks `ap_payment_invoice_lines` and journal before deletion

## Known Gotchas / Pitfalls
- `total_amount` comes back as **string** from PostgreSQL `NUMERIC` — must parse in service layer
- Payment release flow: `draft → pending_approval → approved → paid → reconciled`
- Released payments post journals automatically on markPaid
- Bulk create uses `documentUpload.any()` multipart — payload is in `payload` form field, not JSON body
- Revert-to-draft only allowed from `REJECTED` status (not from `APPROVED` or `PAID`)
- Force delete bypasses soft delete — only for admins / recovery scenarios
- Combined report uses unlimited query (`limit = -1`) for client-side merge with General Payments — see `UnifiedPaymentReportPage.tsx`
- Screenshot verification uses OCR to match amounts — only works with BCA VA format screenshots

## Database Schema

### `ap_payments`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| company_id | UUID | FK → companies |
| branch_id | UUID | FK → branches |
| payment_number | VARCHAR | Auto-generated |
| supplier_id | UUID | FK → suppliers |
| bank_account_id | INTEGER | FK → bank_accounts (source) |
| supplier_bank_account_id | INTEGER | Nullable; FK → supplier bank accounts |
| payment_method | VARCHAR | TRANSFER / CASH / CHECK / GIRO |
| total_amount | NUMERIC | |
| payment_date | DATE | Nullable |
| status | VARCHAR | DRAFT / PENDING_APPROVAL / APPROVED / REJECTED / PAID / RECONCILED |
| proof_url | TEXT | Stored in R2 `buktisetoran/` |
| journal_id | UUID | Nullable; FK → journal_headers |
| bulk_payment_batch_id | UUID | Nullable; FK → ap_payment_batches |
| bank_statement_id | INTEGER | Nullable; FK → bank_statements |
| is_deleted | BOOLEAN | Soft delete flag |

### `ap_payment_invoice_lines`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| ap_payment_id | UUID | FK → ap_payments |
| purchase_invoice_id | UUID | FK → purchase_invoices |
| amount_paid | NUMERIC | Per-invoice allocation |
| notes | TEXT | Nullable |

Index: `ap_payment_invoice_lines(ap_payment_id, purchase_invoice_id)` for performance

### `ap_payment_batches`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| company_id | UUID | FK → companies |
| notes | TEXT | Batch notes (max 500 chars) |
| created_at | TIMESTAMPTZ | |

## Unified Report (Purchase + General)
The module provides **two report pages**:

1. **`ApPaymentReportPage.tsx`** — Tab-based (Purchase Invoice vs General Payments tabs), each with independent filters
2. **`UnifiedPaymentReportPage.tsx`** — Single merged view with client-side merge, sort, and pagination; fetches both APIs with `limit = -1` (unlimited) and sorts by payment date

Frontend routing via `App.tsx`: `ApPaymentReportPage` re-exports `UnifiedPaymentReportPage` as default (path swapped in lazy import).

## Related
- [[70-FLOWS/PO-to-Payment]]
- [[_Data-Model]]
- [[30-MODULES/M-general-invoices/_Overview]] — General payments (similar payment lifecycle for non-PO invoices)