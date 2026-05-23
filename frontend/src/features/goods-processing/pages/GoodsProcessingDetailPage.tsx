import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';
import {
  ArrowLeft, CheckCircle2, XCircle, AlertTriangle,
  Plus, Trash2, Play, RotateCcw, Info,
   CheckCheck, Loader2,
} from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import { parseApiError } from "@/lib/errorParser";
import { normalizeUomName, uomNamesMatch } from "@/lib/uomNormalize";
import { usePermissionStore } from "@/features/branch_context/store/permission.store";
import { useProducts } from "@/features/products/api/products.api";
import {
  useGoodsProcessingDetail,
  useStartGoodsProcessing,
  useConfirmGoodsProcessing,
  useReopenGoodsProcessing,
  useUnconfirmGoodsProcessing,
  useResolveReturn,
  useConfirmGoodsProcessingInput,
} from "../api/goodsProcessing.api";
import type {
  GoodsProcessingDetail,
  ConditionStatus,
  OutputTemplateRow,
} from "../api/goods-processing.types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LocalOutput {
  id?: string;
  product_id: string;
  product_name: string;
  product_code: string;
  qty_output: number;
  uom: string;
  is_waste: boolean;
  waste_reason: string | null;
  condition_status: ConditionStatus | null;
  actual_qty: number | null;
  actual_uom: string | null;
  flagged_for_return: boolean;
  return_reason: string | null;
  return_resolved_at?: string | null;
  sort_order: number;
  stock_movement_id?: string | null;
  is_pass_through_output?: boolean;
}

interface LocalInput {
  id: string;
  gr_line_id: string;
  product_id: string;
  product_name: string;
  product_code: string;
  qty_input: number;
  uom: string;
  requires_processing: boolean;
  status: 'PENDING' | 'PROCESSING' | 'DONE';
  output_template: OutputTemplateRow[];
  outputs: LocalOutput[];
  expanded: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isValidUuid(value: string | undefined | null): value is string {
  return !!value && UUID_RE.test(value)
}

function findInvalidOutput(outputs: LocalOutput[]): LocalOutput | undefined {
  return outputs.find(o => !(o as LocalOutput & { _delete?: boolean })._delete && !isValidUuid(o.product_id))
}

function toApiOutput(o: LocalOutput, sortOrder: number) {
  return {
    ...(isValidUuid(o.id) ? { id: o.id } : {}),
    product_id: o.product_id,
    qty_output: o.qty_output,
    uom: o.uom,
    is_waste: o.is_waste,
    waste_reason: o.waste_reason,
    condition_status: o.condition_status,
    actual_qty: o.actual_qty,
    actual_uom: o.actual_uom,
    flagged_for_return: o.flagged_for_return,
    return_reason: o.return_reason,
    sort_order: sortOrder,
  }
}

/** GP lama menyimpan 1 output = produk input (pass-through placeholder) — abaikan untuk disassembly. */
function isDefaultPassThroughOutput(
  inp: { product_id: string; requires_processing: boolean },
  outputs: Array<{ product_id: string }>
): boolean {
  return inp.requires_processing && outputs.length === 1 && outputs[0].product_id === inp.product_id
}

function outputsFromTemplate(inp: {
  qty_input: number
  output_template: OutputTemplateRow[]
}): LocalOutput[] {
  return inp.output_template.map((t, i) => ({
    product_id: t.output_product_id,
    product_name: t.output_product_name,
    product_code: t.output_product_code,
    qty_output:
      t.suggested_pct != null
        ? Math.round(Number(inp.qty_input) * (t.suggested_pct / 100) * 100) / 100
        : 0,
    uom: t.output_uom,
    is_waste: false,
    waste_reason: null,
    condition_status: null,
    actual_qty: null,
    actual_uom: null,
    flagged_for_return: false,
    return_reason: null,
    sort_order: i,
  }))
}

function resolveInputOutputs(
  inp: GoodsProcessingDetail['inputs'][number]
): LocalOutput[] {
  const template = inp.output_template ?? []

  if (inp.requires_processing) {
    if (!isDefaultPassThroughOutput(inp, inp.outputs) && inp.outputs.length > 0) {
      return inp.outputs.map((o, i) => ({
        id: o.id,
        product_id: o.product_id,
        product_name: o.product_name,
        product_code: o.product_code,
        qty_output: Number(o.qty_output),
        uom: o.uom,
        is_waste: o.is_waste,
        waste_reason: o.waste_reason,
        condition_status: o.condition_status,
        actual_qty: o.actual_qty != null ? Number(o.actual_qty) : null,
        actual_uom: o.actual_uom ?? null,
        flagged_for_return: o.flagged_for_return ?? false,
        return_reason: o.return_reason,
        sort_order: i,
        is_pass_through_output: false,
      }))
    }
    return template.length > 0 ? outputsFromTemplate(inp) : []
  }

  if (inp.outputs.length === 0) {
    return [{
      id: undefined,
      product_id: inp.product_id,
      product_name: inp.product_name,
      product_code: inp.product_code,
      qty_output: Number(inp.qty_input),
      uom: inp.uom,
      is_waste: false,
      waste_reason: null,
      condition_status: 'OK' as ConditionStatus,
      actual_qty: null,
      actual_uom: null,
      flagged_for_return: false,
      return_reason: null,
      sort_order: 0,
      is_pass_through_output: true,
    }]
  }

  // Setelah confirm: backend menyimpan baris terpisah (bagus / rusak-retur). Jangan di-collapse.
  if (inp.status === 'DONE' || inp.status === 'CONFIRMED') {
    return inp.outputs.map((o, i) => ({
      id: o.id,
      product_id: o.product_id,
      product_name: o.product_name,
      product_code: o.product_code,
      qty_output: Number(o.qty_output),
      uom: o.uom,
      is_waste: o.is_waste,
      waste_reason: o.waste_reason,
      condition_status: o.condition_status,
      actual_qty: o.actual_qty != null ? Number(o.actual_qty) : null,
      actual_uom: o.actual_uom ?? null,
      flagged_for_return: o.flagged_for_return ?? false,
      return_reason: o.return_reason,
      return_resolved_at: o.return_resolved_at ?? null,
      sort_order: i,
      is_pass_through_output: true,
      stock_movement_id: o.stock_movement_id ?? null,
    }))
  }

  const goodPart = inp.outputs.find(
    (o) =>
      o.condition_status === 'OK' &&
      !o.flagged_for_return &&
      !o.is_waste,
  )
  const damagedPart = inp.outputs.find(
    (o) =>
      o.condition_status === 'DAMAGED' || o.is_waste || o.flagged_for_return,
  )

  if (damagedPart && goodPart && damagedPart.id !== goodPart.id) {
    return [{
      id: goodPart.id,
      product_id: inp.product_id,
      product_name: inp.product_name,
      product_code: inp.product_code,
      qty_output: Number(inp.qty_input),
      uom: inp.uom,
      is_waste: damagedPart.is_waste,
      waste_reason: damagedPart.waste_reason,
      condition_status: 'DAMAGED' as ConditionStatus,
      actual_qty: Number(goodPart.qty_output),
      actual_uom: goodPart.uom,
      flagged_for_return: damagedPart.flagged_for_return,
      return_reason: damagedPart.return_reason,
      sort_order: 0,
      is_pass_through_output: true,
    }]
  }

  const o = inp.outputs[0]
  return [{
    id: o.id,
    product_id: inp.product_id,
    product_name: inp.product_name,
    product_code: inp.product_code,
    qty_output: Number(inp.qty_input),
    uom: inp.uom,
    is_waste: o.is_waste,
    waste_reason: o.waste_reason,
    condition_status: o.condition_status ?? ('OK' as ConditionStatus),
    actual_qty: o.actual_qty != null ? Number(o.actual_qty) : null,
    actual_uom: o.actual_uom ?? null,
    flagged_for_return: o.flagged_for_return ?? false,
    return_reason: o.return_reason,
    sort_order: 0,
    is_pass_through_output: true,
  }]
}

function splitPassThroughOutputIfNecessary(
  o: LocalOutput,
  inp: LocalInput,
  productUoms: ProductUomRow[]
): any[] {
  if (!o.is_pass_through_output) {
    return [o]
  }

  const { totalBase, goodBase, damagedBase, baseUom } = derivePassThroughSplit(o, inp, productUoms)

  if (o.condition_status === 'DAMAGED' && o.actual_qty !== null) {
    const results = []

    if (goodBase > 0.0001) {
      results.push({
        id: o.id,
        product_id: o.product_id,
        product_name: o.product_name,
        product_code: o.product_code,
        qty_output: goodBase,
        uom: baseUom,
        is_waste: false,
        flagged_for_return: false,
        condition_status: 'OK',
        actual_qty: null,
        actual_uom: null,
        waste_reason: null,
        return_reason: null,
      })
    }

    if (damagedBase > 0.0001) {
      results.push({
        id: goodBase > 0.0001 ? undefined : o.id,
        product_id: o.product_id,
        product_name: o.product_name,
        product_code: o.product_code,
        qty_output: damagedBase,
        uom: baseUom,
        is_waste: o.is_waste,
        flagged_for_return: o.flagged_for_return,
        condition_status: 'DAMAGED',
        actual_qty: null,
        actual_uom: null,
        waste_reason: o.waste_reason,
        return_reason: o.return_reason,
      })
    }

    if (results.length === 0) {
      results.push({
        id: o.id,
        product_id: o.product_id,
        product_name: o.product_name,
        product_code: o.product_code,
        qty_output: totalBase,
        uom: baseUom,
        is_waste: false,
        flagged_for_return: false,
        condition_status: 'OK',
        actual_qty: null,
        actual_uom: null,
        waste_reason: null,
        return_reason: null,
      })
    }

    return results
  }

  return [{
    id: o.id,
    product_id: o.product_id,
    product_name: o.product_name,
    product_code: o.product_code,
    qty_output: o.qty_output,
    uom: o.uom,
    is_waste: o.is_waste,
    flagged_for_return: o.flagged_for_return,
    condition_status: o.condition_status ?? 'OK',
    actual_qty: o.actual_qty,
    actual_uom: o.actual_uom,
    waste_reason: o.waste_reason,
    return_reason: o.return_reason,
  }]
}


function initLocalInputs(detail: GoodsProcessingDetail): LocalInput[] {
  return detail.inputs.map((inp) => ({
    id: inp.id,
    gr_line_id: inp.gr_line_id,
    product_id: inp.product_id,
    product_name: inp.product_name,
    product_code: inp.product_code,
    qty_input: Number(inp.qty_input),
    uom: inp.uom,
    requires_processing: inp.requires_processing,
    output_template: inp.output_template ?? [],
    expanded: true,
    status: inp.status ?? 'PENDING',
    outputs: resolveInputOutputs(inp),
  }))
}

// ── UOM helpers (pass-through qty split) ──────────────────────────────────────

type ProductUomRow = { unit_name: string; conversion_factor: number; is_base_unit: boolean }

function findUomRow(uoms: ProductUomRow[], uomName: string): ProductUomRow | undefined {
  const key = normalizeUomName(uomName)
  return uoms.find((u) => normalizeUomName(u.unit_name) === key)
}

function toBaseQty(qty: number, uomName: string, uoms: ProductUomRow[]): number {
  if (!uoms.length) return qty
  const match = findUomRow(uoms, uomName)
  return qty * (match?.conversion_factor ?? 1)
}

function resolveBaseUom(uoms: ProductUomRow[], fallbackUom: string): string {
  return uoms.find((u) => u.is_base_unit)?.unit_name ?? fallbackUom
}

function fmtGpQty(n: number): string {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 4 }).format(n)
}

