/**
 * statusMappings.ts — Contoh pola mapping status domain → semantic token
 *
 * PERHATIAN: File ini adalah REFERENSI PATTERN saja.
 * Tidak ada komponen yang mengimport file ini sekarang.
 * Tujuan: panduan untuk developer saat migrasi badge per-feature ke
 * komponen StatusBadge generik (fase berikutnya).
 *
 * Cara pakai di masa depan:
 *   import { statusMappings, semanticColors } from '@/lib/theme'
 *   const semanticKey = statusMappings.pettyCash['CLOSED']  // → 'success'
 *   const color = semanticColors[semanticKey]
 */

import type { SemanticColorKey } from './tokens'

// ─── Bank Reconciliation ─────────────────────────────────────────────────────
// Mapping ini adalah satu-satunya sumber kebenaran untuk legacy keys dari
// tailwind-theme.ts `components.statusBadge.*` (matched, unreconciled, dll).

export const reconciliationStatusMap: Record<string, SemanticColorKey> = {
  matched:      'success',
  unreconciled: 'warning',
  discrepancy:  'danger',
  pending:      'neutral',
}

// ─── Petty Cash ───────────────────────────────────────────────────────────────

export const pettyCashStatusMap: Record<string, SemanticColorKey> = {
  PENDING:   'neutral',
  DISBURSED: 'info',
  CLOSED:    'success',
  REJECTED:  'danger',
}

// ─── Fixed Assets ─────────────────────────────────────────────────────────────

export const fixedAssetStatusMap: Record<string, SemanticColorKey> = {
  DRAFT:       'neutral',
  ACTIVE:      'success',
  MAINTENANCE: 'warning',
  DISPOSED:    'danger',
}

// ─── Accounting Journal ───────────────────────────────────────────────────────

export const journalStatusMap: Record<string, SemanticColorKey> = {
  DRAFT:    'neutral',
  POSTED:   'success',
  REVERSED: 'warning',
  VOID:     'danger',
}

// ─── AP Payment ───────────────────────────────────────────────────────────────

export const apPaymentStatusMap: Record<string, SemanticColorKey> = {
  PENDING:  'neutral',
  APPROVED: 'info',
  PAID:     'success',
  REJECTED: 'danger',
  VOID:     'danger',
}

// ─── Purchase Invoice ─────────────────────────────────────────────────────────

export const purchaseInvoiceStatusMap: Record<string, SemanticColorKey> = {
  DRAFT:     'neutral',
  SUBMITTED: 'info',
  APPROVED:  'info',
  REJECTED:  'danger',
  POSTED:    'success',
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const statusMappings = {
  reconciliation: reconciliationStatusMap,
  pettyCash:      pettyCashStatusMap,
  fixedAsset:     fixedAssetStatusMap,
  journal:        journalStatusMap,
  apPayment:      apPaymentStatusMap,
  purchaseInvoice: purchaseInvoiceStatusMap,
} as const
