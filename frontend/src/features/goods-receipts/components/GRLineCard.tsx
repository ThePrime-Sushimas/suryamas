import { useMemo, useRef, useEffect } from 'react'
import { Trash2, AlertTriangle, Scale, Package, XCircle } from 'lucide-react'
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
  { value: 'DAMAGED', label: 'Rusak / Cacat' },
  { value: 'EXPIRED', label: 'Kadaluarsa' },
  { value: 'WRONG_ITEM', label: 'Salah Barang' },
  { value: 'OTHER', label: 'Lainnya' },
]

export function GRLineCard({ line, onChange, onRemove }: GRLineCardProps) {
  const { data: productUoms } = useProductUoms(line.product_id)

  const needsConversion = line.uom_po !== line.uom_received

  const autoDetectedUom = useMemo(() => {
    if (!line.requires_processing) return null
    if (!productUoms || productUoms.length <= 1) return null
    const poUom = productUoms.find(u => u.metric_units?.unit_name === line.uom_po)
    const stockUom = productUoms.find(u => u.is_default_stock_unit || u.is_base_unit)
    if (!poUom || !stockUom) return null
    if (poUom.metric_unit_id === stockUom.metric_unit_id) return null
    return stockUom.metric_units?.unit_name ?? null
  }, [productUoms, line.uom_po, line.requires_processing])

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

  const receivedUomOptions = useMemo(() => {
    if (!productUoms) return []
    return productUoms
      .filter(u => u.status_uom === 'ACTIVE' && !u.is_deleted)
      .map(u => ({ value: u.metric_units?.unit_name ?? '', label: u.metric_units?.unit_name ?? '', cf: u.conversion_factor }))
      .filter(u => u.value)
  }, [productUoms])

  const estimatedCF = useMemo(() => {
    if (!productUoms || !needsConversion) return null
    const poUom = productUoms.find(u => u.metric_units?.unit_name === line.uom_po)
    const recUom = productUoms.find(u => u.metric_units?.unit_name === line.uom_received)
    if (!poUom || !recUom || recUom.conversion_factor === 0) return null
    return poUom.conversion_factor / recUom.conversion_factor
  }, [productUoms, needsConversion, line.uom_po, line.uom_received])

  const deviation = useMemo(() => {
    if (!estimatedCF || !line.conversion_factor || line.conversion_factor === 0) return null
    return Math.abs(line.conversion_factor - estimatedCF) / estimatedCF * 100
  }, [estimatedCF, line.conversion_factor])

  const estimasiBerat = useMemo(() => {
    if (!productUoms || productUoms.length === 0) return null
    const baseUom = productUoms.find(u => u.is_base_unit) ?? productUoms.find(u => u.is_default_stock_unit)
    if (!baseUom?.metric_units?.unit_name) return null

    const receivedUomEntry = productUoms.find(u => u.metric_units?.unit_name === line.uom_received)
    const baseUomEntry = baseUom

    if (!receivedUomEntry || !baseUomEntry || baseUomEntry.conversion_factor === 0) return null

    const qtyBase = (line.qty_received || 0) * (receivedUomEntry.conversion_factor / baseUomEntry.conversion_factor)
    return { qty: Math.round(qtyBase), uom: baseUom.metric_units.unit_name }
  }, [productUoms, line.qty_received, line.uom_received])

  const handleQtyPoUomChange = (val: number) => {
    const updates: Partial<GRLineData> = { qty_po_uom: val }
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
    <div className="p-5 sm:p-6 space-y-4 border-b border-gray-100 dark:border-gray-700/50 last:border-b-0 hover:bg-gray-50/30 dark:hover:bg-gray-800/30 transition-colors">
      {/* Header: product name + remove */}
      <div className="flex justify-between items-start gap-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="p-2 bg-teal-50 dark:bg-teal-900/20 rounded-lg shrink-0 mt-0.5">
            <Package className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 dark:text-white text-base truncate">{line.product_name}</p>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{line.product_code}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">•</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Pesanan: <span className="font-medium text-gray-700 dark:text-gray-300">{fmt(line.qty_ordered)} {line.uom_po}</span>
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">•</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Sisa: <span className="font-medium text-teal-600 dark:text-teal-400">{fmt(line.qty_remaining)} {line.uom_po}</span>
              </span>
            </div>
          </div>
        </div>
        <button 
          onClick={() => onRemove(line.key)} 
          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all shrink-0" 
          title="Hapus item"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Main inputs */}
      <div className={`grid gap-4 mt-2 ${needsConversion ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3'}`}>
        {/* Qty diterima (satuan PO) */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 ml-1">
            Diterima ({line.uom_po})
          </label>
          <div className="relative">
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
              className={`w-full px-4 py-2.5 border rounded-xl text-sm font-mono focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all shadow-sm ${isOverQty ? 'border-red-400 bg-red-50 dark:bg-red-900/10 focus:border-red-500 focus:ring-red-500/20' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
            />
          </div>
          {isOverQty && (
            <p className="flex items-center gap-1 text-xs text-red-500 font-medium mt-1.5 ml-1">
              <AlertTriangle className="w-3 h-3" /> Melebihi sisa PO
            </p>
          )}
        </div>

        {/* Hasil timbang (satuan operasional) — only if dual UOM */}
        {needsConversion && (
          <div>
            <label className="flex text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 ml-1 items-center gap-1.5">
              <Scale className="w-3.5 h-3.5" /> Hasil Timbang
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="number" min="0" step="any"
                value={line.qty_received || ''}
                onChange={e => handleQtyReceivedChange(parseFloat(e.target.value) || 0)}
                className="w-full sm:flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-mono focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              {receivedUomOptions.length > 1 ? (
                <select
                  value={line.uom_received}
                  onChange={e => handleUomReceivedChange(e.target.value)}
                  className="w-full sm:w-28 px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all shadow-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white appearance-none"
                >
                  {receivedUomOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <div className="flex items-center justify-center px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 sm:w-28 shadow-sm">
                  {line.uom_received}
                </div>
              )}
            </div>
            {/* Conversion info */}
            {line.qty_po_uom > 0 && line.conversion_factor > 0 && (
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 ml-1">
                1 {line.uom_po} = {line.conversion_factor.toFixed(2)} {line.uom_received}
                {deviation !== null && deviation > 10 && (
                  <span className="inline-flex items-center gap-1 ml-2 text-amber-600 dark:text-amber-400 font-medium">
                    <AlertTriangle className="w-3 h-3" /> {deviation.toFixed(0)}% dari estimasi
                  </span>
                )}
              </p>
            )}
          </div>
        )}

        {/* Qty ditolak */}
        <div className="flex flex-col">
          <label className="flex text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 ml-1 items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5" /> Ditolak ({line.uom_po})
          </label>
          <div className="flex flex-col gap-2 h-full">
            <input
              type="number" min="0" step="any"
              value={line.qty_rejected || ''}
              onChange={e => {
                const val = parseFloat(e.target.value) || 0
                onChange(line.key, { qty_rejected: val, reject_reason: val === 0 ? '' : line.reject_reason })
              }}
              className={`w-full px-4 py-2.5 border rounded-xl text-sm font-mono focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all shadow-sm ${line.qty_rejected > 0 ? 'border-red-300 dark:border-red-600 bg-red-50/50 dark:bg-red-900/10' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'} text-gray-900 dark:text-white`}
              placeholder="0"
            />
            {line.qty_rejected > 0 && (
              <select
                value={line.reject_reason}
                onChange={e => onChange(line.key, { reject_reason: e.target.value })}
                className="w-full px-3 py-2 border border-red-200 dark:border-red-800 rounded-xl text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all shadow-sm bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-300 appearance-none font-medium"
              >
                <option value="">Alasan penolakan...</option>
                {REJECT_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Estimasi berat — read-only */}
      <div className="pt-3 mt-4">
        <div className="inline-flex items-center gap-3 bg-gray-50/80 dark:bg-gray-800/80 px-4 py-2.5 rounded-xl border border-gray-200/60 dark:border-gray-700/60">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Estimasi Berat Sistem:
          </span>
          <span className="text-sm font-mono font-bold text-gray-800 dark:text-gray-200 select-none">
            {estimasiBerat
              ? `${fmt(estimasiBerat.qty)} ${estimasiBerat.uom}`
              : <span className="text-gray-400 dark:text-gray-500 font-normal">—</span>
            }
          </span>
        </div>
      </div>
    </div>
  )
}