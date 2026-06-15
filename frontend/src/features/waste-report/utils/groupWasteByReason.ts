import type { WasteReasonGroup, WasteRecord, WasteSource } from '../api/wasteReport.api'

const OPNAME_UNSPECIFIED_LABEL = 'Opname Harian (tanpa alasan)'
const UNSPECIFIED_LABEL = 'Belum diisi'

function resolveReasonBucket(record: WasteRecord): {
  label: string
  reason_key: string
  is_unspecified: boolean
} {
  const raw = record.reason?.trim() ?? ''
  if (!raw) {
    if (record.source === 'DAILY_OPNAME') {
      return {
        label: OPNAME_UNSPECIFIED_LABEL,
        reason_key: OPNAME_UNSPECIFIED_LABEL.toLowerCase(),
        is_unspecified: true,
      }
    }
    return {
      label: UNSPECIFIED_LABEL,
      reason_key: UNSPECIFIED_LABEL.toLowerCase(),
      is_unspecified: true,
    }
  }
  return {
    label: raw.charAt(0).toUpperCase() + raw.slice(1),
    reason_key: raw.toLowerCase(),
    is_unspecified: false,
  }
}

/** Group waste records by reason — mirrors former backend getByReason without a second API call. */
export function groupWasteByReason(records: WasteRecord[]): WasteReasonGroup[] {
  const grouped = new Map<
    string,
    {
      bucket: ReturnType<typeof resolveReasonBucket>
      total_cost: number
      total_qty: number
      record_count: number
      sources: Set<WasteSource>
    }
  >()

  for (const record of records) {
    const bucket = resolveReasonBucket(record)
    let entry = grouped.get(bucket.reason_key)
    if (!entry) {
      entry = {
        bucket,
        total_cost: 0,
        total_qty: 0,
        record_count: 0,
        sources: new Set(),
      }
      grouped.set(bucket.reason_key, entry)
    }
    entry.total_cost += record.total_cost
    entry.total_qty += record.qty
    entry.record_count += 1
    entry.sources.add(record.source)
  }

  const result: WasteReasonGroup[] = [...grouped.values()].map((entry) => ({
    reason: entry.bucket.label,
    reason_key: entry.bucket.reason_key,
    is_unspecified: entry.bucket.is_unspecified,
    ...(entry.sources.size === 1 ? { source_hint: [...entry.sources][0] } : {}),
    total_cost: entry.total_cost,
    total_qty: entry.total_qty,
    record_count: entry.record_count,
    percentage_of_total: 0,
  }))

  result.sort((a, b) => b.total_cost - a.total_cost)

  const grandTotal = result.reduce((sum, g) => sum + g.total_cost, 0)
  if (grandTotal > 0) {
    for (const group of result) {
      group.percentage_of_total = Math.round((group.total_cost / grandTotal) * 10000) / 100
    }
  }

  return result
}

export const OPNAME_REASON_KEY = OPNAME_UNSPECIFIED_LABEL.toLowerCase()
