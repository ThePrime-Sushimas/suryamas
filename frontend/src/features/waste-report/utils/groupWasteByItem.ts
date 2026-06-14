import type { WasteByItemGroup, WasteRecord, WasteSource } from '../api/wasteReport.api'

function emptyBreakdownBySource(): Record<WasteSource, { qty: number; cost: number }> {
  return {
    GOODS_PROCESSING: { qty: 0, cost: 0 },
    STOCK_ADJUSTMENT: { qty: 0, cost: 0 },
    PRODUCTION_ORDER: { qty: 0, cost: 0 },
    DAILY_OPNAME: { qty: 0, cost: 0 },
  }
}

/** Group waste records by product — mirrors backend getByItem without a second API call. */
export function groupWasteByItem(records: WasteRecord[]): WasteByItemGroup[] {
  const grouped = new Map<string, WasteByItemGroup>()

  for (const record of records) {
    let group = grouped.get(record.item_id)
    if (!group) {
      group = {
        item_id: record.item_id,
        item_name: record.item_name,
        total_qty: 0,
        total_cost: 0,
        record_count: 0,
        breakdown_by_source: emptyBreakdownBySource(),
      }
      grouped.set(record.item_id, group)
    }
    group.total_qty += record.qty
    group.total_cost += record.total_cost
    group.record_count += 1
    group.breakdown_by_source[record.source].qty += record.qty
    group.breakdown_by_source[record.source].cost += record.total_cost
    if (!group.item_name && record.item_name) group.item_name = record.item_name
  }

  return [...grouped.values()].sort((a, b) => b.total_cost - a.total_cost)
}
