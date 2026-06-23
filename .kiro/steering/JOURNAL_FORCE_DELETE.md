# Journal Header forceDelete — Cascade Architecture & Rules

## Overview

Method `forceDelete` di `backend/src/modules/accounting/journals/journal-headers/journal-headers.service.ts` adalah satu-satunya entry point untuk hard-delete journal dari halaman Journal Header UI. Method ini bertanggung jawab:

1. Menghapus journal itu sendiri (header + lines)
2. Membersihkan FK references di module lain yang mengarah ke journal ini
3. Me-reverse/revert side effects di module asal (status changes, stock movements, dll)
4. Menghapus sibling journals kalau journal ini bagian dari batch/group

## Prinsip Arsitektur

### Atomicity

Setiap handler WAJIB atomic — semua writes (termasuk delete journal `id` itu sendiri) berjalan dalam SATU `journalHeadersRepository.withTransaction(...)`. Pattern:

```typescript
} else if (
  journal.reference_type === 'xxx' &&
  journal.source_module === 'yyy' &&
  journal.reference_id
) {
  // Guard checks (read-only) — DI LUAR transaction
  // ...

  await journalHeadersRepository.withTransaction(async (client) => {
    // All writes — DI DALAM transaction
    // 1. Module-specific revert (pass client)
    // 2. Delete sibling journals (if cascade)
    // 3. clearReversalReferences(id, client)
    // 4. clearJournalReferences(id, client)
    // 5. delete(id, userId, client)
  })

  // Audit logs — DI LUAR transaction (best-effort)
  await AuditService.log(...)
  logInfo(...)
  return // WAJIB — skip generic cleanup di bawah
}
```

### Early Return

Setiap handler yang menangani delete journal sendiri WAJIB `return` di akhir block. Ini mencegah journal ter-delete dua kali oleh generic cleanup di bagian bawah method.

### Function Signature Pattern

Semua repository/service function yang dipanggil dari dalam transaction WAJIB menerima `client?: PoolClient` opsional. Kalau `client` diberikan: gunakan langsung, jangan buka transaction baru. Kalau standalone (no client): self-managed BEGIN/COMMIT/ROLLBACK.

### Reads Before Transaction

Kumpulkan semua ID yang diperlukan (payment journal IDs, sibling journal IDs, dll) SEBELUM membuka transaction. Ini menghindari long-running transaction dan memastikan reads tidak terganggu oleh writes di dalam transaction yang sama.

## Handler Registry (Complete)

| # | source_module | reference_type | Behavior | Sibling Cascade |
|---|---|---|---|---|
| 1 | `FISCAL_CLOSING` | — | **BLOCKED** (throw error, never allow delete) | — |
| 2 | `marketplace_po` | `marketplace_checkout_session` | Atomic revert (settled→RECEIVED + cleanup settlements). Independent per moment. | No |
| 3 | `marketplace_po` | `marketplace_bulk_settlement` | Atomic cascade: reverse ALL sessions in batch + delete ALL sibling journals | Yes (all journals in batch) |
| 4 | `ap_payments` | `ap_payment` | Atomic revert: payment PAID→APPROVED | No |
| 5 | `general_invoices` | `general_invoice` | Atomic cascade: delete payment journals + amort journals + CC settlement journals + hard-delete invoice/payments | Yes (all related journals) |
| 6 | `general_invoice_payments` | `general_invoice_payment` | Atomic cascade: same as #5 (finds parent invoice, deletes everything) | Yes |
| 7 | `purchase_invoice` | `purchase_invoice` | Atomic cascade: delete AP payment journals → revert AP payments → revert PI to APPROVED | Yes (AP payment journals) |
| 8 | `fixed_assets` | `depreciation_run` | Atomic cascade: rollback accum_depr, delete movements/entries/run + delete sibling journals (1 per branch) | Yes (all run journals) |
| 9 | `fixed_assets` | `asset_opening_balance` | Atomic cascade: hard-delete asset + movements + photos | No |
| 10 | `fixed_assets` | `fixed_asset` (capitalization) | Atomic revert: asset ACTIVE→DRAFT, clear journal_id, delete CAPITALIZE movement. **BLOCKED if asset has POSTED depreciation entries.** | No |
| 11 | `fixed_assets` | `asset_transfer` | **BLOCKED** (too risky: asset already moved branch, may have new depreciation) | — |
| 12 | `fixed_assets` | `asset_disposal` | Atomic revert (full only): asset DISPOSED→ACTIVE, disposal POSTED→DRAFT, delete DISPOSAL movement. **BLOCKED if partial disposal** (detected via movement `to_value !== 'DISPOSED'`). | No |
| — | (no handler match) | — | Generic fallback: `clearReversalReferences` → `clearJournalReferences` → `delete`. Non-atomic (3 separate calls). | No |

## clearJournalReferences — FK Cleanup

