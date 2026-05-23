import { pool } from '../config/db'
import type { PoolClient } from 'pg'

export type PoReceiptFulfillmentStatus = 'FULLY_RECEIVED' | 'PARTIAL_RECEIVED'

export interface PoLineReceiptProgress {
  qty: number
  qty_received: number
  qty_short_closed: number
}

export function isPoLineFulfilled(line: PoLineReceiptProgress): boolean {
  return line.qty_received + line.qty_short_closed >= line.qty
}

/** Shared PO fulfillment check: received + short-closed vs ordered qty per line. */
export function resolvePoReceiptStatusFromLines(
  lines: PoLineReceiptProgress[],
): PoReceiptFulfillmentStatus {
  if (lines.length === 0) return 'PARTIAL_RECEIVED'
  return lines.every(isPoLineFulfilled) ? 'FULLY_RECEIVED' : 'PARTIAL_RECEIVED'
}

export async function queryPoReceiptStatus(
  poId: string,
  client?: PoolClient,
): Promise<PoReceiptFulfillmentStatus> {
  const db = client ?? pool
  const { rows } = await db.query<{
    qty: string
    qty_received: string
    qty_short_closed: string
  }>(
    `SELECT qty::numeric AS qty,
            qty_received::numeric AS qty_received,
            qty_short_closed::numeric AS qty_short_closed
     FROM purchase_order_lines
     WHERE po_id = $1`,
    [poId],
  )
  return resolvePoReceiptStatusFromLines(
    rows.map((r) => ({
      qty: Number(r.qty),
      qty_received: Number(r.qty_received),
      qty_short_closed: Number(r.qty_short_closed),
    })),
  )
}
