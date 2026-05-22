import type { SessionPayloadItem } from '../types/sessionPayload.types'

const SESSION_KEY = 'bulk_selected_invoices'

/**
 * Reads and parses the bulk payment session payload from sessionStorage.
 * Supports both V2 format ({ invoiceId, bankAccountId }[]) and
 * V1 format (string[]) for backward compatibility.
 *
 * Returns null for absent, empty, or unparseable values.
 */
export function getStoredSessionPayload(): SessionPayloadItem[] | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return null

    // V2 format: array of objects
    if (typeof parsed[0] === 'object' && 'invoiceId' in parsed[0]) {
      return parsed as SessionPayloadItem[]
    }
    // V1 format: array of strings (backward compat)
    if (typeof parsed[0] === 'string') {
      return (parsed as string[]).map((id) => ({ invoiceId: id, bankAccountId: null }))
    }
    return null
  } catch {
    return null
  }
}