/** GR + GP header hints (PO reference, warehouse qty from GR). */
function GrLineHeaderHints({
  grLine,
  baseUom,
  totalBase,
  productUoms,
}: {
  grLine: { qty_received: number; uom_received: string; qty_po_uom?: number; uom_po?: string } | null
  baseUom: string
  totalBase: number
  productUoms: ProductUomRow[]
}) {
  if (!grLine) return null
  const showPo = shouldShowPoHint(grLine, baseUom, totalBase, productUoms)
  const sameUom = uomNamesMatch(grLine.uom_received, baseUom)
  const grAsBase = toBaseQty(grLine.qty_received, grLine.uom_received, productUoms)
  const qtyAligned = Math.abs(grAsBase - totalBase) < 0.0001

  return (
    <>
      {showPo && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
          PO: {fmtGpQty(Number(grLine.qty_po_uom ?? grLine.qty_received))} {grLine.uom_po}
        </p>
      )}
      {sameUom && qtyAligned ? (
        <p className="text-xs text-teal-600 dark:text-teal-400 font-medium mt-0.5">
          Sesuai GR: {fmtGpQty(grLine.qty_received)} {grLine.uom_received}
        </p>
      ) : !sameUom ? (
        <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-0.5" title="GP memakai satuan gudang (base)">
          GR: {fmtGpQty(grLine.qty_received)} {grLine.uom_received} → {fmtGpQty(totalBase)} {baseUom}
        </p>
      ) : (
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
          GR: {fmtGpQty(grLine.qty_received)} {grLine.uom_received} (qty GP berbeda)
        </p>
      )}
    </>
  )
}

/** PO hint: tampil jika satuan PO ≠ base, atau qty PO tidak match qty base (legacy). */
function shouldShowPoHint(
  grLine: { qty_po_uom?: number; uom_po?: string } | null | undefined,
  baseUom: string,
  totalBase: number,
  productUoms: ProductUomRow[],
): boolean {
  if (!grLine?.uom_po) return false
  if (!uomNamesMatch(grLine.uom_po, baseUom)) return true
  if (grLine.qty_po_uom == null || productUoms.length === 0) return false
  const poQtyAsBase = toBaseQty(Number(grLine.qty_po_uom), grLine.uom_po, productUoms)
  return Math.abs(poQtyAsBase - totalBase) > 0.0001
}

type UomMap = Record<string, ProductUomRow[]>

/** Konversi qty output ke base unit produk output — sama dengan strictToBaseQty di backend. */
function outputQtyInProductBase(output: LocalOutput, uomMap: UomMap): number {
  const uoms = uomMap[output.product_id] ?? []
  return toBaseQty(output.qty_output || 0, output.uom, uoms)
}

function sumDisassemblyOutputsBase(
  outputs: LocalOutput[],
  uomMap: UomMap,
  wasteOnly: boolean,
): number {
  return outputs
    .filter(o => !(o as LocalOutput & { _delete?: boolean })._delete)
    .filter(o => (wasteOnly ? o.is_waste : !o.is_waste))
    .reduce((s, o) => s + outputQtyInProductBase(o, uomMap), 0)
}

function derivePassThroughSplit(
  output: LocalOutput,
  input: { qty_input: number; uom: string },
  uoms: ProductUomRow[],
): { totalBase: number; goodBase: number; damagedBase: number; baseUom: string } {
  const baseUom = resolveBaseUom(uoms, input.uom)
  const totalBase = toBaseQty(input.qty_input, input.uom, uoms)

  let goodBase: number
  if (output.actual_qty != null && output.actual_uom) {
    // Ada actual measurement — pakai ini (berlaku untuk OK maupun DAMAGED)
    goodBase = toBaseQty(output.actual_qty, output.actual_uom, uoms)
  } else if (output.condition_status === 'DAMAGED') {
    // DAMAGED tanpa actual_qty = semua rusak
    goodBase = 0
  } else {
    // OK atau tidak ada info = semua bagus
    goodBase = totalBase
  }

  const damagedBase = Math.max(0, totalBase - goodBase)
  return { totalBase, goodBase, damagedBase, baseUom }
}

/** Qty bagus/rusak untuk tampilan — dari baris DB terpisah atau form tunggal. */
function summarizePassThroughOutputs(
  input: { qty_input: number; uom: string },
  outputs: Array<{
    condition_status?: ConditionStatus | null
    qty_output: number
    uom: string
    actual_qty?: number | null
    actual_uom?: string | null
    flagged_for_return?: boolean
    is_waste?: boolean
    stock_movement_id?: string | null
  }>,
  productUoms: ProductUomRow[],
): {
  totalBase: number
  goodBase: number
  damagedBase: number
  baseUom: string
  hasReturn: boolean
  hasWaste: boolean
} {
  const baseUom = resolveBaseUom(productUoms, input.uom)
  const totalBase = toBaseQty(input.qty_input, input.uom, productUoms)

  // Jangan pakai flagged_for_return/is_waste di sini — form edit masih 1 baris dengan
  // actual_qty = bagus; flag retur/waste hanya tindak lanjut rusak, bukan split tersimpan.
  const persistedSplit =
    outputs.length > 1 ||
    outputs.some((o) => o.stock_movement_id != null)

  if (persistedSplit) {
    const goodBase = outputs
      .filter((o) => !o.flagged_for_return && !o.is_waste)
      .reduce(
        (s, o) => s + toBaseQty(Number(o.qty_output), o.uom, productUoms),
        0,
      )
    const damagedBase = outputs
      .filter(
        (o) =>
          o.flagged_for_return ||
          o.is_waste ||
          o.condition_status === 'DAMAGED',
      )
      .reduce(
        (s, o) => s + toBaseQty(Number(o.qty_output), o.uom, productUoms),
        0,
      )
    return {
      totalBase,
      goodBase,
      damagedBase,
      baseUom,
      hasReturn: outputs.some((o) => o.flagged_for_return),
      hasWaste: outputs.some((o) => o.is_waste),
    }
  }

  const row = outputs[0]
  if (!row) {
    return {
      totalBase,
      goodBase: 0,
      damagedBase: 0,
      baseUom,
      hasReturn: false,
      hasWaste: false,
    }
  }

  const split = derivePassThroughSplit(row as LocalOutput, input, productUoms)
  return {
    ...split,
    hasReturn: !!row.flagged_for_return,
    hasWaste: !!row.is_waste,
  }
}