Method `_clearJournalRefsSequential` di `journal-headers.repository.ts` NULL-kan semua FK references ke journal yang dihapus. Tabel yang di-cover (per Juni 2026):

1. `bank_statements.journal_id`
2. `aggregated_transactions.journal_id` (+ reset status to READY)
3. `production_orders.journal_id` (+ reset status to COMPLETED)
4. `marketplace_checkout_sessions.journal_settled_id`
5. `marketplace_checkout_sessions.journal_ordered_id`
6. `marketplace_checkout_sessions.journal_received_id`
7. `ap_payments.journal_id`
8. `purchase_invoices.journal_id`
9. `general_invoices.journal_id`
10. `general_invoice_payments.journal_id`
11. `general_invoice_payments.cc_settlement_id` (via subquery ke marketplace_settlements)
12. `marketplace_settlements` (DELETE by journal_id)
13. `fixed_assets.journal_id`
14. `stock_adjustments.journal_id`
15. `stock_transfers.source_journal_id`
16. `stock_transfers.target_journal_id`
17. `asset_transfers.source_journal_id`
18. `asset_transfers.target_journal_id`
19. `asset_disposals.journal_id`

**Kalau ada tabel baru yang punya FK ke journal_headers**: WAJIB ditambahkan di sini.

## Guard Patterns

### Block by Source Module (hardcoded)

```typescript
if (journal.source_module === 'FISCAL_CLOSING') throw JournalErrors.CANNOT_DELETE_POSTED()
```

### Block by Condition (dynamic)

```typescript
// Capitalization: block if depreciation exists
const hasDep = await hasDepreciationEntries(journal.reference_id)
if (hasDep) throw JournalErrors.CANNOT_DELETE_POSTED()

// Disposal: block if partial (movement to_value check)
const movementToValue = await findDisposalMovementToValue(asset.id, disposal.id)
if (!movementToValue || movementToValue !== 'DISPOSED') throw JournalErrors.CANNOT_DELETE_POSTED()

// Transfer: always block (no condition needed)
throw JournalErrors.CANNOT_DELETE_POSTED()
```

## Saat Menambah Module Baru yang Create Journal

Kalau sebuah module baru mulai membuat journal (INSERT ke journal_headers), checklist:

1. **Tentukan source_module dan reference_type** — pastikan unik, konsisten, dan didokumentasikan.
2. **Tambahkan FK cleanup** di `_clearJournalRefsSequential` kalau module punya kolom yang reference journal_id.
3. **Putuskan behavior forceDelete:**
   - Apakah ada side effect yang perlu di-revert? (status change, stock movement, dll)
   - Apakah revert aman dilakukan secara otomatis? (kalau ada ambiguitas angka atau downstream dependency → BLOCK)
   - Apakah ada sibling journals? (1 transaksi = N journals → cascade)
4. **Implementasikan handler** di `forceDelete` mengikuti pattern di atas (atomic, early return, audit outside tx).
5. **Update tabel di dokumen ini.**

## Partial Disposal Detection (Technical Detail)

Pembeda partial vs full disposal **WAJIB menggunakan movement record**, bukan status asset saat ini:

```typescript
// BENAR — source of truth: movement record saat disposal di-post
const movementToValue = await findDisposalMovementToValue(asset.id, disposal.id)
const isFullDisposal = movementToValue === 'DISPOSED'

// SALAH — status asset bisa berubah dari event lain (disposal berikutnya)
const isFullDisposal = asset.status === 'DISPOSED' // BUG: bisa false-positive
```

Alasan: satu asset BISA di-dispose bertahap (partial 3, lalu partial 4, lalu full sisa 3). Status asset saat ini mencerminkan state TERAKHIR, bukan state saat disposal SPESIFIK ini terjadi.

## Files Terkait

- `backend/src/modules/accounting/journals/journal-headers/journal-headers.service.ts` — forceDelete method
- `backend/src/modules/accounting/journals/journal-headers/journal-headers.repository.ts` — clearJournalReferences, clearReversalReferences, delete, bulkHardDelete, withTransaction
- `backend/src/modules/fixed-assets/fixed-assets.repository.ts` — hasDepreciationEntries, revertCapitalizationFromJournal, hardDeleteAssetByJournalId, findDisposalMovementToValue
- `backend/src/modules/fixed-assets/depreciation.service.ts` — reverseDepreciationRunFromJournal
- `backend/src/modules/marketplace-po/marketplace-po.repository.ts` — reverseSettledSession, reverseBulkSettledSessions
- `backend/src/modules/ap-payments/ap-payments.repository.ts` — revertPaidAfterJournalDelete, findPaymentIdsWithJournalByInvoiceId
- `backend/src/modules/purchase-invoices/purchase-invoices.repository.ts` — updateStatus (for PI revert)
- `backend/src/modules/general-invoices/general-invoices.repository.ts` — generalInvoiceRepository.hardDelete, generalPaymentRepository.hardDeleteByInvoiceId, etc.
