import { useMemo, useRef, useEffect, useState } from 'react'
import { Trash2, AlertTriangle, Scale, Package, XCircle, TruckIcon } from 'lucide-react'
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
  { value: 'DAMAGED',    label: 'Rusak / Cacat' },
  { value: 'EXPIRED',    label: 'Kadaluarsa' },
  { value: 'WRONG_ITEM', label: 'Salah Barang' },
  { value: 'OTHER',      label: 'Lainnya' },
]

export function GRLineCard({ line, onChange, onRemove }: GRLineCardProps) {
  const { data: productUoms } = useProductUoms(line.product_id)

  // qty_not_delivered = local state, tidak disimpan ke DB
  const [qtyNotDelivered, setQtyNotDelivered] = useState<number>(
    () => Math.max(0, line.qty_remaining - line.qty_po_uom)
  )

  const prevRemainingRef = useRef(line.qty_remaining)
  useEffect(() => {
    if (prevRemainingRef.current !== line.qty_remaining) {
      prevRemainingRef.current = line.qty_remaining
      setQtyNotDelivered(Math.max(0, line.qty_remaining - line.qty_po_uom))
    }
  }, [line.qty_remaining, line.qty_po_uom])

  const qtyDatang    = Math.max(0, line.qty_remaining - qtyNotDelivered)
  const qtyDiterima  = Math.max(0, qtyDatang - line.qty_rejected)
  const sisaSetelahGR = Math.max(0, line.qty_remaining - qtyDiterima)
  const isPOLunas    = sisaSetelahGR === 0 && line.qty_remaining > 0

  // ── UOM / timbang ──
  const needsConversion = line.uom_po !== line.uom_received
  const hasMultipleUoms = (productUoms?.length ?? 0) > 1
  const showWeighingInput = hasMultipleUoms || needsConversion || line.requires_processing



  const estimatedCF = useMemo(() => {
    if (!productUoms || !needsConversion) return null
    const poUom  = productUoms.find(u => u.metric_units?.unit_name === line.uom_po)
    const recUom = productUoms.find(u => u.metric_units?.unit_name === line.uom_received)
    if (!poUom || !recUom || recUom.conversion_factor === 0) return null
    return poUom.conversion_factor / recUom.conversion_factor
  }, [productUoms, needsConversion, line.uom_po, line.uom_received])

  const deviation = useMemo(() => {
    if (!estimatedCF || !line.conversion_factor || line.conversion_factor === 0) return null
    return Math.abs(line.conversion_factor - estimatedCF) / estimatedCF * 100
  }, [estimatedCF, line.conversion_factor])

  /** Default stock UOM (e.g. Gram) when PO UOM differs — for warehouse entry without decimals. */
  const autoDetectedUom = useMemo(() => {
    if (!productUoms || productUoms.length <= 1) return null
    const poUom = productUoms.find((u) => u.metric_units?.unit_name === line.uom_po)
    const stockUom = productUoms.find((u) => u.is_default_stock_unit || u.is_base_unit)
    if (!poUom || !stockUom) return null
    if (poUom.metric_unit_id === stockUom.metric_unit_id) return null
    const stockName = stockUom.metric_units?.unit_name
    if (!stockName || stockName === line.uom_po) return null
    return stockName
  }, [productUoms, line.uom_po])

  const hasAutoSwitched = useRef(false)
  useEffect(() => {
    if (hasAutoSwitched.current || !autoDetectedUom) return
    if (line.uom_received === line.uom_po && autoDetectedUom !== line.uom_po) {
      hasAutoSwitched.current = true
      const poUomData = productUoms?.find((u) => u.metric_units?.unit_name === line.uom_po)
      const recUomData = productUoms?.find((u) => u.metric_units?.unit_name === autoDetectedUom)
      if (poUomData && recUomData && recUomData.conversion_factor > 0) {
        const estCF = poUomData.conversion_factor / recUomData.conversion_factor
        onChange(line.key, {
          uom_received: autoDetectedUom,
          qty_received: qtyDiterima * estCF,
          conversion_factor: estCF,
        })
      } else {
        onChange(line.key, { uom_received: autoDetectedUom })
      }
    }
  }, [autoDetectedUom, line.uom_received, line.uom_po, qtyDiterima, line.key, onChange, productUoms])

  // ── Handlers ──
  const handleNotDeliveredChange = (val: number) => {
    const notDel = Math.min(Math.max(0, val), line.qty_remaining)
    setQtyNotDelivered(notDel)
    const newQtyDatang = Math.max(0, line.qty_remaining - notDel)
    const newDiterima = Math.max(0, newQtyDatang - line.qty_rejected)

    if (needsConversion) {
      const cf = estimatedCF || 1
      onChange(line.key, {
        qty_po_uom: newQtyDatang,
        qty_received: newDiterima * cf,
        conversion_factor: cf,
      })
    } else {
      onChange(line.key, { qty_po_uom: newQtyDatang, qty_received: newDiterima })
    }
  }

  const handleRejectedChange = (val: number) => {
    const rejected = Math.min(Math.max(0, val), qtyDatang)
    const newDiterima = Math.max(0, qtyDatang - rejected)

    if (needsConversion) {
      const cf = estimatedCF || 1
      onChange(line.key, {
        qty_rejected: rejected,
        reject_reason: rejected === 0 ? '' : line.reject_reason,
        qty_received: newDiterima * cf,
        conversion_factor: cf,
      })
    } else {
      onChange(line.key, {
        qty_rejected: rejected,
        reject_reason: rejected === 0 ? '' : line.reject_reason,
        qty_received: newDiterima,
      })
    }
  }

  const handleQtyReceivedChange = (val: number) => {
    const cf = qtyDiterima > 0 ? val / qtyDiterima : 1
    onChange(line.key, { qty_received: val, conversion_factor: cf })
  }



  const isOverQty            = qtyNotDelivered > line.qty_remaining
  const isRejectedOverDatang = line.qty_rejected > qtyDatang

  return (
    <div className="p-5 sm:p-6 space-y-5 border-b border-gray-100 dark:border-gray-700/50 last:border-b-0">

      {/* ── Header ── */}
      <div className="flex justify-between items-start gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="p-2 bg-teal-50 dark:bg-teal-900/20 rounded-lg shrink-0 mt-0.5">
            <Package className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-gray-900 dark:text-white text-lg leading-tight truncate">
              {line.product_name}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Total PO: <span className="font-bold text-gray-800 dark:text-gray-200">{fmt(line.qty_ordered)} {line.uom_po}</span>
              </span>
              <span className="text-gray-300 dark:text-gray-600">•</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Sisa PO: <span className="font-bold text-amber-600 dark:text-amber-500">{fmt(line.qty_remaining)} {line.uom_po}</span>
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

      {/* ── Inputs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 gap-4">

        {/* Tidak Terkirim */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
            <TruckIcon className="w-4 h-4 text-gray-400" />
            Barang Tidak Terkirim
            <span className="font-normal text-gray-400">({line.uom_po})</span>
          </label>
          <input
            type="number" min="0" step="any"
            value={qtyNotDelivered || ''}
            placeholder="0"
            onChange={e => handleNotDeliveredChange(parseFloat(e.target.value) || 0)}
            className={`w-full px-4 py-3 border-2 rounded-xl text-xl font-mono font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all
              ${isOverQty
                ? 'border-red-400 bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-300'
                : qtyNotDelivered > 0
                  ? 'border-amber-400 bg-amber-50/60 dark:bg-amber-900/15 text-amber-800 dark:text-amber-200'
                  : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
              }`}
          />
          {isOverQty && (
            <p className="flex items-center gap-1.5 text-sm text-red-500 font-medium">
              <AlertTriangle className="w-4 h-4" /> Melebihi sisa PO ({fmt(line.qty_remaining)} {line.uom_po})
            </p>
          )}
        </div>

        {/* Ditolak */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
            <XCircle className="w-4 h-4 text-red-400" />
            Barang DI TOLAK
            <span className="font-normal text-gray-400">({line.uom_po})</span>
          </label>
          <input
            type="number" min="0" step="any"
            value={line.qty_rejected || ''}
            placeholder="0"
            onChange={e => handleRejectedChange(parseFloat(e.target.value) || 0)}
            className={`w-full px-4 py-3 border-2 rounded-xl text-xl font-mono font-bold focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all
              ${isRejectedOverDatang
                ? 'border-red-400 bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-300'
                : line.qty_rejected > 0
                  ? 'border-red-300 dark:border-red-700 bg-red-50/60 dark:bg-red-900/15 text-red-800 dark:text-red-200'
                  : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
              }`}
          />
          {isRejectedOverDatang && (
            <p className="flex items-center gap-1.5 text-sm text-red-500 font-medium">
              <AlertTriangle className="w-4 h-4" /> Melebihi barang datang ({fmt(qtyDatang)} {line.uom_po})
            </p>
          )}
          {line.qty_rejected > 0 && (
            <select
              value={line.reject_reason}
              onChange={e => onChange(line.key, { reject_reason: e.target.value })}
              className="w-full px-3 py-3 border-2 border-red-200 dark:border-red-800 rounded-xl text-base focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-300 appearance-none font-semibold"
            >
              <option value="">Pilih alasan penolakan...</option>
              {REJECT_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* ── Summary auto-calculated ── */}
      <div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Datang */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-400 shrink-0" />
            <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Jumlah Barang Datang</span>
            <span className="text-xs text-gray-400 hidden sm:inline">
              ({fmt(line.qty_remaining)} − {fmt(qtyNotDelivered)})
            </span>
          </div>
          <span className="text-lg font-mono font-bold text-gray-800 dark:text-gray-200">
            {fmt(qtyDatang)} <span className="text-sm font-normal text-gray-500">{line.uom_po}</span>
          </span>
        </div>

        {/* Ditolak row — hanya kalau ada */}
        {line.qty_rejected > 0 && (
          <div className="flex items-center justify-between px-4 py-3 bg-red-50/50 dark:bg-red-900/10 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400 shrink-0" />
              <span className="text-sm font-semibold text-red-600 dark:text-red-400">Jumlah Barang Ditolak</span>
              {line.reject_reason && (
                <span className="text-xs text-red-400 italic hidden sm:inline">
                  · {REJECT_REASONS.find(r => r.value === line.reject_reason)?.label}
                </span>
              )}
            </div>
            <span className="text-lg font-mono font-bold text-red-600 dark:text-red-400">
              −{fmt(line.qty_rejected)} <span className="text-sm font-normal">{line.uom_po}</span>
            </span>
          </div>
        )}

        {/* Diterima — paling penting, paling besar */}
        <div className="flex items-center justify-between px-4 py-4 bg-teal-50/70 dark:bg-teal-900/20">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-teal-500 shrink-0" />
            <span className="text-base font-bold text-teal-700 dark:text-teal-400">Diterima (Masuk Stok)</span>
          </div>
          <span className="text-2xl font-mono font-extrabold text-teal-800 dark:text-teal-300">
            {fmt(qtyDiterima)} <span className="text-base font-semibold">{line.uom_po}</span>
          </span>
        </div>
      </div>

      {/* ── Qty masuk gudang — satuan default stock (read-only), angka bulat ── */}
      {showWeighingInput && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
            <Scale className="w-4 h-4 text-teal-500" />
            Qty Masuk Gudang
            <span className="font-normal text-gray-400">
              — untuk {fmt(qtyDiterima)} {line.uom_po} yang diterima
            </span>
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1">
            Satuan gudang dari master produk (mis. Gram, angka bulat). Harga tagihan supplier (mis. per KG) di modul Purchase Invoice.
          </p>
          <div className="flex gap-2">
            <input
              type="number" min="0" step="any"
              value={line.qty_received || ''}
              placeholder="0"
              onChange={e => handleQtyReceivedChange(parseFloat(e.target.value) || 0)}
              className="flex-1 px-4 py-3 border-2 border-teal-300 dark:border-teal-700 rounded-xl text-xl font-mono font-bold focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            <div
              className="flex items-center justify-center min-w-22 px-3 py-3 bg-gray-100 dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-xl text-base font-bold text-gray-700 dark:text-gray-300 cursor-default select-none"
              title="Satuan dari master produk — tidak dapat diubah saat penerimaan"
            >
              {line.uom_received}
            </div>
          </div>
          {qtyDiterima > 0 && line.conversion_factor > 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 ml-1">
              1 {line.uom_po} ={' '}
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                {line.conversion_factor.toFixed(2)} {line.uom_received}
              </span>
              {deviation !== null && deviation > 10 && (
                <span className="inline-flex items-center gap-1 ml-2 text-amber-600 dark:text-amber-400 font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5" /> {deviation.toFixed(0)}% dari estimasi
                </span>
              )}
            </p>
          )}
        </div>
      )}

      {/* ── Sisa PO setelah GR ini ── */}
      <div className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 ${
        isPOLunas
          ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
          : sisaSetelahGR < line.qty_remaining
            ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700'
            : 'bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700'
      }`}>
        <span className={`text-sm font-semibold ${
          isPOLunas
            ? 'text-green-700 dark:text-green-400'
            : sisaSetelahGR < line.qty_remaining
              ? 'text-orange-700 dark:text-orange-400'
              : 'text-gray-600 dark:text-gray-400'
        }`}>
          Sisa yang Belum Diterima :          
        </span>
        <span className={`text-xl font-mono font-extrabold ${
          isPOLunas
            ? 'text-green-800 dark:text-green-300'
            : sisaSetelahGR < line.qty_remaining
              ? 'text-orange-800 dark:text-orange-300'
              : 'text-gray-800 dark:text-gray-200'
        }`}>
          {isPOLunas ? '✓ PO Lunas' : `${fmt(sisaSetelahGR)} ${line.uom_po}`}
        </span>
      </div>

    </div>
  )
}