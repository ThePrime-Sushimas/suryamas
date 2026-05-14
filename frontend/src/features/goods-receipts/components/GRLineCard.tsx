import { useMemo, useRef, useEffect } from 'react'
import { Trash2, AlertTriangle, Scale } from 'lucide-react'
import { useProductUoms } from '@/features/product-uoms/api/productUoms.api'

export interface GRLineData {
  key: string
  po_line_id: string
  product_id: string
  product_name: string
  product_code: string
  uom_po: string
  qty_ordered: number
  qty_remaining: number
  qty_po_uom: number
  qty_received: number
  uom_received: string
  conversion_factor: number
  qty_rejected: number
  reject_reason: string
  unit_price_invoice: number
  unit_price_po: number
  requires_processing: boolean
}

interface GRLineCardProps {
  line: GRLineData
  onChange: (key: string, updates: Partial<GRLineData>) => void
  onRemove: (key: string) => void
}

const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n)

const REJECT_REASONS = [
  { value: 'DAMAGED', label: 'Rusak' },
  { value: 'EXPIRED', label: 'Kadaluarsa' },
  { value: 'WRONG_ITEM', label: 'Salah Barang' },
  { value: 'OTHER', label: 'Lainnya' },
]

export function GRLineCard({ line, onChange, onRemove }: GRLineCardProps) {
  const { data: productUoms } = useProductUoms(line.product_id)

  // Determine if dual UOM is needed — simply compare PO UOM vs received UOM
  const needsConversion = line.uom_po !== line.uom_received

  // Auto-detect: only for products that require processing (salmon, ayam)
  const autoDetectedUom = useMemo(() => {
    if (!line.requires_processing) return null
    if (!productUoms || productUoms.length <= 1) return null
    const poUom = productUoms.find(u => u.metric_units?.unit_name === line.uom_po)
    const stockUom = productUoms.find(u => u.is_default_stock_unit || u.is_base_unit)
    if (!poUom || !stockUom) return null
    if (poUom.metric_unit_id === stockUom.metric_unit_id) return null
    return stockUom.metric_units?.unit_name ?? null
  }, [productUoms, line.uom_po, line.requires_processing])

  // Effect: auto-switch uom_received to stock unit on first load
  const hasAutoSwitched = useRef(false)
  useEffect(() => {
    if (hasAutoSwitched.current || !autoDetectedUom) return
    if (line.uom_received === line.uom_po && autoDetectedUom !== line.uom_po) {
      hasAutoSwitched.current = true
      const poUomData = productUoms?.find(u => u.metric_units?.unit_name === line.uom_po)
      const recUomData = productUoms?.find(u => u.metric_units?.unit_name === autoDetectedUom)
      if (poUomData && recUomData && recUomData.conversion_factor > 0) {
        const estCF = poUomData.conversion_factor / recUomData.conversion_factor
        const suggestedReceived = line.qty_po_uom * estCF
        // Price stays in uom_po — no conversion needed
        onChange(line.key, {
          uom_received: autoDetectedUom,
          qty_received: suggestedReceived,
          conversion_factor: estCF,
        })
      } else {
        onChange(line.key, { uom_received: autoDetectedUom })
      }
    }
  }, [autoDetectedUom, line.uom_received, line.uom_po, line.qty_po_uom, line.key, onChange, productUoms])

  // Available UOMs for received dropdown (exclude PO UOM if different)
  const receivedUomOptions = useMemo(() => {
    if (!productUoms) return []
    return productUoms
      .filter(u => u.status_uom === 'ACTIVE' && !u.is_deleted)
      .map(u => ({ value: u.metric_units?.unit_name ?? '', label: u.metric_units?.unit_name ?? '', cf: u.conversion_factor }))
      .filter(u => u.value)
  }, [productUoms])

  // Estimated conversion factor from product_uoms
  const estimatedCF = useMemo(() => {
    if (!productUoms || !needsConversion) return null
    const poUom = productUoms.find(u => u.metric_units?.unit_name === line.uom_po)
    const recUom = productUoms.find(u => u.metric_units?.unit_name === line.uom_received)
    if (!poUom || !recUom || recUom.conversion_factor === 0) return null
    return poUom.conversion_factor / recUom.conversion_factor
  }, [productUoms, needsConversion, line.uom_po, line.uom_received])

  // Deviation warning
  const deviation = useMemo(() => {
    if (!estimatedCF || !line.conversion_factor || line.conversion_factor === 0) return null
    return Math.abs(line.conversion_factor - estimatedCF) / estimatedCF * 100
  }, [estimatedCF, line.conversion_factor])

  const handleQtyPoUomChange = (val: number) => {
    const updates: Partial<GRLineData> = { qty_po_uom: val }
    // Only auto-suggest qty_received if it hasn't been manually set (still at default)
    const isDefaultReceived = line.conversion_factor === 1 && line.qty_received === line.qty_po_uom
    if (isDefaultReceived && estimatedCF) {
      const suggested = val * estimatedCF
      updates.qty_received = suggested
      updates.conversion_factor = estimatedCF
    } else {
      updates.conversion_factor = val > 0 ? line.qty_received / val : 1
    }
    onChange(line.key, updates)
  }

  const handleQtyReceivedChange = (val: number) => {
    const cf = line.qty_po_uom > 0 ? val / line.qty_po_uom : 1
    onChange(line.key, { qty_received: val, conversion_factor: cf })
  }

  const handleUomReceivedChange = (uom: string) => {
    // Recalculate estimated CF for new UOM
    if (!productUoms) { onChange(line.key, { uom_received: uom }); return }
    const poUomData = productUoms.find(u => u.metric_units?.unit_name === line.uom_po)
    const recUomData = productUoms.find(u => u.metric_units?.unit_name === uom)
    if (poUomData && recUomData && recUomData.conversion_factor > 0) {
      const newEstCF = poUomData.conversion_factor / recUomData.conversion_factor
      const newReceived = line.qty_po_uom * newEstCF
      onChange(line.key, { uom_received: uom, qty_received: newReceived, conversion_factor: newEstCF })
    } else {
      onChange(line.key, { uom_received: uom })
    }
  }

  const isOverQty = line.qty_po_uom > line.qty_remaining

  return (
    <div className="p-4 space-y-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
      {/* Header: product name + remove */}
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{line.product_name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{line.product_code} · PO: {fmt(line.qty_ordered)} {line.uom_po} · Sisa: <span className="font-semibold text-gray-700 dark:text-gray-200">{fmt(line.qty_remaining)} {line.uom_po}</span></p>
        </div>
        <button onClick={() => onRemove(line.key)} className="p-1.5 text-gray-400 hover:text-red-500 rounded shrink-0" title="Hapus item">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Main inputs */}
      <div className={`grid gap-3 ${needsConversion ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3'}`}>
        {/* Qty diterima (satuan PO) */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Diterima ({line.uom_po})
          </label>
          <input
            type="number" min="0" step="any"
            value={line.qty_po_uom || ''}
            onChange={e => {
              const val = parseFloat(e.target.value) || 0
              if (needsConversion) {
                handleQtyPoUomChange(val)
              } else {
                onChange(line.key, { qty_po_uom: val, qty_received: val, conversion_factor: 1 })
              }
            }}
            className={`w-full px-2.5 py-2 border rounded-lg text-sm text-right font-mono ${isOverQty ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
          />
          {isOverQty && <p className="text-xs text-red-500 mt-0.5">Melebihi sisa PO</p>}
        </div>

        {/* Hasil timbang (satuan operasional) — only if dual UOM */}
        {needsConversion && (
          <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
              <Scale className="w-3 h-3" /> Hasil Timbang
            </label>
            <div className="flex gap-1">
              <input
                type="number" min="0" step="any"
                value={line.qty_received || ''}
                onChange={e => handleQtyReceivedChange(parseFloat(e.target.value) || 0)}
                className="flex-1 min-w-0 px-2.5 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-right font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              {receivedUomOptions.length > 1 ? (
                <select
                  value={line.uom_received}
                  onChange={e => handleUomReceivedChange(e.target.value)}
                  className="w-20 px-1 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {receivedUomOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <span className="flex items-center px-2 text-xs text-gray-500 dark:text-gray-400">{line.uom_received}</span>
              )}
            </div>
            {/* Conversion info */}
            {line.qty_po_uom > 0 && line.conversion_factor > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                1 {line.uom_po} = {line.conversion_factor.toFixed(2)} {line.uom_received}
                {deviation !== null && deviation > 10 && (
                  <span className="inline-flex items-center gap-0.5 ml-1 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="w-3 h-3" /> {deviation.toFixed(0)}% dari estimasi
                  </span>
                )}
              </p>
            )}
          </div>
        )}

        {/* Qty ditolak */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Ditolak ({line.uom_po})</label>
          <input
            type="number" min="0" step="any"
            value={line.qty_rejected || ''}
            onChange={e => {
              const val = parseFloat(e.target.value) || 0
              onChange(line.key, { qty_rejected: val, reject_reason: val === 0 ? '' : line.reject_reason })
            }}
            className={`w-full px-2.5 py-2 border rounded-lg text-sm text-right font-mono ${line.qty_rejected > 0 ? 'border-red-400 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
          />
        </div>
      </div>

      {/* Reject reason */}
      {line.qty_rejected > 0 && (
        <select
          value={line.reject_reason}
          onChange={e => onChange(line.key, { reject_reason: e.target.value })}
          className="w-full sm:w-48 px-2.5 py-2 border border-red-300 dark:border-red-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="">Pilih alasan penolakan...</option>
          {REJECT_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      )}

      {/* Harga invoice — selalu dalam satuan beli (uom_po) */}
      <div className="flex items-center gap-3 pt-1 border-t border-gray-50 dark:border-gray-700/50">
        <div className="flex-1 sm:max-w-xs">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Harga Invoice (/{line.uom_po})
          </label>
          <input
            type="number" min="0" step="any"
            value={line.unit_price_invoice || ''}
            onChange={e => onChange(line.key, { unit_price_invoice: parseFloat(e.target.value) || 0 })}
            className="w-full px-2.5 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-right font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <div className="text-right pt-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white font-mono">
            Rp {fmt(Math.round((line.qty_po_uom - line.qty_rejected) * line.unit_price_invoice))}
          </p>
        </div>
      </div>
    </div>
  )
}