function buildPassThroughOutput(
  output: LocalOutput,
  goodBase: number,
  damagedBase: number,
  baseUom: string,
): LocalOutput {
  const hasDamage = damagedBase > 0.0001
  return {
    ...output,
    qty_output: goodBase + damagedBase,
    uom: baseUom,
    condition_status: hasDamage ? 'DAMAGED' : 'OK',
    actual_qty: goodBase,
    actual_uom: baseUom,
    ...(hasDamage
      ? {}
      : {
          is_waste: false,
          flagged_for_return: false,
          return_reason: null,
          waste_reason: null,
        }),
  }
}

type PassThroughTimelineEvent = {
  key: string
  tone: 'green' | 'orange' | 'red' | 'gray'
  title: string
  subtitle?: string
  qty: number
  uom: string
  badge?: string
}

/** Riwayat pass-through setelah item selesai — hindari ringkasan bagus+rusak yang menyesatkan. */
function buildPassThroughTimeline(
  input: { qty_input: number; uom: string },
  outputs: LocalOutput[],
  productUoms: ProductUomRow[],
): {
  events: PassThroughTimelineEvent[]
  totalInStock: number
  baseUom: string
  totalReceived: number
} {
  const baseUom = resolveBaseUom(productUoms, input.uom)
  const totalReceived = toBaseQty(input.qty_input, input.uom, productUoms)
  const events: PassThroughTimelineEvent[] = []
  let totalInStock = 0

  for (const o of outputs) {
    const qty = toBaseQty(Number(o.qty_output), o.uom, productUoms)
    const keyBase = o.id ?? `${o.condition_status}-${o.qty_output}`

    if (o.is_waste) {
      events.push({
        key: `waste-${keyBase}`,
        tone: 'red',
        title: 'Waste / tidak layak',
        subtitle: o.waste_reason ?? undefined,
        qty,
        uom: baseUom,
        badge: 'Tidak masuk gudang',
      })
      continue
    }

    const isReturnLine =
      o.condition_status === 'DAMAGED' &&
      (o.return_reason || o.flagged_for_return || o.return_resolved_at)

    if (isReturnLine) {
      const pending = o.flagged_for_return && !o.return_resolved_at
      events.push({
        key: `return-out-${keyBase}`,
        tone: 'orange',
        title: 'Dikirim retur ke supplier',
        subtitle: o.return_reason ?? undefined,
        qty,
        uom: baseUom,
        badge: pending ? 'Menunggu kembali' : undefined,
      })

      if (o.return_resolved_at) {
        if (o.stock_movement_id) {
          events.push({
            key: `return-in-${keyBase}`,
            tone: 'green',
            title: 'Retur kembali — masuk gudang',
            qty,
            uom: baseUom,
          })
          totalInStock += qty
        } else {
          events.push({
            key: `return-discard-${keyBase}`,
            tone: 'gray',
            title: 'Retur kembali — dibuang',
            qty,
            uom: baseUom,
            badge: 'Tidak masuk gudang',
          })
        }
      }
      continue
    }

    if (o.condition_status === 'OK' && o.stock_movement_id) {
      events.push({
        key: `stock-in-${keyBase}`,
        tone: 'green',
        title: 'Terima ke gudang',
        qty,
        uom: baseUom,
      })
      totalInStock += qty
    }
  }

  return { events, totalInStock, baseUom, totalReceived }
}

const TIMELINE_DOT: Record<PassThroughTimelineEvent['tone'], string> = {
  green: 'bg-green-500',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
  gray: 'bg-gray-400',
}

const TIMELINE_BADGE: Record<PassThroughTimelineEvent['tone'], string> = {
  green: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  red: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  gray: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
}

