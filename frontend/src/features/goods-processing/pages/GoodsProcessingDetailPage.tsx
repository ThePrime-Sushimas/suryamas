import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Plus,
  Trash2,
  Save,
  Play,
  RotateCcw,
  Info,
  ClipboardCheck,
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
} from "../api/goodsProcessing.api";
import type {
  GoodsProcessingDetail,
  ConditionStatus,
  OutputTemplateRow,
} from "../api/goods-processing.types";

// ── Local state types ─────────────────────────────────────────────────────────

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
  // For pass-through display
  is_pass_through_output?: boolean;
}

interface LocalInput {
  id: string;
  product_id: string;
  product_name: string;
  product_code: string;
  qty_input: number;
  uom: string;
  requires_processing: boolean;
  output_template: OutputTemplateRow[];
  outputs: LocalOutput[];
  expanded: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function initLocalInputs(detail: GoodsProcessingDetail): LocalInput[] {
  return detail.inputs.map((inp) => ({
    id: inp.id,
    product_id: inp.product_id,
    product_name: inp.product_name,
    product_code: inp.product_code,
    qty_input: Number(inp.qty_input),
    uom: inp.uom,
    requires_processing: inp.requires_processing,
    output_template: inp.output_template ?? [],
    expanded: true,
    outputs:
      inp.outputs.length > 0
        ? inp.outputs.map((o, i) => ({
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
            is_pass_through_output: !inp.requires_processing,
          }))
        : inp.requires_processing
          ? inp.output_template.length > 0
            ? inp.output_template.map((t, i) => ({
                product_id: t.output_product_id,
                product_name: t.output_product_name,
                product_code: t.output_product_code,
                qty_output:
                  t.suggested_pct != null
                    ? Math.round(
                        Number(inp.qty_input) * (t.suggested_pct / 100) * 100,
                      ) / 100
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
            : []
          : [
              {
                id: inp.outputs[0]?.id,
                product_id: inp.product_id,
                product_name: inp.product_name,
                product_code: inp.product_code,
                qty_output: Number(inp.qty_input),
                uom: inp.uom,
                is_waste: false,
                waste_reason: null,
                condition_status: "OK" as ConditionStatus,
                actual_qty: null,
                actual_uom: null,
                flagged_for_return: false,
                return_reason: null,
                sort_order: 0,
                is_pass_through_output: true,
              },
            ],
  }));
}

// Removed unused function 'toUpdateDto'

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  DRAFT: {
    label: "Draft",
    color: "bg-gray-100 text-gray-600",
    dot: "bg-gray-400",
  },
  PROCESSING: {
    label: "Diproses",
    color: "bg-blue-50 text-blue-700",
    dot: "bg-blue-500",
  },
  QC_REVIEW: {
    label: "Review QC",
    color: "bg-yellow-50 text-yellow-700",
    dot: "bg-yellow-500",
  },
  CONFIRMED: {
    label: "Selesai",
    color: "bg-green-50 text-green-700",
    dot: "bg-green-500",
  },
  REJECTED: {
    label: "Ditolak",
    color: "bg-red-50 text-red-700",
    dot: "bg-red-500",
  },
};

// ── Pass-through card ─────────────────────────────────────────────────────────

function PassThroughCard({
  input,
  output,
  isEditable,
  onChange,
  baseUomName = '',  // ← tambah prop, nama base unit (misal "g")
}: {
  input: LocalInput
  output: LocalOutput
  isEditable: boolean
  onChange: (updated: LocalOutput) => void
  baseUomName?: string
}) {
  const displayUom = baseUomName || input.uom

  return (
    <div className={`rounded-xl border-2 transition-all p-4 space-y-3 ${
      output.condition_status === "OK" ? "border-green-200 bg-green-50/30"
      : output.condition_status === "DAMAGED" ? "border-red-200 bg-red-50/30"
      : "border-gray-200 bg-white"
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900 text-base">{input.product_name}</p>
          <p className="text-xs text-gray-500 font-mono mt-0.5">{input.product_code}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-gray-800">{input.qty_input}</p>
          <p className="text-xs text-gray-500">{input.uom} masuk</p>
        </div>
      </div>

      {isEditable && (
        <>
          {/* Kondisi toggle — hanya 2 pilihan */}
          <div>
            <p className="text-xs font-medium text-gray-600 mb-1.5">Kondisi barang</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onChange({
                  ...output,
                  condition_status: "OK",
                  is_waste: false,
                  flagged_for_return: false,
                  return_reason: null,
                  waste_reason: null,
                })}
                className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                  output.condition_status === "OK"
                    ? "bg-green-500 border-green-500 text-white"
                    : "bg-white border-gray-200 text-gray-600 hover:border-green-300"
                }`}
              >
                ✓ Bagus
              </button>
              <button
                type="button"
                onClick={() => onChange({
                  ...output,
                  condition_status: "DAMAGED",
                  actual_qty: null,
                  actual_uom: null,
                })}
                className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                  output.condition_status === "DAMAGED"
                    ? "bg-red-500 border-red-500 text-white"
                    : "bg-white border-gray-200 text-gray-600 hover:border-red-300"
                }`}
              >
                ✕ Rusak
              </button>
            </div>
          </div>

          {/* BAGUS → input qty masuk gudang */}
          {output.condition_status === "OK" && (
            <div className="bg-green-50 rounded-xl p-3 space-y-1.5">
              <p className="text-xs font-medium text-green-800">Masuk gudang</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={output.actual_qty ?? ""}
                  onChange={(e) => onChange({
                    ...output,
                    actual_qty: e.target.value ? parseFloat(e.target.value) : null,
                    actual_uom: displayUom,
                  })}
                  placeholder={`qty dalam ${displayUom}`}
                  className="flex-1 border border-green-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
                />
                <span className="text-sm font-medium text-green-700 shrink-0">{displayUom}</span>
              </div>
              {output.actual_qty == null && (
                <p className="text-xs text-green-600 opacity-70">
                  Kosongkan jika sama dengan qty GR
                </p>
              )}
            </div>
          )}

          {/* RUSAK → qty rusak + retur atau waste */}
          {output.condition_status === "DAMAGED" && (
            <div className="bg-red-50 rounded-xl p-3 space-y-3">
              <div>
                <p className="text-xs font-medium text-red-800 mb-1.5">Qty rusak</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={output.actual_qty ?? ""}
                    onChange={(e) => onChange({
                      ...output,
                      actual_qty: e.target.value ? parseFloat(e.target.value) : null,
                      actual_uom: displayUom,
                    })}
                    placeholder={`qty dalam ${displayUom}`}
                    className="flex-1 border border-red-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
                  />
                  <span className="text-sm font-medium text-red-700 shrink-0">{displayUom}</span>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-red-800 mb-1.5">Penanganan</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onChange({ ...output, flagged_for_return: true, is_waste: false })}
                    className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-all ${
                      output.flagged_for_return
                        ? "bg-orange-100 border-orange-400 text-orange-700"
                        : "bg-white border-gray-200 text-gray-600"
                    }`}
                  >
                    🔄 Flag Retur
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange({ ...output, is_waste: true, flagged_for_return: false })}
                    className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-all ${
                      output.is_waste
                        ? "bg-red-100 border-red-400 text-red-700"
                        : "bg-white border-gray-200 text-gray-600"
                    }`}
                  >
                    🗑 Waste
                  </button>
                </div>
              </div>

              {(output.flagged_for_return || output.is_waste) && (
                <input
                  type="text"
                  value={output.flagged_for_return ? (output.return_reason ?? "") : (output.waste_reason ?? "")}
                  onChange={(e) => onChange({
                    ...output,
                    return_reason: output.flagged_for_return ? e.target.value || null : null,
                    waste_reason: output.is_waste ? e.target.value || null : null,
                  })}
                  placeholder={output.flagged_for_return ? "Alasan retur..." : "Alasan waste..."}
                  className="w-full border border-red-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-red-300 bg-white"
                />
              )}
            </div>
          )}
        </>
      )}

      {/* Read-only view */}
      {!isEditable && (
        <div className="flex items-center gap-2 flex-wrap">
          {output.condition_status === "OK" && (
            <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium">
              ✓ Bagus{output.actual_qty != null ? ` · ${output.actual_qty} ${output.actual_uom ?? input.uom}` : ''}
            </span>
          )}
          {output.condition_status === "DAMAGED" && (
            <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 font-medium">
              ✕ Rusak{output.actual_qty != null ? ` · ${output.actual_qty} ${output.actual_uom ?? input.uom}` : ''}
            </span>
          )}
          {output.flagged_for_return && (
            <span className="text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-700 font-medium">🔄 Retur</span>
          )}
          {output.is_waste && (
            <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 font-medium">🗑 Waste</span>
          )}
          {output.stock_movement_id && (
            <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium">✓ Masuk gudang</span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Disassembly output row ────────────────────────────────────────────────────

function DisassemblyOutputRow({
  inp: _inp,
  output,
  isEditable,
  onChange,
  onRemove,
}: {
  inp: LocalInput;
  output: LocalOutput;
  index: number;
  isEditable: boolean;
  onChange: (updated: LocalOutput) => void;
  onRemove: () => void;
}) {

  return (
    <div
      className={`rounded-lg border p-3 space-y-2 ${
        output.is_waste
          ? "border-red-200 bg-red-50/30"
          : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">
            {output.product_name}
          </p>
          <p className="text-xs text-gray-400 font-mono">
            {output.product_code}
          </p>
        </div>
        {isEditable && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors shrink-0"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {isEditable ? (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus-within:ring-2 focus-within:ring-blue-300 transition-all">
            <input
              type="number"
              min={0}
              step="0.01"
              value={output.qty_output || ""}
              onChange={(e) =>
                onChange({
                  ...output,
                  qty_output: parseFloat(e.target.value) || 0,
                })
              }
              placeholder="0"
              className="w-20 text-sm outline-none text-right font-mono"
            />
            <span className="text-xs text-gray-500">{output.uom}</span>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-gray-600 select-none cursor-pointer">
            <input
              type="checkbox"
              checked={output.is_waste}
              onChange={(e) =>
                onChange({ ...output, is_waste: e.target.checked })
              }
              className="rounded accent-red-500"
            />
            Waste
          </label>
          {output.is_waste && (
            <input
              type="text"
              value={output.waste_reason ?? ""}
              onChange={(e) =>
                onChange({ ...output, waste_reason: e.target.value || null })
              }
              placeholder="Alasan waste..."
              className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-200"
            />
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold text-gray-800">
            {output.qty_output}
          </span>
          <span className="text-xs text-gray-500">{output.uom}</span>
          {output.is_waste && (
            <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
              waste
            </span>
          )}
          {output.stock_movement_id && (
            <span className="text-xs bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full">
              ✓ gudang
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Disassembly card ──────────────────────────────────────────────────────────

function DisassemblyCard({
  input,
  isEditable,
  onChange,
  onAddOutput,
}: {
  input: LocalInput;
  isEditable: boolean;
  onChange: (outputIndex: number, updated: LocalOutput) => void;
  onAddOutput: () => void;
}) {
  const totalNonWaste = input.outputs
    .filter((o) => !o.is_waste)
    .reduce((s, o) => s + (o.qty_output || 0), 0);
  const pct =
    input.qty_input > 0
      ? Math.round((totalNonWaste / input.qty_input) * 100)
      : 0;
  const overLimit = totalNonWaste > input.qty_input;

  return (
    <div className="rounded-xl border-2 border-gray-200 bg-white p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900 text-base">
            {input.product_name}
          </p>
          <p className="text-xs text-gray-500 font-mono mt-0.5">
            {input.product_code}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-gray-800">{input.qty_input}</p>
          <p className="text-xs text-gray-500">{input.uom} masuk</p>
        </div>
      </div>

      {/* Yield bar */}
      <div className="space-y-1">
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-500">Total output</span>
          <span
            className={`font-semibold ${overLimit ? "text-red-600" : pct >= 90 ? "text-green-600" : "text-gray-700"}`}
          >
            {totalNonWaste.toFixed(2)} / {input.qty_input} {input.uom}
            {overLimit && (
              <span className="ml-1 text-red-500">⚠ melebihi input!</span>
            )}
          </span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${overLimit ? "bg-red-400" : pct >= 90 ? "bg-green-400" : "bg-blue-400"}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 text-right">Yield {pct}%</p>
      </div>

      {/* Output list */}
      <div className="space-y-2">
        {input.outputs.map((o, i) => (
          <DisassemblyOutputRow
            key={i}
            inp={input}
            output={o}
            index={i}
            isEditable={isEditable}
            onChange={(updated) => onChange(i, updated)}
            onRemove={() => {
              // handled by parent
              onChange(i, { ...o, _delete: true } as LocalOutput & {
                _delete?: boolean;
              });
            }}
          />
        ))}
      </div>

      {isEditable && (
        <button
          type="button"
          onClick={onAddOutput}
          className="w-full py-2 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-all flex items-center justify-center gap-1.5"
        >
          <Plus size={14} />
          Tambah output
        </button>
      )}

      {input.output_template.length > 0 &&
        isEditable &&
        input.outputs.length === 0 && (
          <p className="text-xs text-gray-400 text-center">
            💡 Template tersedia — klik "Tambah output" untuk mulai
          </p>
        )}
    </div>
  );
}

// ── Return items section ──────────────────────────────────────────────────────

function ReturnItemsSection({
  gp,
  onResolve,
  canApprove,
}: {
  gp: GoodsProcessingDetail;
  onResolve: (outputId: string, resolution: "STOCK" | "DISCARD") => void;
  canApprove: boolean;
}) {
  const returnItems = gp.inputs.flatMap((inp) =>
    inp.outputs
      .filter((o) => o.flagged_for_return && !o.return_resolved_at)
      .map((o) => ({ ...o, input_product_name: inp.product_name })),
  );

  if (returnItems.length === 0) return null;

  return (
    <div className="rounded-xl border-2 border-orange-200 bg-orange-50/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <RotateCcw size={16} className="text-orange-600" />
        <h3 className="font-semibold text-orange-800 text-sm">
          Menunggu Retur ({returnItems.length})
        </h3>
      </div>
      {returnItems.map((item) => (
        <div
          key={item.id}
          className="bg-white rounded-lg border border-orange-200 p-3 space-y-2"
        >
          <div className="flex justify-between items-start gap-2">
            <div>
              <p className="text-sm font-medium text-gray-800">
                {item.product_name}
              </p>
              {item.return_reason && (
                <p className="text-xs text-gray-500 mt-0.5">
                  "{item.return_reason}"
                </p>
              )}
            </div>
            <div className="text-right text-sm shrink-0">
              <span className="font-mono font-semibold">
                {item.actual_qty ?? item.qty_output}
              </span>
              <span className="text-gray-500 ml-1">{item.uom}</span>
            </div>
          </div>
          {canApprove && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onResolve(item.id, "STOCK")}
                className="flex-1 py-1.5 bg-green-50 border border-green-300 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100 transition-colors"
              >
                ✓ Masukkan Gudang
              </button>
              <button
                type="button"
                onClick={() => onResolve(item.id, "DISCARD")}
                className="flex-1 py-1.5 bg-red-50 border border-red-300 text-red-700 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors"
              >
                🗑 Buang
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Reject modal ──────────────────────────────────────────────────────────────

function RejectModal({
  onConfirm,
  onCancel,
  loading,
}: {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
        <div className="flex items-center gap-2">
          <XCircle size={20} className="text-red-500" />
          <h3 className="font-semibold text-gray-900">Tolak Proses</h3>
        </div>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Alasan penolakan..."
          rows={3}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
          autoFocus
        />
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={() => reason.trim() && onConfirm(reason.trim())}
            disabled={!reason.trim() || loading}
            className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-red-600 transition-colors"
          >
            {loading ? "Menyimpan..." : "Tolak"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add output modal ──────────────────────────────────────────────────────────

function AddOutputModal({
  template,
  onAdd,
  onCancel,
}: {
  template: OutputTemplateRow[];
  onAdd: (output: Omit<LocalOutput, "sort_order">) => void;
  onCancel: () => void;
}) {
  const [productName, setProductName] = useState("");
  const [productId, setProductId] = useState("");
  const [productCode, setProductCode] = useState("");
  const [qty, setQty] = useState("");
  const [uom, setUom] = useState("");

  const handleTemplate = (t: OutputTemplateRow) => {
    setProductId(t.output_product_id);
    setProductName(t.output_product_name);
    setProductCode(t.output_product_code);
    setUom(t.output_uom);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold text-gray-900">Tambah Output</h3>
        {template.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 mb-2">Dari template:</p>
            <div className="space-y-1.5">
              {template.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleTemplate(t)}
                  className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-all ${
                    productId === t.output_product_id
                      ? "border-blue-400 bg-blue-50 text-blue-800"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <span className="font-medium">{t.output_product_name}</span>
                  <span className="text-gray-400 ml-2 text-xs">
                    {t.output_uom}
                  </span>
                  {t.suggested_pct && (
                    <span className="text-xs text-gray-400 ml-1">
                      ({t.suggested_pct}%)
                    </span>
                  )}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2 mb-1">atau isi manual:</p>
          </div>
        )}
        <div className="space-y-2">
          <input
            type="text"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="Nama produk output"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <div className="flex gap-2">
            <input
              type="number"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="Qty"
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <input
              type="text"
              value={uom}
              onChange={(e) => setUom(e.target.value)}
              placeholder="UOM"
              className="w-24 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={() => {
              if (!productId && !productName) return;
              onAdd({
                id: undefined,
                product_id: productId || "custom",
                product_name: productName,
                product_code: productCode,
                qty_output: parseFloat(qty) || 0,
                uom: uom,
                is_waste: false,
                waste_reason: null,
                condition_status: null,
                actual_qty: null,
                actual_uom: null,
                flagged_for_return: false,
                return_reason: null,
              });
            }}
            disabled={!productName || !qty || !uom}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors"
          >
            Tambah
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GoodsProcessingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const hasPermission = usePermissionStore((s) => s.hasPermission);

  const canUpdate = hasPermission("goods_processing", "update");
  const canApprove = hasPermission("goods_processing", "approve");

  const { data: gp, isLoading, error } = useGoodsProcessingDetail(id!);
  const startMut = useStartGoodsProcessing(id!);
  const updateMut = useUpdateGoodsProcessing(id!);
  const confirmMut = useConfirmGoodsProcessing(id!);
  const rejectMut = useRejectGoodsProcessing(id!);
  const resolveMut = useResolveReturn(id!);

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
  const getBaseUomName = (productId: string): string => {
    const uoms = uomConversions?.[productId] ?? []
    return uoms.find(u => u.is_base_unit)?.unit_name ?? ''
  }
  const [localInputs, setLocalInputs] = useState<LocalInput[]>([]);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [addOutputFor, setAddOutputFor] = useState<string | null>(null); // inputId

  // Sync from server data
  useEffect(() => {
    if (gp) setLocalInputs(initLocalInputs(gp));
  }, [gp]);

  const isEditable = useMemo(
    () =>
      canUpdate && (gp?.status === "PROCESSING" || gp?.status === "REJECTED"),
    [canUpdate, gp?.status],
  );

  const allPassThroughConfirmed = useMemo(() => {
    if (!gp) return false;
    return localInputs
      .filter((inp) => !inp.requires_processing)
      .every((inp) => inp.outputs.every((o) => o.condition_status != null));
  }, [gp, localInputs]);

  const allDisassemblyHasOutput = useMemo(() => {
    return localInputs
      .filter((inp) => inp.requires_processing)
      .every((inp) => inp.outputs.length > 0);
  }, [localInputs]);

  const noOutputExceedsInput = useMemo(() => {
    return localInputs
      .filter((inp) => inp.requires_processing)
      .every((inp) => {
        const totalNonWaste = inp.outputs
          .filter((o) => !o.is_waste)
          .reduce((s, o) => s + (o.qty_output || 0), 0);
        return totalNonWaste <= inp.qty_input;
      });
  }, [localInputs]);

  const canFinish =
    allPassThroughConfirmed && allDisassemblyHasOutput && noOutputExceedsInput;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!gp) return;
    try {
      await updateMut.mutateAsync({
        inputs: localInputs.map((inp) => ({
          id: inp.id,
          outputs: inp.outputs
            .filter((o) => !(o as LocalOutput & { _delete?: boolean })._delete)
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
        })),
      });
      addToast("success", "Tersimpan");
    } catch (e) {
      addToast("error", parseApiError(e, "Terjadi kesalahan"));
    }
  }, [gp, localInputs, updateMut, addToast]);

  const handleFinish = useCallback(async () => {
    if (!gp) return;
    try {
      // Save first, then confirm
      await updateMut.mutateAsync({
        inputs: localInputs.map((inp) => ({
          id: inp.id,
          outputs: inp.outputs
            .filter((o) => !(o as LocalOutput & { _delete?: boolean })._delete)
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
        })),
      });
      await confirmMut.mutateAsync();
      addToast("success", "Proses selesai! Stok masuk gudang.");
    } catch (e) {
      addToast("error", parseApiError(e, "Terjadi kesalahan"));
    }
  }, [gp, localInputs, updateMut, confirmMut, addToast]);

  const handleStart = useCallback(async () => {
    try {
      await startMut.mutateAsync();
      addToast("success", "Proses dimulai");
    } catch (e) {
      addToast("error", parseApiError(e, "Terjadi kesalahan"));
    }
  }, [startMut, addToast]);

  const handleReject = useCallback(
    async (reason: string) => {
      try {
        await rejectMut.mutateAsync({ rejection_reason: reason });
        setShowRejectModal(false);
        addToast("info", "Proses ditolak");
      } catch (e) {
        addToast("error", parseApiError(e, "Terjadi kesalahan"));
      }
    },
    [rejectMut, addToast],
  );

  const handleResolveReturn = useCallback(
    async (outputId: string, resolution: "STOCK" | "DISCARD") => {
      try {
        await resolveMut.mutateAsync({ outputId, resolution });
        addToast(
          "success",
          resolution === "STOCK" ? "Barang masuk gudang" : "Barang dibuang",
        );
      } catch (e) {
        addToast("error", parseApiError(e, "Terjadi kesalahan"));
      }
    },
    [resolveMut, addToast],
  );

  const updatePassThroughOutput = useCallback(
    (inputIndex: number, updated: LocalOutput) => {
      setLocalInputs((prev) =>
        prev.map((inp, i) =>
          i !== inputIndex ? inp : { ...inp, outputs: [updated] },
        ),
      );
    },
    [],
  );

  const updateDisassemblyOutput = useCallback(
    (
      inputIndex: number,
      outputIndex: number,
      updated: LocalOutput & { _delete?: boolean },
    ) => {
      setLocalInputs((prev) =>
        prev.map((inp, i) => {
          if (i !== inputIndex) return inp;
          if (updated._delete) {
            return {
              ...inp,
              outputs: inp.outputs.filter((_, oi) => oi !== outputIndex),
            };
          }
          return {
            ...inp,
            outputs: inp.outputs.map((o, oi) =>
              oi === outputIndex ? updated : o,
            ),
          };
        }),
      );
    },
    [],
  );

  const addDisassemblyOutput = useCallback(
    (inputIndex: number, output: Omit<LocalOutput, "sort_order">) => {
      setLocalInputs((prev) =>
        prev.map((inp, i) => {
          if (i !== inputIndex) return inp;
          return {
            ...inp,
            outputs: [
              ...inp.outputs,
              { ...output, sort_order: inp.outputs.length },
            ],
          };
        }),
      );
      setAddOutputFor(null);
    },
    [],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading)
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500">Memuat data...</p>
        </div>
      </div>
    );

  if (error || !gp)
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertTriangle size={40} className="mx-auto text-red-400" />
          <p className="text-gray-600">Gagal memuat data</p>
          <button
            onClick={() => navigate(-1)}
            className="text-blue-600 text-sm"
          >
            ← Kembali
          </button>
        </div>
      </div>
    );

  const status = gp.status;
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
  const isBusy =
    startMut.isPending ||
    updateMut.isPending ||
    confirmMut.isPending ||
    rejectMut.isPending;

  const addOutputInput =
    addOutputFor != null
      ? localInputs.find((inp) => inp.id === addOutputFor)
      : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 -ml-1.5 text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">
              {gp.processing_number}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {gp.supplier_name} · {gp.gr_number}
            </p>
          </div>
          <span
            className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${cfg.color}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        </div>

        {/* Step indicator */}
        <div className="flex px-4 pb-3 gap-2">
          {(["DRAFT", "PROCESSING", "CONFIRMED"] as const).map((step, i) => {
            const isActive =
              status === step ||
              (step === "PROCESSING" &&
                (status === "PROCESSING" || status === "REJECTED")) ||
              (step === "CONFIRMED" && status === "CONFIRMED");
            const isDone =
              (step === "DRAFT" && status !== "DRAFT") ||
              (step === "PROCESSING" && status === "CONFIRMED");
            return (
              <div
                key={step}
                className="flex items-center gap-2 flex-1 min-w-0"
              >
                <div
                  className={`flex items-center gap-1.5 ${i > 0 ? "flex-1" : ""}`}
                >
                  {i > 0 && (
                    <div
                      className={`h-0.5 flex-1 rounded-full transition-colors ${isDone || status === "CONFIRMED" ? "bg-green-400" : "bg-gray-200"}`}
                    />
                  )}
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                      isDone
                        ? "bg-green-500 text-white"
                        : isActive
                          ? "bg-blue-600 text-white"
                          : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    {isDone ? "✓" : i + 1}
                  </div>
                </div>
                <span
                  className={`text-xs hidden sm:block ${isActive ? "text-blue-700 font-medium" : isDone ? "text-green-700" : "text-gray-400"}`}
                >
                  {step === "DRAFT"
                    ? "Draft"
                    : step === "PROCESSING"
                      ? "Pengerjaan"
                      : "Selesai"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Info strip ── */}
      {status === "REJECTED" && gp.rejection_reason && (
        <div className="bg-red-50 border-b border-red-100 px-4 py-2.5 flex items-start gap-2">
          <XCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
          <p className="text-xs text-red-700">
            <span className="font-medium">Alasan ditolak:</span>{" "}
            {gp.rejection_reason}
          </p>
        </div>
      )}

      {status === "PROCESSING" && (
        <div className="bg-blue-50 border-b border-blue-100 px-4 py-2.5 flex items-start gap-2">
          <Info size={14} className="text-blue-500 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-700">
            {gp.processing_type === "PASS_THROUGH"
              ? "Cek kondisi setiap barang, lalu tekan Selesai untuk memasukkan ke gudang."
              : "Isi hasil proses setiap item, lalu tekan Selesai."}
          </p>
        </div>
      )}

      {/* ── Content ── */}
      <div className="px-4 py-4 space-y-3 max-w-lg mx-auto pb-32">
        {/* Info card */}
        <div className="bg-white rounded-xl border border-gray-100 p-3.5 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-gray-400">Gudang</p>
            <p className="font-medium text-gray-800 text-xs mt-0.5">
              {gp.warehouse_name}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Tanggal</p>
            <p className="font-medium text-gray-800 text-xs mt-0.5">
              {new Date(gp.processing_date).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Tipe</p>
            <p className="font-medium text-gray-800 text-xs mt-0.5">
              {gp.processing_type === "PASS_THROUGH" ? "Langsung" : "Proses"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Cabang</p>
            <p className="font-medium text-gray-800 text-xs mt-0.5">
              {gp.branch_name}
            </p>
          </div>
        </div>

        {/* Items */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-0.5">
            {localInputs.length} Item
          </p>
          {localInputs.map((inp, inputIndex) =>
            inp.requires_processing ? (
              <DisassemblyCard
                key={inp.id}
                input={inp}
                isEditable={isEditable}
                onChange={(oi, updated) =>
                  updateDisassemblyOutput(
                    inputIndex,
                    oi,
                    updated as LocalOutput & { _delete?: boolean },
                  )
                }
                onAddOutput={() => setAddOutputFor(inp.id)}
              />
            ) : (
              <PassThroughCard
                key={inp.id}
                input={inp}
                output={inp.outputs[0] ?? { id: '', product_id: '', product_name: '', product_code: '', qty_output: 0, uom: '', is_waste: false, waste_reason: null, condition_status: null, actual_qty: null, actual_uom: null, flagged_for_return: false, return_reason: null, sort_order: 0 }}
                isEditable={isEditable}
                onChange={(updated) => updatePassThroughOutput(inputIndex, updated)}
                baseUomName={getBaseUomName(inp.product_id)}
              />
            ),
          )}
        </div>

        {/* Return items */}
        {(status === "CONFIRMED" || status === "PROCESSING") && (
          <ReturnItemsSection
            gp={gp}
            onResolve={handleResolveReturn}
            canApprove={canApprove}
          />
        )}

        {/* Summary (confirmed) */}
        {status === "CONFIRMED" && gp.total_input_qty != null && (
          <div className="bg-green-50 rounded-xl border border-green-200 p-4 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 size={16} className="text-green-600" />
              <p className="font-semibold text-green-800 text-sm">
                Ringkasan Proses
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-bold text-gray-800">
                  {gp.total_input_qty}
                </p>
                <p className="text-xs text-gray-500">Input</p>
              </div>
              <div>
                <p className="text-lg font-bold text-green-700">
                  {gp.total_output_qty}
                </p>
                <p className="text-xs text-gray-500">Output</p>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-600">
                  {gp.yield_percentage}%
                </p>
                <p className="text-xs text-gray-500">Yield</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom action bar ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 safe-area-pb">
        <div className="max-w-lg mx-auto">
          {status === "DRAFT" && canUpdate && (
            <button
              onClick={handleStart}
              disabled={isBusy}
              className="w-full py-3.5 bg-blue-600 text-white rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-blue-700 active:scale-98 transition-all"
            >
              <Play size={16} />
              {isBusy ? "Memulai..." : "Mulai Proses"}
            </button>
          )}

          {(status === "PROCESSING" || status === "REJECTED") && isEditable && (
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={isBusy}
                className="flex items-center gap-1.5 px-4 py-3.5 border-2 border-gray-200 text-gray-700 rounded-2xl font-medium text-sm disabled:opacity-50 hover:border-gray-300 transition-all shrink-0"
              >
                <Save size={15} />
                Simpan
              </button>
              <button
                onClick={handleFinish}
                disabled={isBusy || !canFinish}
                className="flex-1 py-3.5 bg-green-600 text-white rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-green-700 active:scale-98 transition-all"
              >
                <ClipboardCheck size={16} />
                {isBusy ? "Menyimpan..." : "Selesaikan"}
              </button>
              {canApprove && (
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={isBusy}
                  className="px-3 py-3.5 border-2 border-red-200 text-red-600 rounded-2xl font-medium text-sm disabled:opacity-50 hover:bg-red-50 transition-all shrink-0"
                >
                  <XCircle size={15} />
                </button>
              )}
            </div>
          )}

          {status === "QC_REVIEW" && canApprove && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowRejectModal(true)}
                disabled={isBusy}
                className="flex-1 py-3.5 border-2 border-red-200 text-red-600 rounded-2xl font-semibold text-sm disabled:opacity-50 hover:bg-red-50 transition-all"
              >
                Tolak
              </button>
              <button
                onClick={handleFinish}
                disabled={isBusy}
                className="flex-1 py-3.5 bg-green-600 text-white rounded-2xl font-semibold text-sm disabled:opacity-50 hover:bg-green-700 transition-all"
              >
                Konfirmasi
              </button>
            </div>
          )}

          {status === "CONFIRMED" && (
            <div className="flex items-center justify-center gap-2 py-2">
              <CheckCircle2 size={16} className="text-green-600" />
              <p className="text-sm text-green-700 font-medium">
                Proses selesai · Stok sudah masuk gudang
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {showRejectModal && (
        <RejectModal
          onConfirm={handleReject}
          onCancel={() => setShowRejectModal(false)}
          loading={rejectMut.isPending}
        />
      )}

      {addOutputFor != null && addOutputInput && (
        <AddOutputModal
          template={addOutputInput.output_template}
          onAdd={(output) =>
            addDisassemblyOutput(
              localInputs.findIndex((inp) => inp.id === addOutputFor),
              output,
            )
          }
          onCancel={() => setAddOutputFor(null)}
        />
      )}
    </div>
  );
}