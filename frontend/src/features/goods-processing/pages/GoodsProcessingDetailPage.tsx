import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';
import {
  ArrowLeft, CheckCircle2, XCircle, AlertTriangle,
  Plus, Trash2, Save, Play, RotateCcw, Info,
   CheckCheck,
} from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import { parseApiError } from "@/lib/errorParser";
import { usePermissionStore } from "@/features/branch_context/store/permission.store";
import {
  useGoodsProcessingDetail,
  useStartGoodsProcessing,
  useUpdateGoodsProcessing,
  useConfirmGoodsProcessing,
  useRejectGoodsProcessing,
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

  if (inp.requires_processing) {
    return template.length > 0 ? outputsFromTemplate(inp) : []
  }

  const o = inp.outputs[0]
  return [{
    id: o?.id,
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

function toBaseQty(qty: number, uomName: string, uoms: ProductUomRow[]): number {
  if (!uoms.length) return qty
  const match = uoms.find((u) => u.unit_name === uomName)
  return qty * (match?.conversion_factor ?? 1)
}

function fromBaseQty(baseQty: number, uomName: string, uoms: ProductUomRow[]): number {
  if (!uoms.length) return baseQty
  const match = uoms.find((u) => u.unit_name === uomName)
  const cf = match?.conversion_factor ?? 1
  return cf > 0 ? baseQty / cf : baseQty
}

function resolveBaseUom(uoms: ProductUomRow[], fallbackUom: string): string {
  return uoms.find((u) => u.is_base_unit)?.unit_name ?? fallbackUom
}

function fmtGpQty(n: number): string {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 4 }).format(n)
}

function derivePassThroughSplit(
  output: LocalOutput,
  input: LocalInput,
  uoms: ProductUomRow[],
): { totalBase: number; goodBase: number; damagedBase: number; baseUom: string } {
  const baseUom = resolveBaseUom(uoms, input.uom)
  const totalBase = toBaseQty(input.qty_input, input.uom, uoms)

  let goodBase: number
  if (output.actual_qty != null && output.actual_uom) {
    goodBase = toBaseQty(output.actual_qty, output.actual_uom, uoms)
  } else if (output.condition_status === 'OK') {
    goodBase = totalBase
  } else {
    goodBase = totalBase
  }

  const damagedBase = Math.max(0, totalBase - goodBase)
  return { totalBase, goodBase, damagedBase, baseUom }
}

function buildPassThroughOutput(
  output: LocalOutput,
  input: LocalInput,
  goodBase: number,
  damagedBase: number,
  baseUom: string,
): LocalOutput {
  const hasDamage = damagedBase > 0.0001
  return {
    ...output,
    qty_output: input.qty_input,
    uom: input.uom,
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

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  DRAFT:      { label: "Draft",     color: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",   dot: "bg-gray-400"  },
  PROCESSING: { label: "Diproses",  color: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",    dot: "bg-blue-500"  },
  QC_REVIEW:  { label: "Review QC", color: "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300", dot: "bg-yellow-500" },
  CONFIRMED:  { label: "Selesai",   color: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300",  dot: "bg-green-500" },
  REJECTED:   { label: "Ditolak",   color: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",      dot: "bg-red-500"   },
};

// ── PassThroughCard ───────────────────────────────────────────────────────────

function PassThroughCard({
  input, output, isEditable, onChange, productUoms, grLine, onConfirmItem, isConfirming,
}: {
  input: LocalInput
  output: LocalOutput
  isEditable: boolean
  onChange: (updated: LocalOutput) => void
  productUoms: ProductUomRow[]
  grLine: { qty_received: number; uom_received: string } | null
  onConfirmItem: () => void
  isConfirming: boolean
}) {
  const isDone = input.status === 'DONE'
  const { totalBase, goodBase, damagedBase, baseUom } = derivePassThroughSplit(output, input, productUoms)
  const inputUomHint =
    input.uom !== baseUom
      ? `≈ ${fmtGpQty(fromBaseQty(totalBase, input.uom, productUoms))} ${input.uom}`
      : null

  const overTotal = goodBase + damagedBase > totalBase + 0.0001
  const hasDamage = damagedBase > 0.0001
  const missingDisposition = hasDamage && !output.flagged_for_return && !output.is_waste
  const missingReason =
    hasDamage &&
    ((output.flagged_for_return && !(output.return_reason?.trim())) ||
      (output.is_waste && !(output.waste_reason?.trim())))
  const canConfirm = !overTotal && !missingDisposition && !missingReason

  const applyGood = (raw: string) => {
    const parsed = raw === '' ? 0 : parseFloat(raw)
    const good = Math.min(Math.max(0, Number.isFinite(parsed) ? parsed : 0), totalBase)
    const damaged = Math.max(0, totalBase - good)
    onChange(buildPassThroughOutput(output, input, good, damaged, baseUom))
  }

  const applyDamaged = (raw: string) => {
    const parsed = raw === '' ? 0 : parseFloat(raw)
    const damaged = Math.min(Math.max(0, Number.isFinite(parsed) ? parsed : 0), totalBase)
    const good = Math.max(0, totalBase - damaged)
    onChange(buildPassThroughOutput(output, input, good, damaged, baseUom))
  }

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
          <p className="text-xs text-gray-500 dark:text-gray-400">{baseUom} total</p>
          {inputUomHint && (
            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-0.5">{inputUomHint}</p>
          )}
          {grLine && grLine.uom_received !== baseUom && grLine.uom_received !== input.uom && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              timbang {fmtGpQty(grLine.qty_received)} {grLine.uom_received}
            </p>
          )}
        </div>
      </div>

      {/* Summary strip */}
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
        {output.flagged_for_return && (
          <div className="flex items-center gap-1.5 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg px-2.5 py-1.5">
            <span className="text-xs text-orange-700 dark:text-orange-300 font-medium">🔄 Retur</span>
          </div>
        )}
        {output.is_waste && (
          <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-2.5 py-1.5">
            <span className="text-xs text-red-700 dark:text-red-300 font-medium">🗑 Waste</span>
          </div>
        )}
        {isDone && (
          <div className="flex items-center gap-1.5 bg-green-100 dark:bg-green-900/40 border border-green-300 dark:border-green-700 rounded-lg px-2.5 py-1.5">
            <span className="text-xs text-green-700 dark:text-green-300 font-bold">✓ Masuk gudang</span>
          </div>
        )}
      </div>

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
                    ...buildPassThroughOutput(output, input, goodBase, damagedBase, baseUom),
                    flagged_for_return: true,
                    is_waste: false,
                    waste_reason: null,
                  })}
                  className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                    output.flagged_for_return
                      ? 'bg-orange-500 border-orange-500 text-white'
                      : 'bg-white dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600 dark:placeholder:text-gray-500 border-gray-200 text-gray-600 hover:border-orange-300 dark:hover:border-orange-600'
                  }`}
                >
                  Retur supplier
                </button>
                <button
                  type="button"
                  onClick={() => onChange({
                    ...buildPassThroughOutput(output, input, goodBase, damagedBase, baseUom),
                    is_waste: true,
                    flagged_for_return: false,
                    return_reason: null,
                  })}
                  className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                    output.is_waste
                      ? 'bg-red-500 border-red-500 text-white'
                      : 'bg-white dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 border-gray-200 dark:border-gray-600 text-gray-600 hover:border-red-300 dark:hover:border-red-600'
                  }`}
                >
                  Waste
                </button>
              </div>
              {(output.flagged_for_return || output.is_waste) && (
                <input
                  type="text"
                  value={output.flagged_for_return ? (output.return_reason ?? '') : (output.waste_reason ?? '')}
                  onChange={(e) => onChange({
                    ...buildPassThroughOutput(output, input, goodBase, damagedBase, baseUom),
                    return_reason: output.flagged_for_return ? e.target.value || null : null,
                    waste_reason: output.is_waste ? e.target.value || null : null,
                  })}
                  placeholder={output.flagged_for_return ? 'Alasan retur (wajib)...' : 'Alasan waste (wajib)...'}
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

      {isDone && (
        <div className="flex items-center gap-2 flex-wrap border-t border-gray-100 dark:border-gray-700 pt-2">
          <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 dark:text-green-300 font-medium">
            {fmtGpQty(goodBase)} {baseUom} masuk gudang
          </span>
          {hasDamage && (
            <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 dark:text-red-300 font-medium">
              {fmtGpQty(damagedBase)} {baseUom} rusak
            </span>
          )}
          {output.flagged_for_return && (
            <span className="text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-700 dark:text-orange-300 font-medium">
              Retur{output.return_reason ? `: ${output.return_reason}` : ''}
            </span>
          )}
          {output.is_waste && (
            <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 dark:text-red-300 font-medium">
              Waste{output.waste_reason ? `: ${output.waste_reason}` : ''}
            </span>
          )}
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
  return (
    <div className={`rounded-lg border p-3 space-y-2 ${output.is_waste ? "border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-900/20" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"}`}>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{output.product_name}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">{output.product_code}</p>
        </div>
        {isEditable && (
          <button type="button" onClick={onRemove} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors shrink-0">
            <Trash2 size={14} />
          </button>
        )}
      </div>
      {isEditable ? (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 focus-within:ring-2 focus-within:ring-blue-300 transition-all">
            <input type="number" min={0} step="0.01"
              value={output.qty_output || ""}
              onChange={(e) => onChange({ ...output, qty_output: parseFloat(e.target.value) || 0 })}
              placeholder="0"
              className="w-20 text-sm outline-none text-right font-mono"
            />
            <span className="text-xs text-gray-500 dark:text-gray-400">{output.uom}</span>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 select-none cursor-pointer">
            <input type="checkbox" checked={output.is_waste}
              onChange={(e) => onChange({ ...output, is_waste: e.target.checked })}
              className="rounded accent-red-500"
            />
            Waste
          </label>
          {output.is_waste && (
            <input type="text" value={output.waste_reason ?? ""}
              onChange={(e) => onChange({ ...output, waste_reason: e.target.value || null })}
              placeholder="Alasan waste..."
              className="flex-1 min-w-0 border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-200 bg-white dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
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
  input, grLine, isEditable, onChange, onAddOutput, onConfirmItem, isConfirming,
}: {
  input: LocalInput
  grLine: { qty_received: number; uom_received: string } | null
  isEditable: boolean
  onChange: (outputIndex: number, updated: LocalOutput) => void
  onAddOutput: () => void
  onConfirmItem: () => void
  isConfirming: boolean
}) {
  const isDone = input.status === 'DONE'
  const totalNonWaste = input.outputs.filter(o => !o.is_waste).reduce((s, o) => s + (o.qty_output || 0), 0)
  const totalWaste = input.outputs.filter(o => o.is_waste).reduce((s, o) => s + (o.qty_output || 0), 0)
  const pct = input.qty_input > 0 ? Math.round((totalNonWaste / input.qty_input) * 100) : 0
  const overLimit = totalNonWaste > input.qty_input
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
          <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{input.qty_input}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{input.uom} masuk</p>
          {grLine && (
            <p className="text-xs text-blue-600 font-medium mt-0.5">
              ≈ {grLine.qty_received} {grLine.uom_received}
            </p>
          )}
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
                  Input: <span className="font-bold">{input.qty_input} {input.uom}</span>
                </span>
              </div>
              <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 border ${
                overLimit ? "bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-800" : pct >= 90 ? "bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800" : "bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600"
              }`}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${overLimit ? "bg-red-500" : pct >= 90 ? "bg-green-500" : "bg-gray-400"}`} />
                <span className={`text-xs font-medium ${overLimit ? "text-red-700 dark:text-red-300" : pct >= 90 ? "text-green-700 dark:text-green-300" : "text-gray-600 dark:text-gray-300"}`}>
                  Output: <span className="font-bold">{totalNonWaste.toFixed(2)} {input.uom}</span>
                  {overLimit && <span className="ml-1">⚠</span>}
                </span>
              </div>
              {totalWaste > 0 && (
                <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-2.5 py-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                  <span className="text-xs text-red-700 dark:text-red-300 font-medium">
                    Waste: <span className="font-bold">{totalWaste.toFixed(2)} {input.uom}</span>
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

function ReturnItemsSection({ gp, onResolve, canApprove }: {
  gp: GoodsProcessingDetail
  onResolve: (outputId: string, resolution: "STOCK" | "DISCARD") => void
  canApprove: boolean
}) {
  const returnItems = gp.inputs.flatMap(inp =>
    inp.outputs.filter(o => o.flagged_for_return && !o.return_resolved_at)
      .map(o => ({ ...o, input_product_name: inp.product_name }))
  )
  if (returnItems.length === 0) return null
  return (
    <div className="rounded-xl border-2 border-orange-200 dark:border-orange-800 bg-orange-50/30 dark:bg-orange-900/20 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <RotateCcw size={16} className="text-orange-600 dark:text-orange-400" />
        <h3 className="font-semibold text-orange-800 dark:text-orange-300 text-sm">Menunggu Retur ({returnItems.length})</h3>
      </div>
      {returnItems.map(item => (
        <div key={item.id} className="bg-white dark:bg-gray-800 rounded-lg border border-orange-200 dark:border-orange-800 p-3 space-y-2">
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
          {canApprove && (
            <div className="flex gap-2">
              <button type="button" onClick={() => onResolve(item.id, "STOCK")}
                className="flex-1 py-1.5 bg-green-50 dark:bg-green-900/30 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 rounded-lg text-xs font-medium hover:bg-green-100 transition-colors"
              >✓ Masukkan Gudang</button>
              <button type="button" onClick={() => onResolve(item.id, "DISCARD")}
                className="flex-1 py-1.5 bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors"
              >🗑 Buang</button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── RejectModal ───────────────────────────────────────────────────────────────

function RejectModal({ onConfirm, onCancel, loading }: {
  onConfirm: (reason: string) => void
  onCancel: () => void
  loading: boolean
}) {
  const [reason, setReason] = useState("")
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
        <div className="flex items-center gap-2">
          <XCircle size={20} className="text-red-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Tolak Proses</h3>
        </div>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="Alasan penolakan..." rows={3} autoFocus
          className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none bg-white dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
        />
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Batal</button>
          <button onClick={() => reason.trim() && onConfirm(reason.trim())} disabled={!reason.trim() || loading}
            className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-red-600 transition-colors"
          >{loading ? "Menyimpan..." : "Tolak"}</button>
        </div>
      </div>
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

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold text-gray-900 dark:text-white">Tambah Output</h3>
        {template.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Dari template:</p>
            <div className="space-y-1.5">
              {template.map(t => (
                <button key={t.id} type="button"
                  onClick={() => { setProductId(t.output_product_id); setProductName(t.output_product_name); setProductCode(t.output_product_code); setUom(t.output_uom) }}
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
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 mb-1">atau isi manual:</p>
          </div>
        )}
        <div className="space-y-2">
          <input type="text" value={productName} onChange={(e) => setProductName(e.target.value)}
            placeholder="Nama produk output"
            className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
          />
          <div className="flex gap-2">
            <input type="number" value={qty} onChange={(e) => setQty(e.target.value)}
              placeholder="Qty"
              className="flex-1 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
            <input type="text" value={uom} onChange={(e) => setUom(e.target.value)}
              placeholder="UOM"
              className="w-24 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Batal</button>
          <button
            onClick={() => {
              if (!productId && !productName) return
              onAdd({ id: undefined, product_id: productId || "custom", product_name: productName, product_code: productCode, qty_output: parseFloat(qty) || 0, uom, is_waste: false, waste_reason: null, condition_status: null, actual_qty: null, actual_uom: null, flagged_for_return: false, return_reason: null })
            }}
            disabled={!productName || !qty || !uom}
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

  const { data: gp, isLoading, error } = useGoodsProcessingDetail(id!)
  const startMut = useStartGoodsProcessing(id!)
  const updateMut = useUpdateGoodsProcessing(id!)
  const confirmMut = useConfirmGoodsProcessing(id!)
  const rejectMut = useRejectGoodsProcessing(id!)
  const resolveMut = useResolveReturn(id!)
  const confirmInputMut = useConfirmGoodsProcessingInput(id!)

  const [confirmingInputId, setConfirmingInputId] = useState<string | null>(null)

  const { data: uomConversions } = useQuery({
    queryKey: ['product-uoms', 'conversions-gp', gp?.id],
    queryFn: async () => {
      const productIds = gp!.inputs.map(inp => inp.product_id)
      const { data } = await api.post('/product-uoms/conversions-batch', { product_ids: productIds })
      return data.data as Record<string, Array<{ unit_name: string; conversion_factor: number; is_base_unit: boolean }>>
    },
    enabled: !!gp,
    staleTime: 60_000,
  })

  const { data: grDetail } = useQuery({
    queryKey: ['gr-detail-for-gp', gp?.goods_receipt_id],
    queryFn: async () => {
      const { data } = await api.get(`/goods-receipts/${gp!.goods_receipt_id}`)
      return data.data as { lines: Array<{ id: string; qty_received: number; uom_received: string }> }
    },
    enabled: !!gp?.goods_receipt_id,
    staleTime: 60_000,
  })

  const getGrLine = (grLineId: string) =>
    grDetail?.lines.find(l => l.id === grLineId) ?? null

  const [localInputs, setLocalInputs] = useState<LocalInput[]>([])
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [addOutputFor, setAddOutputFor] = useState<string | null>(null)

  useEffect(() => {
    if (gp) setLocalInputs(initLocalInputs(gp))
  }, [gp])

  const isEditable = useMemo(
    () => canUpdate && (gp?.status === "PROCESSING" || gp?.status === "REJECTED"),
    [canUpdate, gp?.status]
  )

  // Progress counts
  const doneCount = localInputs.filter(inp => inp.status === 'DONE').length
  const totalCount = localInputs.length
  const allDone = doneCount === totalCount && totalCount > 0
  // Debug: log semua status input
  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleConfirmItem = useCallback(async (inp: LocalInput) => {
    setConfirmingInputId(inp.id)
    try {
      await confirmInputMut.mutateAsync({
        inputId: inp.id,
        outputs: inp.outputs
          .filter(o => !(o as LocalOutput & { _delete?: boolean })._delete)
          .map((o, i) => ({
            id: o.id,
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
            sort_order: i,
          })),
      })
      addToast("success", `${inp.product_name} selesai ✓`)
    } catch (e) {
      addToast("error", parseApiError(e, "Terjadi kesalahan"))
    } finally {
      setConfirmingInputId(null)
    }
  }, [confirmInputMut, addToast])

  const handleSave = useCallback(async () => {
    if (!gp) return
    try {
      await updateMut.mutateAsync({
        inputs: localInputs.map(inp => ({
          id: inp.id,
          outputs: inp.outputs
            .filter(o => !(o as LocalOutput & { _delete?: boolean })._delete)
            .map((o, i) => ({
              id: o.id, product_id: o.product_id, qty_output: o.qty_output, uom: o.uom,
              is_waste: o.is_waste, waste_reason: o.waste_reason, condition_status: o.condition_status,
              actual_qty: o.actual_qty, actual_uom: o.actual_uom, flagged_for_return: o.flagged_for_return,
              return_reason: o.return_reason, sort_order: i,
            })),
        })),
      })
      addToast("success", "Tersimpan")
    } catch (e) {
      addToast("error", parseApiError(e, "Terjadi kesalahan"))
    }
  }, [gp, localInputs, updateMut, addToast])

  const handleConfirmGp = useCallback(async () => {
    if (!gp) return
    const done = localInputs.filter((inp) => inp.status === 'DONE').length
    if (done < localInputs.length) {
      addToast("error", "Selesaikan semua item terlebih dahulu")
      return
    }
    try {
      await confirmMut.mutateAsync()
      addToast("success", "Barang masuk gudang ✓")
    } catch (e) {
      addToast("error", parseApiError(e, "Gagal konfirmasi"))
    }
  }, [gp, localInputs, confirmMut, addToast])

  const handleStart = useCallback(async () => {
    try {
      await startMut.mutateAsync()
      addToast("success", "Proses dimulai")
    } catch (e) {
      addToast("error", parseApiError(e, "Terjadi kesalahan"))
    }
  }, [startMut, addToast])

  const handleReject = useCallback(async (reason: string) => {
    try {
      await rejectMut.mutateAsync({ rejection_reason: reason })
      setShowRejectModal(false)
      addToast("info", "Proses ditolak")
    } catch (e) {
      addToast("error", parseApiError(e, "Terjadi kesalahan"))
    }
  }, [rejectMut, addToast])

  const handleResolveReturn = useCallback(async (outputId: string, resolution: "STOCK" | "DISCARD") => {
    try {
      await resolveMut.mutateAsync({ outputId, resolution })
      addToast("success", resolution === "STOCK" ? "Barang masuk gudang" : "Barang dibuang")
    } catch (e) {
      addToast("error", parseApiError(e, "Terjadi kesalahan"))
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
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]
  const isBusy = startMut.isPending || updateMut.isPending || confirmMut.isPending || rejectMut.isPending
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
        {status === "PROCESSING" && totalCount > 0 && (
          <div className="px-4 pb-3">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-gray-500 dark:text-gray-400">Progress item</span>
              <span className={`font-semibold ${allDone ? "text-green-600" : "text-blue-600"}`}>
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

            {status === "PROCESSING" && (
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
            {(status === "CONFIRMED" || status === "PROCESSING") && (
              <ReturnItemsSection gp={gp} onResolve={handleResolveReturn} canApprove={canApprove} />
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

              {(status === "PROCESSING" || status === "REJECTED") && isEditable && (
                <div className="space-y-2">
                  {allDone && status === "PROCESSING" && (
                    <p className="text-xs text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2">
                      Semua item selesai.{canApprove ? " Konfirmasi untuk posting stok ke gudang." : " Menunggu konfirmasi final."}
                    </p>
                  )}
                  {allDone && canApprove && status === "PROCESSING" && (
                    <button type="button" onClick={handleConfirmGp} disabled={isBusy}
                      className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-green-700 transition-all"
                    >
                      <CheckCircle2 size={16} />
                      {isBusy ? "Memproses..." : "Konfirmasi masuk gudang"}
                    </button>
                  )}
                  {!allDone && (
                    <div className="flex gap-2">
                      <button onClick={handleSave} disabled={isBusy}
                        className="flex items-center gap-1.5 px-4 py-3 border-2 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-medium text-sm disabled:opacity-50 hover:border-gray-300 dark:hover:border-gray-500 transition-all shrink-0"
                      >
                        <Save size={15} />
                        Simpan
                      </button>
                      {canApprove && (
                        <button onClick={() => setShowRejectModal(true)} disabled={isBusy}
                          className="flex items-center gap-1.5 px-4 py-3 border-2 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl font-medium text-sm disabled:opacity-50 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all shrink-0"
                        >
                          <XCircle size={15} />
                          Tolak
                        </button>
                      )}
                    </div>
                  )}
                  {allDone && canApprove && (
                    <button type="button" onClick={() => setShowRejectModal(true)} disabled={isBusy}
                      className="w-full py-2 border-2 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                    >
                      Tolak seluruh proses
                    </button>
                  )}
                </div>
              )}

              {status === "QC_REVIEW" && canApprove && (
                <div className="flex gap-2">
                  <button onClick={() => setShowRejectModal(true)} disabled={isBusy}
                    className="flex-1 py-3 border-2 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl font-semibold text-sm disabled:opacity-50 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                  >Tolak</button>
                  <button onClick={() => confirmMut.mutateAsync()} disabled={isBusy}
                    className="flex-1 py-3 bg-green-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50 hover:bg-green-700 transition-all"
                  >Konfirmasi</button>
                </div>
              )}

              {status === "CONFIRMED" && (
                <div className="flex items-center justify-center gap-2 py-2">
                  <CheckCircle2 size={16} className="text-green-600" />
                  <p className="text-sm text-green-700 dark:text-green-300 font-medium">Proses selesai</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL — item cards ── */}
        <div className="flex-1 px-4 py-4 space-y-3 max-w-2xl mx-auto lg:mx-0 lg:max-w-none pb-32 lg:pb-8">
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
                isEditable={isEditable}
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
                isEditable={isEditable}
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

          {(status === "PROCESSING" || status === "REJECTED") && isEditable && (
            <div className="space-y-2">
              {allDone && canApprove && status === "PROCESSING" ? (
                <button type="button" onClick={handleConfirmGp} disabled={isBusy}
                  className="w-full py-3.5 bg-green-600 text-white rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-green-700 transition-all"
                >
                  <CheckCircle2 size={16} />
                  {isBusy ? "Memproses..." : "Konfirmasi masuk gudang"}
                </button>
              ) : !allDone ? (
                <div className="flex gap-2">
                  <button onClick={handleSave} disabled={isBusy}
                    className="flex items-center gap-1.5 px-4 py-3.5 border-2 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-2xl font-medium text-sm disabled:opacity-50 hover:border-gray-300 dark:hover:border-gray-500 transition-all shrink-0"
                  >
                    <Save size={15} />
                    Simpan
                  </button>
                  {canApprove && (
                    <button onClick={() => setShowRejectModal(true)} disabled={isBusy}
                      className="px-3 py-3.5 border-2 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-2xl font-medium text-sm disabled:opacity-50 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all shrink-0"
                    >
                      <XCircle size={15} />
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-center text-xs text-gray-500 dark:text-gray-400 py-1">
                  Semua item selesai — menunggu konfirmasi final
                </p>
              )}
            </div>
          )}

          {status === "QC_REVIEW" && canApprove && (
            <div className="flex gap-2">
              <button onClick={() => setShowRejectModal(true)} disabled={isBusy}
                className="flex-1 py-3.5 border-2 border-red-200 text-red-600 rounded-2xl font-semibold text-sm disabled:opacity-50 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
              >Tolak</button>
              <button onClick={() => confirmMut.mutateAsync()} disabled={isBusy}
                className="flex-1 py-3.5 bg-green-600 text-white rounded-2xl font-semibold text-sm disabled:opacity-50 hover:bg-green-700 transition-all"
              >Konfirmasi</button>
            </div>
          )}

          {status === "CONFIRMED" && (
            <div className="flex items-center justify-center gap-2 py-2">
              <CheckCircle2 size={16} className="text-green-600" />
              <p className="text-sm text-green-700 dark:text-green-300 font-medium">Proses selesai · Stok sudah masuk gudang</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {showRejectModal && (
        <RejectModal onConfirm={handleReject} onCancel={() => setShowRejectModal(false)} loading={rejectMut.isPending} />
      )}
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