function PassThroughTimeline({
  events,
  totalInStock,
  totalReceived,
  baseUom,
}: {
  events: PassThroughTimelineEvent[]
  totalInStock: number
  totalReceived: number
  baseUom: string
}) {
  if (events.length === 0) return null

  return (
    <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-3">
      <div className="flex items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span className="font-semibold uppercase tracking-wide">Riwayat</span>
        <span>Diterima dari GR: {fmtGpQty(totalReceived)} {baseUom}</span>
      </div>
      <ol className="relative border-l-2 border-gray-200 dark:border-gray-600 ml-1.5 space-y-4 pl-5">
        {events.map((ev) => (
          <li key={ev.key} className="relative">
            <span
              className={`absolute -left-[1.4rem] top-1.5 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-gray-800 ${TIMELINE_DOT[ev.tone]}`}
            />
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{ev.title}</p>
                {ev.subtitle && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">&quot;{ev.subtitle}&quot;</p>
                )}
                {ev.badge && (
                  <span className={`inline-block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${TIMELINE_BADGE[ev.tone]}`}>
                    {ev.badge}
                  </span>
                )}
              </div>
              <p className="text-sm font-mono font-semibold text-gray-900 dark:text-gray-100 shrink-0">
                {fmtGpQty(ev.qty)} {ev.uom}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <div className="rounded-xl border-2 border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/25 px-3 py-2.5 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-green-800 dark:text-green-300">Total di gudang</span>
        <span className="text-base font-bold font-mono text-green-900 dark:text-green-200">
          {fmtGpQty(totalInStock)} {baseUom}
        </span>
      </div>
    </div>
  )
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  DRAFT:      { label: "Draft",     color: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",   dot: "bg-gray-400"  },
  PROCESSING: { label: "Diproses",  color: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",    dot: "bg-blue-500"  },
  PARTIAL:    { label: "Sebagian selesai", color: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300", dot: "bg-indigo-500" },
  CONFIRMED:  { label: "Selesai",   color: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300",  dot: "bg-green-500" },
  CORRECTING: { label: "Koreksi",   color: "bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200", dot: "bg-amber-500" },
  REJECTED:   { label: "Ditolak",   color: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",      dot: "bg-red-500"   },
} as const

/** Legacy DB value — displayed as PROCESSING */
function normalizeGpHeaderStatus(status: string): keyof typeof STATUS_CONFIG {
  return status === "QC_REVIEW" ? "PROCESSING" : status as keyof typeof STATUS_CONFIG
}

/** Baris selesai untuk progress UI — CONFIRMED mengunci hanya saat header GP final. */
function isGpInputLineComplete(lineStatus: string, gpHeaderStatus: string): boolean {
  if (gpHeaderStatus === 'CORRECTING') {
    return lineStatus === 'DONE'
  }
  return lineStatus === 'DONE' || lineStatus === 'CONFIRMED'
}

function resolveGpHeaderStatusConfig(
  status: string,
  doneCount: number,
  totalCount: number,
) {
  const key = normalizeGpHeaderStatus(status)
  const cfg = STATUS_CONFIG[key] ?? STATUS_CONFIG.PROCESSING
  if (status === "PARTIAL" && totalCount > 0 && doneCount === totalCount) {
    return { ...cfg, label: "Menunggu konfirmasi" }
  }
  return cfg
}

// ── PassThroughCard ───────────────────────────────────────────────────────────

function PassThroughCard({
  input, output, isEditable, gpHeaderStatus, onChange, productUoms, grLine, onConfirmItem, isConfirming,
}: {
  input: LocalInput
  output: LocalOutput
  isEditable: boolean
  gpHeaderStatus: string
  onChange: (updated: LocalOutput) => void
  productUoms: ProductUomRow[]
  grLine: { qty_received: number; uom_received: string; qty_po_uom?: number; uom_po?: string } | null
  onConfirmItem: () => void
  isConfirming: boolean
}) {
  const isDone = isGpInputLineComplete(input.status, gpHeaderStatus)
  const editOutput = input.outputs[0] ?? output
  const { totalBase, goodBase, damagedBase, baseUom, hasReturn, hasWaste } =
    summarizePassThroughOutputs(
      input,
      isDone ? input.outputs : [editOutput],
      productUoms,
    )
  const overTotal = goodBase + damagedBase > totalBase + 0.0001
  const hasDamage = damagedBase > 0.0001
  const missingDisposition = hasDamage && !editOutput.flagged_for_return && !editOutput.is_waste
  const missingReason =
    hasDamage &&
    ((editOutput.flagged_for_return && !(editOutput.return_reason?.trim())) ||
      (editOutput.is_waste && !(editOutput.waste_reason?.trim())))
  const canConfirm = !overTotal && !missingDisposition && !missingReason

  const applyGood = (raw: string) => {
    const parsed = raw === '' ? 0 : parseFloat(raw)
    const good = Math.min(Math.max(0, Number.isFinite(parsed) ? parsed : 0), totalBase)
    const damaged = Math.max(0, totalBase - good)
    onChange(buildPassThroughOutput(editOutput, good, damaged, baseUom))
  }

  const applyDamaged = (raw: string) => {
    const parsed = raw === '' ? 0 : parseFloat(raw)
    const damaged = Math.min(Math.max(0, Number.isFinite(parsed) ? parsed : 0), totalBase)
    const good = Math.max(0, totalBase - damaged)
    onChange(buildPassThroughOutput(editOutput, good, damaged, baseUom))
  }

  const doneTimeline = isDone
    ? buildPassThroughTimeline(input, input.outputs, productUoms)
    : null

  return (
    <div className={`rounded-xl border-2 transition-all p-4 space-y-3 ${
      isDone ? "border-green-300 dark:border-green-700 bg-green-50/40 dark:bg-green-900/20"
      : hasDamage ? "border-amber-200 dark:border-amber-800 bg-amber-50/10 dark:bg-amber-900/10"
      : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900 dark:text-white text-base truncate">{input.product_name}</p>
            {isDone && <CheckCircle2 size={16} className="text-green-600 shrink-0" />}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">{input.product_code}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{fmtGpQty(totalBase)}</p>
          <p className="text-xs font-medium text-gray-600 dark:text-gray-300">{baseUom}</p>
          <p className="text-[10px] text-gray-400 dark:text-gray-500">satuan gudang</p>
          <GrLineHeaderHints grLine={grLine} baseUom={baseUom} totalBase={totalBase} productUoms={productUoms} />
        </div>
      </div>

      {isDone && doneTimeline ? (
        <PassThroughTimeline
          events={doneTimeline.events}
          totalInStock={doneTimeline.totalInStock}
          totalReceived={doneTimeline.totalReceived}
          baseUom={doneTimeline.baseUom}
        />
      ) : (
        <div className="flex items-center gap-2 flex-wrap border-t border-gray-100 dark:border-gray-700 pt-3">
          <div className="flex items-center gap-1.5 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg px-2.5 py-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            <span className="text-xs text-green-700 dark:text-green-300 font-medium">
              Bagus: <span className="font-bold">{fmtGpQty(goodBase)} {baseUom}</span>
            </span>
          </div>
          {hasDamage ? (
            <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-2.5 py-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
              <span className="text-xs text-red-700 dark:text-red-300 font-medium">
                Rusak: <span className="font-bold">{fmtGpQty(damagedBase)} {baseUom}</span>
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg px-2.5 py-1.5">
              <span className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Tidak ada rusak</span>
            </div>
          )}
          {hasReturn && (
            <div className="flex items-center gap-1.5 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg px-2.5 py-1.5">
              <span className="text-xs text-orange-700 dark:text-orange-300 font-medium">🔄 Retur</span>
            </div>
          )}
          {hasWaste && (
            <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-2.5 py-1.5">
              <span className="text-xs text-red-700 dark:text-red-300 font-medium">🗑 Waste</span>
            </div>
          )}
        </div>
      )}

      {isEditable && !isDone && (
        <div className="space-y-3 border-t border-gray-100 dark:border-gray-700 pt-3">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Pembagian qty</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-green-50/80 dark:bg-green-900/20 rounded-xl p-3 border border-green-200 dark:border-green-800">
              <label className="text-xs font-medium text-green-800 dark:text-green-300 mb-1.5 block">Bagus (masuk gudang)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={goodBase > 0 ? goodBase : ''}
                  onChange={(e) => applyGood(e.target.value)}
                  className="flex-1 border border-green-300 dark:border-green-700 rounded-lg px-3 py-2.5 text-base font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-green-400 bg-white dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
                />
                <span className="text-sm font-bold text-green-800 dark:text-green-300 shrink-0">{baseUom}</span>
              </div>
            </div>

            <div className="bg-red-50/80 dark:bg-red-900/20 rounded-xl p-3 border border-red-200 dark:border-red-800">
              <label className="text-xs font-medium text-red-800 dark:text-red-300 mb-1.5 block">Rusak / tidak layak</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={damagedBase > 0 ? damagedBase : ''}
                  onChange={(e) => applyDamaged(e.target.value)}
                  className="flex-1 border border-red-300 dark:border-red-700 rounded-lg px-3 py-2.5 text-base font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-red-400 bg-white dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
                />
                <span className="text-sm font-bold text-red-800 dark:text-red-300 shrink-0">{baseUom}</span>
              </div>
            </div>
          </div>

          {overTotal && (
            <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
              <AlertTriangle size={14} />
              Bagus + rusak melebihi total ({fmtGpQty(totalBase)} {baseUom})
            </p>
          )}

          {hasDamage && (
            <div className="bg-red-50/60 dark:bg-red-900/20 rounded-xl p-3 space-y-3 border border-red-100 dark:border-red-900">
              <p className="text-xs font-medium text-red-800 dark:text-red-300">
                Tindak lanjut barang rusak <span className="text-red-500">*</span>
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onChange({
                    ...buildPassThroughOutput(editOutput, goodBase, damagedBase, baseUom),
                    flagged_for_return: true,
                    is_waste: false,
                    waste_reason: null,
                  })}
                  className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                    editOutput.flagged_for_return
                      ? 'bg-orange-500 border-orange-500 text-white'
                      : 'bg-white dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600 dark:placeholder:text-gray-500 border-gray-200 text-gray-600 hover:border-orange-300 dark:hover:border-orange-600'
                  }`}
                >
                  Retur supplier
                </button>
                <button
                  type="button"
                  onClick={() => onChange({
                    ...buildPassThroughOutput(editOutput, goodBase, damagedBase, baseUom),
                    is_waste: true,
                    flagged_for_return: false,
                    return_reason: null,
                  })}
                  className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                    editOutput.is_waste
                      ? 'bg-red-500 border-red-500 text-white'
                      : 'bg-white dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 border-gray-200 dark:border-gray-600 text-gray-600 hover:border-red-300 dark:hover:border-red-600'
                  }`}
                >
                  Waste
                </button>
              </div>
              {(editOutput.flagged_for_return || editOutput.is_waste) && (
                <input
                  type="text"
                  value={editOutput.flagged_for_return ? (editOutput.return_reason ?? '') : (editOutput.waste_reason ?? '')}
                  onChange={(e) => onChange({
                    ...buildPassThroughOutput(editOutput, goodBase, damagedBase, baseUom),
                    return_reason: editOutput.flagged_for_return ? e.target.value || null : null,
                    waste_reason: editOutput.is_waste ? e.target.value || null : null,
                  })}
                  placeholder={editOutput.flagged_for_return ? 'Alasan retur (wajib)...' : 'Alasan waste (wajib)...'}
                  className="w-full border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 bg-white dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
                />
              )}
              {missingDisposition && (
                <p className="text-xs text-red-600 dark:text-red-400">Pilih Retur atau Waste untuk qty rusak.</p>
              )}
              {missingReason && !missingDisposition && (
                <p className="text-xs text-red-600 dark:text-red-400">Isi alasan retur / waste.</p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={onConfirmItem}
            disabled={isConfirming || !canConfirm}
            className="w-full py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-green-700 transition-all"
          >
            <CheckCheck size={15} />
            {isConfirming ? 'Menyimpan...' : 'Selesaikan item ini'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── DisassemblyOutputRow ──────────────────────────────────────────────────────

function DisassemblyOutputRow({
  output, isEditable, onChange, onRemove,
}: {
  output: LocalOutput
  index: number
  isEditable: boolean
  onChange: (updated: LocalOutput) => void
  onRemove: () => void
}) {
  const invalidProduct = !isValidUuid(output.product_id)
  return (
    <div className={`rounded-lg border p-3 space-y-2 ${
      invalidProduct ? "border-amber-300 dark:border-amber-700 bg-amber-50/40 dark:bg-amber-900/20"
      : output.is_waste ? "border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-900/20"
      : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
    }`}>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{output.product_name}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">{output.product_code}</p>
          {invalidProduct && (
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
              Produk tidak valid — hapus baris ini dan tambah ulang via pencarian
            </p>
          )}
        </div>
        {isEditable && (
          <button type="button" onClick={onRemove} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors shrink-0">
            <Trash2 size={14} />
          </button>
        )}
      </div>
      {isEditable ? (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 focus-within:ring-2 focus-within:ring-blue-300 transition-all">
            <input type="number" min={0} step="0.01"
              value={output.qty_output || ""}
              onChange={(e) => onChange({ ...output, qty_output: parseFloat(e.target.value) || 0 })}
              placeholder="0"
              className="w-20 text-sm outline-none text-right font-mono"
            />
            <span className="text-xs text-gray-500 dark:text-gray-400">{output.uom}</span>
          </div>
          {output.is_waste && (
            <span className="text-xs font-semibold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-2.5 py-1 rounded-lg animate-pulse">
              ⚠️ Waste {output.waste_reason ? `: ${output.waste_reason}` : ''}
            </span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold text-gray-800 dark:text-gray-200">{output.qty_output}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{output.uom}</span>
          {output.is_waste && <span className="text-xs bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full">waste</span>}
          {output.stock_movement_id && <span className="text-xs bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded-full">✓ gudang</span>}
        </div>
      )}
    </div>
  )
}

// ── DisassemblyCard ───────────────────────────────────────────────────────────

function DisassemblyCard({
  input, grLine, productUoms, uomMap, isEditable, gpHeaderStatus, onChange, onAddOutput, onConfirmItem, isConfirming,
}: {
  input: LocalInput
  grLine: { qty_received: number; uom_received: string; qty_po_uom?: number; uom_po?: string } | null
  productUoms: ProductUomRow[]
  uomMap: UomMap
  isEditable: boolean
  gpHeaderStatus: string
  onChange: (outputIndex: number, updated: LocalOutput) => void
  onAddOutput: () => void
  onConfirmItem: () => void
  isConfirming: boolean
}) {
  const isDone = isGpInputLineComplete(input.status, gpHeaderStatus)
  const baseUom = resolveBaseUom(productUoms, input.uom)
  const totalBase = toBaseQty(input.qty_input, input.uom, productUoms)
  // Yield vs input: jumlahkan base unit tiap produk output (sama seperti validasi backend confirm).
  const totalNonWasteBase = sumDisassemblyOutputsBase(input.outputs, uomMap, false)
  const totalWasteBase = sumDisassemblyOutputsBase(input.outputs, uomMap, true)
  const pct = totalBase > 0 ? Math.round((totalNonWasteBase / totalBase) * 100) : 0
  const overLimit = totalNonWasteBase > totalBase + 0.0001
  const canConfirm = input.outputs.length > 0 && !overLimit

  return (
    <div className={`rounded-xl border-2 p-4 space-y-3 transition-all ${isDone ? "border-green-300 dark:border-green-700 bg-green-50/30 dark:bg-green-900/20" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900 dark:text-white text-base truncate">{input.product_name}</p>
            {isDone && <CheckCircle2 size={16} className="text-green-600 shrink-0" />}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">{input.product_code}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{fmtGpQty(totalBase)}</p>
          <p className="text-xs font-medium text-gray-600 dark:text-gray-300">{baseUom}</p>
          <p className="text-[10px] text-gray-400 dark:text-gray-500">satuan gudang</p>
          <GrLineHeaderHints grLine={grLine} baseUom={baseUom} totalBase={totalBase} productUoms={productUoms} />
        </div>
      </div>

      {/* Summary strip */}
      {(() => {
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg px-2.5 py-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                  Input: <span className="font-bold">{fmtGpQty(totalBase)} {baseUom}</span>
                </span>
              </div>
              <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 border ${
                overLimit ? "bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-800" : pct >= 90 ? "bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800" : "bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600"
              }`}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${overLimit ? "bg-red-500" : pct >= 90 ? "bg-green-500" : "bg-gray-400"}`} />
                <span className={`text-xs font-medium ${overLimit ? "text-red-700 dark:text-red-300" : pct >= 90 ? "text-green-700 dark:text-green-300" : "text-gray-600 dark:text-gray-300"}`}>
                  Output: <span className="font-bold">{fmtGpQty(totalNonWasteBase)} {baseUom}</span>
                  {overLimit && <span className="ml-1">⚠</span>}
                </span>
              </div>
              {totalWasteBase > 0.0001 && (
                <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-2.5 py-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                  <span className="text-xs text-red-700 dark:text-red-300 font-medium">
                    Waste: <span className="font-bold">{fmtGpQty(totalWasteBase)} {baseUom}</span>
                  </span>
                </div>
              )}
              <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 border ${
                isDone ? "bg-green-100 border-green-300"
                : overLimit ? "bg-red-50 border-red-200"
                : pct >= 90 ? "bg-green-50 border-green-200"
                : "bg-yellow-50 border-yellow-200"
              }`}>
                <span className={`text-xs font-bold ${
                  isDone ? "text-green-700"
                  : overLimit ? "text-red-700"
                  : pct >= 90 ? "text-green-700"
                  : "text-yellow-700"
                }`}>
                  {isDone ? "✓ Masuk gudang" : `Yield ${pct}%`}
                </span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${overLimit ? "bg-red-400" : pct >= 90 ? "bg-green-400" : "bg-blue-400"}`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
          </div>
        )
      })()}

      {/* Output list */}
      {!isDone && (
        <div className="space-y-2">
          {input.outputs.map((o, i) => (
            <DisassemblyOutputRow
              key={i} output={o} index={i} isEditable={isEditable}
              onChange={(updated) => onChange(i, updated)}
              onRemove={() => onChange(i, { ...o, _delete: true } as LocalOutput & { _delete?: boolean })}
            />
          ))}
        </div>
      )}

      {isEditable && !isDone && (
        <>
          <button type="button" onClick={onAddOutput}
            className="w-full py-2 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 transition-all flex items-center justify-center gap-1.5"
          >
            <Plus size={14} />
            Tambah output
          </button>

          {canConfirm && (
            <button type="button" onClick={onConfirmItem} disabled={isConfirming}
              className="w-full py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-green-700 transition-all"
            >
              <CheckCheck size={15} />
              {isConfirming ? "Menyimpan..." : "✓ Selesaikan item ini → masuk gudang"}
            </button>
          )}
        </>
      )}

      {/* Read-only outputs kalau DONE */}
      {isDone && (
        <div className="space-y-2">
          {input.outputs.map((o, i) => (
            <DisassemblyOutputRow
              key={i} output={o} index={i} isEditable={false}
              onChange={() => {}} onRemove={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── ReturnItemsSection ────────────────────────────────────────────────────────

function ReturnItemsSection({ gp, onResolve, canApprove, canRelease, resolvingOutputId, resolvingResolution }: {
  gp: GoodsProcessingDetail
  onResolve: (outputId: string, resolution: "STOCK" | "DISCARD") => void
  canApprove: boolean
  canRelease: boolean
  resolvingOutputId: string | null
  resolvingResolution: "STOCK" | "DISCARD" | null
}) {
  const returnItems = gp.inputs.flatMap(inp =>
    inp.outputs.filter(o => o.flagged_for_return && !o.return_resolved_at)
      .map(o => ({ ...o, input_product_name: inp.product_name }))
  )
  if (returnItems.length === 0) return null
  const isResolving = resolvingOutputId != null
  return (
    <div className="rounded-xl border-2 border-orange-200 dark:border-orange-800 bg-orange-50/30 dark:bg-orange-900/20 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <RotateCcw size={16} className="text-orange-600 dark:text-orange-400" />
        <h3 className="font-semibold text-orange-800 dark:text-orange-300 text-sm">Barang Retur Tiba ({returnItems.length})</h3>
      </div>
      <p className="text-xs text-orange-700/90 dark:text-orange-300/90 -mt-1">
        Pilih satu tindakan per barang. Proses membutuhkan beberapa detik — tunggu hingga selesai.
      </p>
      {returnItems.map(item => {
        const itemBusy = resolvingOutputId === item.id
        return (
        <div key={item.id} className={`bg-white dark:bg-gray-800 rounded-lg border border-orange-200 dark:border-orange-800 p-3 space-y-2 ${itemBusy ? "opacity-90" : ""}`}>
          <div className="flex justify-between items-start gap-2">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{item.product_name}</p>
              {item.return_reason && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">"{item.return_reason}"</p>}
            </div>
            <div className="text-right text-sm shrink-0">
              <span className="font-mono font-semibold">{item.actual_qty ?? item.qty_output}</span>
              <span className="text-gray-500 dark:text-gray-400 ml-1">{item.uom}</span>
            </div>
          </div>
          {(canApprove || canRelease) && (
            <div className="flex gap-2">
              {canApprove && (
                <button
                  type="button"
                  disabled={isResolving}
                  onClick={() => onResolve(item.id, "STOCK")}
                  className="flex-1 py-2 bg-green-50 dark:bg-green-900/30 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 rounded-lg text-xs font-medium hover:bg-green-100 transition-colors disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-1.5 min-h-9"
                >
                  {itemBusy && resolvingResolution === "STOCK" ? (
                    <>
                      <Loader2 size={14} className="animate-spin shrink-0" />
                      Memproses...
                    </>
                  ) : (
                    "✓ Masukkan Gudang"
                  )}
                </button>
              )}
              {canRelease && (
                <button
                  type="button"
                  disabled={isResolving}
                  onClick={() => onResolve(item.id, "DISCARD")}
                  className="flex-1 py-2 bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-1.5 min-h-9"
                >
                  {itemBusy && resolvingResolution === "DISCARD" ? (
                    <>
                      <Loader2 size={14} className="animate-spin shrink-0" />
                      Memproses...
                    </>
                  ) : (
                    "🗑 Buang"
                  )}
                </button>
              )}
            </div>
          )}
        </div>
        )
      })}
    </div>
  )
}

// ── AddOutputModal ────────────────────────────────────────────────────────────

function AddOutputModal({ template, onAdd, onCancel }: {
  template: OutputTemplateRow[]
  onAdd: (output: Omit<LocalOutput, "sort_order">) => void
  onCancel: () => void
}) {
  const [productName, setProductName] = useState("")
  const [productId, setProductId] = useState("")
  const [productCode, setProductCode] = useState("")
  const [qty, setQty] = useState("")
  const [uom, setUom] = useState("")
  const [isWaste, setIsWaste] = useState(false)
  const [wasteReason, setWasteReason] = useState("")
  const [showDropdown, setShowDropdown] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const [debouncedSearch, setDebouncedSearch] = useState("")

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(productName)
    }, 300) // 300ms debounce
    return () => clearTimeout(handler)
  }, [productName])

  useEffect(() => {
    if (!showDropdown) return
    const onOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", onOutside)
    return () => document.removeEventListener("mousedown", onOutside)
  }, [showDropdown])

  // Server-side product search
  const { data: searchData, isLoading: isSearchLoading } = useProducts({
    search: debouncedSearch && debouncedSearch.trim().length >= 2 && !productId ? debouncedSearch : undefined,
    limit: 8,
  })

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold text-gray-900 dark:text-white">Tambah Output</h3>
        {template.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Dari template:</p>
            <div className="space-y-1.5">
              {template.map(t => (
                <button key={t.id} type="button"
                  onClick={() => {
                    setProductId(t.output_product_id)
                    setProductName(t.output_product_name)
                    setProductCode(t.output_product_code)
                    setUom(t.output_uom)
                    setShowDropdown(false)
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-all ${
                    productId === t.output_product_id ? "border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200" : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                  }`}
                >
                  <span className="font-medium">{t.output_product_name}</span>
                  <span className="text-gray-400 dark:text-gray-500 ml-2 text-xs">{t.output_uom}</span>
                  {t.suggested_pct && <span className="text-xs text-gray-400 ml-1">({t.suggested_pct}%)</span>}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 mb-1">atau cari manual:</p>
          </div>
        )}
        <div className="space-y-3 relative">
          <div className="relative" ref={searchRef}>
            <input type="text" value={productName} onChange={(e) => {
              setProductName(e.target.value)
              if (productId) {
                setProductId("")
                setProductCode("")
                setUom("")
              }
              setShowDropdown(e.target.value.trim().length >= 2)
            }}
              onFocus={() => { if (productName.trim().length >= 2 && !productId) setShowDropdown(true) }}
              placeholder="Cari nama produk output..."
              className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
            {productId && (
              <span className="absolute right-3 top-2.5 bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 text-[10px] px-1.5 py-0.5 rounded-md border border-green-200 dark:border-green-800 font-medium">
                Terpilih
              </span>
            )}
            
            {showDropdown && productName.trim().length >= 2 && !productId && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-700">
                {isSearchLoading ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400 p-3 text-center">Mencari...</p>
                ) : searchData?.data && searchData.data.length > 0 ? (
                  searchData.data.map(p => (
                    <button key={p.id} type="button"
                      onClick={() => {
                        setProductId(p.id)
                        setProductName(p.product_name)
                        setProductCode(p.product_code)
                        setUom(p.base_unit_name || "")
                        setShowDropdown(false)
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm flex flex-col transition-colors"
                    >
                      <span className="font-medium text-gray-800 dark:text-gray-200">{p.product_name}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">{p.product_code} · UOM: {p.base_unit_name || ""}</span>
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-gray-500 dark:text-gray-400 p-3 text-center">Produk tidak ditemukan</p>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <input type="number" value={qty} onChange={(e) => setQty(e.target.value)}
              placeholder="Qty"
              className="flex-1 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 font-mono text-right"
            />
            <input type="text" value={uom} readOnly
              placeholder="UOM"
              className="w-24 border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-xl px-3 py-2.5 text-sm text-gray-500 dark:text-gray-400 focus:outline-none font-medium text-center cursor-not-allowed"
            />
          </div>

          <div className="border-t pt-3 space-y-2">
            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300 select-none cursor-pointer">
              <input type="checkbox" checked={isWaste} onChange={(e) => setIsWaste(e.target.checked)}
                className="rounded text-red-600 accent-red-500"
              />
              Tandai sebagai Waste (Susut/Pembuangan)
            </label>
            {isWaste && (
              <input type="text" value={wasteReason} onChange={(e) => setWasteReason(e.target.value)}
                placeholder="Alasan waste (contoh: Susut Thawing / Kotoran)..."
                className="w-full border border-red-200 dark:border-red-800 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-red-200 bg-white dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
              />
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Batal</button>
          <button
            onClick={() => {
              if (!isValidUuid(productId)) return
              onAdd({
                id: undefined,
                product_id: productId,
                product_name: productName,
                product_code: productCode,
                qty_output: parseFloat(qty) || 0,
                uom,
                is_waste: isWaste,
                waste_reason: isWaste ? wasteReason : null,
                condition_status: null,
                actual_qty: null,
                actual_uom: null,
                flagged_for_return: false,
                return_reason: null
              })
            }}
            disabled={!productId || !qty || parseFloat(qty) <= 0 || !uom}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors"
          >Tambah</button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function GoodsProcessingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const hasPermission = usePermissionStore(s => s.hasPermission)
  const canUpdate = hasPermission("goods_processing", "update")
  const canApprove = hasPermission("goods_processing", "approve")
  const canRelease = hasPermission("goods_processing", "release")

  const { data: gp, isLoading, error } = useGoodsProcessingDetail(id!)
  const startMut = useStartGoodsProcessing(id!)
  const confirmMut = useConfirmGoodsProcessing(id!)
  const reopenMut = useReopenGoodsProcessing(id!)
  const unconfirmMut = useUnconfirmGoodsProcessing(id!)
  const resolveMut = useResolveReturn(id!)
  const resolveInFlightRef = useRef(false)
  const confirmInputMut = useConfirmGoodsProcessingInput(id!)

  const [confirmingInputId, setConfirmingInputId] = useState<string | null>(null)
  const [localInputs, setLocalInputs] = useState<LocalInput[]>([])

  const uomProductIds = useMemo(() => {
    if (!gp) return [] as string[]
    return [
      ...new Set([
        ...gp.inputs.map(inp => inp.product_id),
        ...gp.inputs.flatMap(inp => inp.outputs.map(o => o.product_id)),
        ...localInputs.flatMap(inp => inp.outputs.map(o => o.product_id).filter(Boolean)),
      ]),
    ]
  }, [gp, localInputs])

  const { data: uomConversions } = useQuery({
    queryKey: ['product-uoms', 'conversions-gp', gp?.id, uomProductIds],
    queryFn: async () => {
      const { data } = await api.post('/product-uoms/conversions-batch', { product_ids: uomProductIds })
      return data.data as Record<string, Array<{ unit_name: string; conversion_factor: number; is_base_unit: boolean }>>
    },
    enabled: !!gp && uomProductIds.length > 0,
    staleTime: 60_000,
  })

  const { data: grDetail } = useQuery({
    queryKey: ['gr-detail-for-gp', gp?.goods_receipt_id],
    queryFn: async () => {
      const { data } = await api.get(`/goods-receipts/${gp!.goods_receipt_id}`)
      return data.data as {
        lines: Array<{
          id: string
          qty_received: number
          uom_received: string
          qty_po_uom?: number
          uom_po?: string
        }>
      }
    },
    enabled: !!gp?.goods_receipt_id,
    staleTime: 60_000,
  })

  const getGrLine = (grLineId: string) =>
    grDetail?.lines.find(l => l.id === grLineId) ?? null

  const [addOutputFor, setAddOutputFor] = useState<string | null>(null)

  useEffect(() => {
    if (gp) setLocalInputs(initLocalInputs(gp))
  }, [gp])

  const isEditable = useMemo(
    () => canUpdate && (gp?.status === "PROCESSING" || gp?.status === "PARTIAL" || gp?.status === "CORRECTING"),
    [canUpdate, gp?.status]
  )

  // Progress counts
  const doneCount = localInputs.filter(inp => isGpInputLineComplete(inp.status, status)).length
  const totalCount = localInputs.length
  const allDone = doneCount === totalCount && totalCount > 0

  const pendingReturnCount = useMemo(() => {
    if (!gp) return 0
    return gp.inputs
      .flatMap((inp) => inp.outputs)
      .filter((o) => o.flagged_for_return && !o.return_resolved_at).length
  }, [gp])

  const hasPendingReturns = pendingReturnCount > 0
  /** Semua baris input DONE + tidak ada retur yang belum masuk gudang/dibuang */
  const canFinalizeGp = allDone && !hasPendingReturns

  const needsReopen = gp?.status === "CONFIRMED" && !allDone

  const showMobileActionBar = useMemo(() => {
    if (!gp) return false
    const s = gp.status
    if (s === "DRAFT" && canUpdate) return true
    if (s === "CONFIRMED" && (allDone || (needsReopen && canApprove))) return true
    if ((s === "PROCESSING" || s === "PARTIAL" || s === "CORRECTING") && canFinalizeGp && canApprove) return true
    return false
  }, [gp, canUpdate, canApprove, allDone, canFinalizeGp, needsReopen])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleConfirmItem = useCallback(async (inp: LocalInput) => {
    setConfirmingInputId(inp.id)
    try {
      const activeOutputs = inp.outputs.filter(o => !(o as LocalOutput & { _delete?: boolean })._delete)
      const invalid = findInvalidOutput(activeOutputs)
      if (invalid) {
        addToast("error", `Output "${invalid.product_name}" belum terhubung ke produk valid. Hapus baris ini dan tambah ulang via pencarian produk.`)
        return
      }

      const uoms = uomConversions?.[inp.product_id] ?? []
      const preparedOutputs = activeOutputs
        .flatMap(o => splitPassThroughOutputIfNecessary(o, inp, uoms))
        .map((o, i) => toApiOutput(o as LocalOutput, i))

      await confirmInputMut.mutateAsync({
        inputId: inp.id,
        outputs: preparedOutputs,
      })
      addToast("success", `${inp.product_name} selesai ✓`)
    } catch (e) {
      addToast("error", parseApiError(e, "Terjadi kesalahan"))
    } finally {
      setConfirmingInputId(null)
    }
  }, [confirmInputMut, addToast, uomConversions])

  const handleConfirmGp = useCallback(async () => {
    if (!gp) return
    if (!allDone) {
      addToast(
        "error",
        `Belum semua item selesai (${doneCount}/${totalCount}). Gunakan "Selesaikan item ini" per produk dulu.`,
      )
      return
    }
    if (hasPendingReturns) {
      addToast(
        "error",
        `Masih ada ${pendingReturnCount} barang retur belum diproses. Selesaikan di bagian Barang Retur Tiba dulu.`,
      )
      return
    }
    if (
      !window.confirm(
        "Finalisasi GP ini? Semua item sudah selesai. Setelah dikonfirmasi, GP tidak bisa diedit lagi.",
      )
    ) {
      return
    }
    try {
      await confirmMut.mutateAsync()
      addToast("success", "GP difinalisasi ✓")
    } catch (e) {
      addToast("error", parseApiError(e, "Gagal konfirmasi"))
    }
  }, [gp, confirmMut, addToast, allDone, hasPendingReturns, pendingReturnCount, doneCount, totalCount])

  const handleReopen = useCallback(async () => {
    if (!gp || !needsReopen) return
    if (
      !window.confirm(
        `GP ini terlanjur difinalisasi padahal baru ${doneCount}/${totalCount} item selesai. Buka kembali agar item sisanya bisa diproses?`,
      )
    ) {
      return
    }
    try {
      await reopenMut.mutateAsync()
      addToast("success", "GP dibuka kembali — lanjutkan item yang belum selesai")
    } catch (e) {
      addToast("error", parseApiError(e, "Gagal membuka kembali GP"))
    }
  }, [gp, needsReopen, doneCount, totalCount, reopenMut, addToast])

  const handleUnconfirm = useCallback(async () => {
    if (!gp || gp.status !== "CONFIRMED" || !allDone) return
    if (
      !window.confirm(
        "Buka GP untuk koreksi? Stok output akan dibalik (keluar gudang). Setelah diedit, finalisasi ulang seperti biasa.",
      )
    ) {
      return
    }
    try {
      await unconfirmMut.mutateAsync()
      addToast("success", "GP dibuka untuk koreksi — stok output sudah dibalik")
    } catch (e) {
      addToast("error", parseApiError(e, "Gagal membuka koreksi"))
    }
  }, [gp, allDone, unconfirmMut, addToast])

  const handleStart = useCallback(async () => {
    try {
      await startMut.mutateAsync()
      addToast("success", "Proses dimulai")
    } catch (e) {
      addToast("error", parseApiError(e, "Terjadi kesalahan"))
    }
  }, [startMut, addToast])


  const handleResolveReturn = useCallback(async (outputId: string, resolution: "STOCK" | "DISCARD") => {
    if (resolveInFlightRef.current || resolveMut.isPending) return
    resolveInFlightRef.current = true
    try {
      await resolveMut.mutateAsync({ outputId, resolution })
      addToast("success", resolution === "STOCK" ? "Barang masuk gudang" : "Barang dibuang")
    } catch (e) {
      addToast("error", parseApiError(e, "Terjadi kesalahan"))
    } finally {
      resolveInFlightRef.current = false
    }
  }, [resolveMut, addToast])

  const updatePassThroughOutput = useCallback((inputIndex: number, updated: LocalOutput) => {
    setLocalInputs(prev => prev.map((inp, i) => i !== inputIndex ? inp : { ...inp, outputs: [updated] }))
  }, [])

  const updateDisassemblyOutput = useCallback((inputIndex: number, outputIndex: number, updated: LocalOutput & { _delete?: boolean }) => {
    setLocalInputs(prev => prev.map((inp, i) => {
      if (i !== inputIndex) return inp
      if (updated._delete) return { ...inp, outputs: inp.outputs.filter((_, oi) => oi !== outputIndex) }
      return { ...inp, outputs: inp.outputs.map((o, oi) => oi === outputIndex ? updated : o) }
    }))
  }, [])

  const addDisassemblyOutput = useCallback((inputIndex: number, output: Omit<LocalOutput, "sort_order">) => {
    setLocalInputs(prev => prev.map((inp, i) => {
      if (i !== inputIndex) return inp
      return { ...inp, outputs: [...inp.outputs, { ...output, sort_order: inp.outputs.length }] }
    }))
    setAddOutputFor(null)
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center space-y-2">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Memuat data...</p>
      </div>
    </div>
  )

  if (error || !gp) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center space-y-3">
        <AlertTriangle size={40} className="mx-auto text-red-400" />
        <p className="text-gray-600 dark:text-gray-300">Gagal memuat data</p>
        <button onClick={() => navigate(-1)} className="text-blue-600 text-sm">← Kembali</button>
      </div>
    </div>
  )

  const status = gp.status
  const isInProgress = status === "PROCESSING" || status === "PARTIAL" || status === "CORRECTING"
  const canUnconfirmForCorrection = status === "CONFIRMED" && allDone && canApprove
  const cfg = resolveGpHeaderStatusConfig(status, doneCount, totalCount)
  const isBusy = startMut.isPending || confirmMut.isPending || reopenMut.isPending || unconfirmMut.isPending || resolveMut.isPending
  const resolvingOutputId = resolveMut.isPending ? (resolveMut.variables?.outputId ?? null) : null
  const resolvingResolution = resolveMut.isPending ? (resolveMut.variables?.resolution ?? null) : null
  const addOutputInput = addOutputFor != null ? localInputs.find(inp => inp.id === addOutputFor) : null

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">

      {/* ── Header ── */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 sticky top-0 z-20">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-1.5 -ml-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{gp.processing_number}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{gp.supplier_name} · {gp.gr_number}</p>
          </div>
          <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${cfg.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        </div>

        {/* Progress bar partial */}
        {isInProgress && totalCount > 0 && (
          <div className="px-4 pb-3">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-gray-500 dark:text-gray-400">Progress item</span>
              <span className={`font-semibold ${doneCount > 0 ? "text-green-600" : "text-blue-600"}`}>
                {doneCount} / {totalCount} item selesai
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${allDone ? "bg-green-500" : "bg-blue-500"}`}
                style={{ width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Desktop: 2-column layout / Mobile: single column ── */}
      <div className="lg:flex lg:gap-0 lg:min-h-[calc(100vh-64px)]">

        {/* ── LEFT PANEL (desktop sidebar / mobile top) ── */}
        <div className="lg:w-80 lg:shrink-0 lg:border-r lg:border-gray-200 dark:lg:border-gray-700 lg:bg-white dark:lg:bg-gray-800 lg:sticky lg:top-16 lg:h-[calc(100vh-64px)] lg:overflow-y-auto">
          <div className="p-4 space-y-4">

            {/* Info card */}
            <div className="bg-white dark:bg-gray-800 lg:bg-gray-50 dark:lg:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700 lg:border-gray-200 dark:lg:border-gray-700 p-3.5 grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Gudang</p>
                <p className="font-medium text-gray-800 dark:text-gray-200 text-xs mt-0.5">{gp.warehouse_name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Tanggal</p>
                <p className="font-medium text-gray-800 dark:text-gray-200 text-xs mt-0.5">
                  {new Date(gp.processing_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Tipe</p>
                <p className="font-medium text-gray-800 dark:text-gray-200 text-xs mt-0.5">
                  {gp.processing_type === "PASS_THROUGH" ? "Langsung" : "Proses"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Cabang</p>
                <p className="font-medium text-gray-800 dark:text-gray-200 text-xs mt-0.5">{gp.branch_name}</p>
              </div>
            </div>

            {/* Info strip */}
            {status === "REJECTED" && gp.rejection_reason && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl px-3 py-2.5 flex items-start gap-2">
                <XCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                <p className="text-xs text-red-700 dark:text-red-300">
                  <span className="font-medium">Ditolak:</span> {gp.rejection_reason}
                </p>
              </div>
            )}

            {isInProgress && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl px-3 py-2.5 flex items-start gap-2">
                <Info size={14} className="text-blue-500 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  {gp.processing_type === "PASS_THROUGH"
                    ? "Cek kondisi setiap barang, lalu selesaikan per item."
                    : "Isi output setiap item, selesaikan satu per satu."}
                </p>
              </div>
            )}

            {/* Summary (confirmed) */}
            {status === "CONFIRMED" && gp.total_input_qty != null && (
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 p-4 space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 size={16} className="text-green-600" />
                  <p className="font-semibold text-green-800 dark:text-green-300 text-sm">Ringkasan Proses</p>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{gp.total_input_qty}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Input</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-green-700 dark:text-green-400">{gp.total_output_qty}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Output</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-600 dark:text-gray-300">{gp.yield_percentage}%</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Yield</p>
                  </div>
                </div>
              </div>
            )}

            {/* Return items */}
            {(status === "CONFIRMED" || isInProgress) && (
              <ReturnItemsSection
                gp={gp}
                onResolve={handleResolveReturn}
                canApprove={canApprove}
                canRelease={canRelease}
                resolvingOutputId={resolvingOutputId}
                resolvingResolution={resolvingResolution}
              />
            )}

            {/* ── Action bar (desktop: in sidebar / mobile: fixed bottom) ── */}
            <div className="hidden lg:block space-y-2">
              {status === "DRAFT" && canUpdate && (
                <button onClick={handleStart} disabled={isBusy}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-blue-700 transition-all"
                >
                  <Play size={16} />
                  {isBusy ? "Memulai..." : "Mulai Proses"}
                </button>
              )}

              {isInProgress && isEditable && (
                <div className="space-y-2">
                  {status === "CORRECTING" && (
                    <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                      Mode koreksi — stok output sudah dibalik. Edit tiap item lalu <strong>Selesaikan item ini</strong>, lalu finalisasi ulang.
                    </p>
                  )}
                  {doneCount > 0 && !allDone && (
                    <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                      {doneCount} dari {totalCount} item selesai (stok item itu sudah masuk).
                      Selesaikan sisanya dengan <strong>Selesaikan item ini</strong> — tombol finalisasi GP baru muncul jika semua item selesai dan retur (jika ada) sudah diproses.
                    </p>
                  )}
                  {allDone && hasPendingReturns && (
                    <p className="text-xs text-orange-800 dark:text-orange-200 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg px-3 py-2">
                      Semua item sudah dikonfirmasi per baris, tetapi masih ada{" "}
                      <strong>{pendingReturnCount} barang retur</strong> yang belum diproses.
                      Selesaikan di <strong>Barang Retur Tiba</strong> (masuk gudang atau buang) sebelum finalisasi GP.
                    </p>
                  )}
                  {canFinalizeGp && (
                    <p className="text-xs text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2">
                      Semua item selesai.
                      {canApprove
                        ? " Finalisasi GP untuk menutup dokumen (tidak bisa diedit lagi)."
                        : " Menunggu persetujuan finalisasi."}
                    </p>
                  )}
                  {canFinalizeGp && canApprove && (
                    <button type="button" onClick={handleConfirmGp} disabled={isBusy}
                      className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-green-700 transition-all"
                    >
                      <CheckCircle2 size={16} />
                      {isBusy ? "Memproses..." : "Finalisasi GP"}
                    </button>
                  )}
                </div>
              )}

              {needsReopen && canApprove && (
                <div className="space-y-2">
                  <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                    GP terlanjur difinalisasi ({doneCount}/{totalCount} item selesai). Item belum selesai tidak bisa diedit sampai dibuka kembali.
                  </p>
                  <button type="button" onClick={handleReopen} disabled={isBusy}
                    className="w-full py-3 bg-amber-600 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-amber-700 transition-all"
                  >
                    <RotateCcw size={16} />
                    {isBusy ? "Memproses..." : "Buka kembali untuk lanjutkan item"}
                  </button>
                </div>
              )}

              {canUnconfirmForCorrection && (
                <div className="space-y-2">
                  <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                    Perlu ubah output setelah finalisasi? Buka koreksi — stok yang sudah masuk akan dibalik.
                  </p>
                  <button type="button" onClick={handleUnconfirm} disabled={isBusy}
                    className="w-full py-3 bg-amber-600 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-amber-700 transition-all"
                  >
                    <RotateCcw size={16} />
                    {unconfirmMut.isPending ? "Memproses..." : "Buka untuk koreksi"}
                  </button>
                </div>
              )}

              {status === "CONFIRMED" && allDone && !canApprove && (
                <div className="flex items-center justify-center gap-2 py-2">
                  <CheckCircle2 size={16} className="text-green-600" />
                  <p className="text-sm text-green-700 dark:text-green-300 font-medium">Proses selesai</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL — item cards ── */}
        <div className={`flex-1 px-4 py-4 space-y-3 max-w-2xl mx-auto lg:mx-0 lg:max-w-none ${showMobileActionBar ? "pb-32" : "pb-4"} lg:pb-8`}>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-0.5">
            {totalCount} Item · {doneCount} selesai
          </p>

          {localInputs.map((inp, inputIndex) => {
            const grLine = getGrLine(inp.gr_line_id)
            return inp.requires_processing ? (
              <DisassemblyCard
                key={inp.id}
                input={inp}
                grLine={grLine}
                productUoms={uomConversions?.[inp.product_id] ?? []}
                uomMap={uomConversions ?? {}}
                gpHeaderStatus={status}
                isEditable={isEditable && !isGpInputLineComplete(inp.status, status)}
                onChange={(oi, updated) => updateDisassemblyOutput(inputIndex, oi, updated as LocalOutput & { _delete?: boolean })}
                onAddOutput={() => setAddOutputFor(inp.id)}
                onConfirmItem={() => handleConfirmItem(inp)}
                isConfirming={confirmingInputId === inp.id}
              />
            ) : (
              <PassThroughCard
                key={inp.id}
                input={inp}
                output={inp.outputs[0] ?? { id: '', product_id: '', product_name: '', product_code: '', qty_output: 0, uom: '', is_waste: false, waste_reason: null, condition_status: null, actual_qty: null, actual_uom: null, flagged_for_return: false, return_reason: null, sort_order: 0 }}
                gpHeaderStatus={status}
                isEditable={isEditable && !isGpInputLineComplete(inp.status, status)}
                onChange={(updated) => updatePassThroughOutput(inputIndex, updated)}
                productUoms={uomConversions?.[inp.product_id] ?? []}
                grLine={grLine}
                onConfirmItem={() => handleConfirmItem(inp)}
                isConfirming={confirmingInputId === inp.id}
              />
            )
          })}
        </div>
      </div>

      {/* ── Mobile bottom action bar ── */}
      {showMobileActionBar && (
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 px-4 py-3 safe-area-pb">
        <div className="max-w-lg mx-auto">
          {status === "DRAFT" && canUpdate && (
            <button onClick={handleStart} disabled={isBusy}
              className="w-full py-3.5 bg-blue-600 text-white rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-blue-700 transition-all"
            >
              <Play size={16} />
              {isBusy ? "Memulai..." : "Mulai Proses"}
            </button>
          )}

          {isInProgress && isEditable && canFinalizeGp && canApprove && (
            <button type="button" onClick={handleConfirmGp} disabled={isBusy}
              className="w-full py-3.5 bg-green-600 text-white rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-green-700 transition-all"
            >
              <CheckCircle2 size={16} />
              {isBusy ? "Memproses..." : "Finalisasi GP"}
            </button>
          )}

          {isInProgress && isEditable && allDone && hasPendingReturns && (
            <p className="text-xs text-center text-orange-700 dark:text-orange-300 py-1">
              Selesaikan {pendingReturnCount} retur di atas sebelum finalisasi
            </p>
          )}


          {needsReopen && canApprove && (
            <button type="button" onClick={handleReopen} disabled={isBusy}
              className="w-full py-3.5 bg-amber-600 text-white rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-amber-700 transition-all"
            >
              <RotateCcw size={16} />
              {isBusy ? "Memproses..." : "Buka kembali untuk lanjutkan item"}
            </button>
          )}

          {canUnconfirmForCorrection && (
            <button type="button" onClick={handleUnconfirm} disabled={isBusy}
              className="w-full py-3.5 bg-amber-600 text-white rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-amber-700 transition-all"
            >
              <RotateCcw size={16} />
              {unconfirmMut.isPending ? "Memproses..." : "Buka untuk koreksi"}
            </button>
          )}

          {status === "CONFIRMED" && allDone && !canApprove && (
            <div className="flex items-center justify-center gap-2 py-2">
              <CheckCircle2 size={16} className="text-green-600" />
              <p className="text-sm text-green-700 dark:text-green-300 font-medium">Proses selesai · Stok sudah masuk gudang</p>
            </div>
          )}
        </div>
      </div>
      )}

      {/* ── Modals ── */}
      {addOutputFor != null && addOutputInput && (
        <AddOutputModal
          template={addOutputInput.output_template}
          onAdd={(output) => addDisassemblyOutput(localInputs.findIndex(inp => inp.id === addOutputFor), output)}
          onCancel={() => setAddOutputFor(null)}
        />
      )}
    </div>
  )
}