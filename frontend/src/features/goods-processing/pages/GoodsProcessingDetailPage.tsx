import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Package, Play, Send, CheckCircle2, XCircle, Plus, Trash2, Save } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { ProductPickerModal } from '@/components/shared/ProductPickerModal'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'
import {
  useGoodsProcessingDetail,
  useStartProcessing,
  useUpdateProcessing,
  useSubmitQc,
  useConfirmProcessing,
  useRejectProcessing,
  useStartLine,
  useSubmitLineQc,
  useConfirmLine,
} from '../api/goodsProcessing.api'
import type { GoodsProcessingInput } from '../api/goodsProcessing.api'

const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n)
const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Menunggu', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  PROCESSING: { label: 'Diproses', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  QC_REVIEW: { label: 'Menunggu QC', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  CONFIRMED: { label: 'Selesai', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  REJECTED: { label: 'Ditolak', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
}

interface EditableOutput {
  key: string
  id?: string
  product_id: string
  product_name: string
  qty_output: number
  uom: string
  is_waste: boolean
  waste_reason: string
  photo_urls: string[]
}

export default function GoodsProcessingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const hasPermission = usePermissionStore(state => state.hasPermission)
  const canUpdate = hasPermission('goods_processing', 'update')
  const canApprove = hasPermission('goods_processing', 'approve')

  const { data: gp, isLoading } = useGoodsProcessingDetail(id ?? '')
  const startMutation = useStartProcessing()
  const updateMutation = useUpdateProcessing()
  const submitQcMutation = useSubmitQc()
  const confirmMutation = useConfirmProcessing()
  const rejectMutation = useRejectProcessing()
  const startLineMutation = useStartLine()
  const submitLineQcMutation = useSubmitLineQc()
  const confirmLineMutation = useConfirmLine()

  const [confirmAction, setConfirmAction] = useState<'start' | 'submit_qc' | 'confirm' | null>(null)
  const [showReject, setShowReject] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  // Editable outputs state per input
  const [editOutputs, setEditOutputs] = useState<Record<string, EditableOutput[]>>({})
  const [dirty, setDirty] = useState(false)

  // Fetch UOM conversions for products in this GP
  const gpProductIds = useMemo(() => {
    if (!gp?.inputs) return []
    return gp.inputs.map(inp => inp.product_id)
  }, [gp?.inputs])

  const { data: uomData } = useQuery({
    queryKey: ['product-uoms', 'gp-conversions', gpProductIds],
    queryFn: async () => {
      if (gpProductIds.length === 0) return {}
      const { data } = await api.post('/product-uoms/conversions-batch', { product_ids: gpProductIds })
      return data.data as Record<string, Array<{ unit_name: string; conversion_factor: number; is_base_unit: boolean }>>
    },
    enabled: gpProductIds.length > 0,
    staleTime: 60_000,
  })

  // Product picker state
  const [showProductPicker, setShowProductPicker] = useState(false)

  const [pickerInputId, setPickerInputId] = useState<string | null>(null)
  const [pickerOutputKey, setPickerOutputKey] = useState<string | null>(null)

  // Initialize editable outputs from server data
  const initOutputs = useCallback((inputs: GoodsProcessingInput[]) => {
    const map: Record<string, EditableOutput[]> = {}
    for (const inp of inputs) {
      map[inp.id] = inp.outputs.map(o => ({
        key: o.id || crypto.randomUUID(),
        id: o.id,
        product_id: o.product_id,
        product_name: o.product_name,
        qty_output: o.qty_output,
        uom: o.uom,
        is_waste: o.is_waste,
        waste_reason: o.waste_reason ?? '',
        photo_urls: o.photo_urls ?? [],
      }))
    }
    setEditOutputs(map)
    setDirty(false)
  }, [])

  useEffect(() => {
    if (gp?.inputs) initOutputs(gp.inputs)
  }, [gp?.inputs, initOutputs])

  const addOutput = (inputId: string, inp: GoodsProcessingInput) => {
    setEditOutputs(prev => ({
      ...prev,
      [inputId]: [...(prev[inputId] ?? []), {
        key: crypto.randomUUID(),
        product_id: inp.product_id,
        product_name: inp.product_name,
        qty_output: 0,
        uom: inp.uom,
        is_waste: false,
        waste_reason: '',
        photo_urls: [],
      }],
    }))
    setDirty(true)
  }

  const removeOutput = (inputId: string, key: string) => {
    setEditOutputs(prev => ({
      ...prev,
      [inputId]: (prev[inputId] ?? []).filter(o => o.key !== key),
    }))
    setDirty(true)
  }

  const updateOutput = (inputId: string, key: string, field: keyof EditableOutput, value: unknown) => {
    setEditOutputs(prev => ({
      ...prev,
      [inputId]: (prev[inputId] ?? []).map(o => o.key === key ? { ...o, [field]: value } : o),
    }))
    setDirty(true)
  }

  const handleSave = async () => {
    if (!id || !gp) return

    // Validate: no output with qty = 0 or missing product
    for (const inp of gp.inputs) {
      if (inp.requires_processing) {
        const outs = editOutputs[inp.id] ?? []
        if (outs.length === 0) { toast.error(`Input "${inp.product_name}" harus punya minimal 1 output`); return }
        for (const o of outs) {
          if (!o.product_id) { toast.error(`Pilih produk untuk semua output di "${inp.product_name}"`); return }
          if (o.qty_output <= 0) { toast.error(`Qty output tidak boleh 0 untuk "${inp.product_name}"`); return }
        }
      }
    }

    const inputs = gp.inputs.map(inp => ({
      id: inp.id,
      outputs: (editOutputs[inp.id] ?? []).map((o, i) => ({
        id: o.id,
        product_id: o.product_id,
        qty_output: o.qty_output,
        uom: o.uom,
        is_waste: o.is_waste,
        waste_reason: o.is_waste ? o.waste_reason : null,
        photo_urls: o.photo_urls.length > 0 ? o.photo_urls : null,
        sort_order: i,
      })),
    }))

    try {
      await updateMutation.mutateAsync({
        id,
        body: {
          processing_type: gp.processing_type,
          inputs,
        },
      })
      toast.success('Output disimpan')
      setDirty(false)
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal menyimpan'))
    }
  }

  const handleAction = async () => {
    if (!id || !confirmAction) return

    // Guard: save unsaved changes before submit QC
    if (confirmAction === 'submit_qc' && dirty) {
      toast.error('Simpan perubahan terlebih dahulu sebelum submit ke QC')
      setConfirmAction(null)
      return
    }

    try {
      if (confirmAction === 'start') await startMutation.mutateAsync(id)
      else if (confirmAction === 'submit_qc') await submitQcMutation.mutateAsync(id)
      else if (confirmAction === 'confirm') await confirmMutation.mutateAsync(id)
      toast.success(
        confirmAction === 'start' ? 'Proses dimulai' :
        confirmAction === 'submit_qc' ? 'Dikirim ke QC' :
        'Dikonfirmasi, stock masuk gudang'
      )
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal memproses'))
    } finally {
      setConfirmAction(null)
    }
  }

  const handleReject = async () => {
    if (!id || !rejectReason.trim()) return
    try {
      await rejectMutation.mutateAsync({ id, rejection_reason: rejectReason })
      toast.success('Ditolak')
      setShowReject(false)
      setRejectReason('')
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal menolak'))
    }
  }

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 p-6">
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!gp) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500">Data tidak ditemukan</p>
      </div>
    )
  }

  const statusCfg = STATUS_CONFIG[gp.status] ?? STATUS_CONFIG.DRAFT
  const isEditable = ['DRAFT', 'PROCESSING', 'REJECTED'].includes(gp.status) && canUpdate
  const canSubmitQc = ['PROCESSING', 'REJECTED'].includes(gp.status) && canUpdate

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 lg:px-6 py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate('/inventory/goods-processing')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Package className="w-6 h-6 text-orange-600 shrink-0 hidden sm:block" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate">{gp.processing_number}</h1>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${statusCfg.color}`}>{statusCfg.label}</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                GR: {gp.gr_number} · {gp.supplier_name} · {gp.branch_name}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 shrink-0 flex-wrap justify-end">
            {dirty && isEditable && (
              <button onClick={handleSave} disabled={updateMutation.isPending}
                className="flex items-center gap-1 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 text-sm">
                <Save className="w-4 h-4" /> {updateMutation.isPending ? 'Menyimpan...' : 'Simpan'}
              </button>
            )}
            {gp.status === 'DRAFT' && canUpdate && (
              <button onClick={() => setConfirmAction('start')}
                className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                <Play className="w-4 h-4" /> <span className="hidden sm:inline">Mulai Proses</span>
              </button>
            )}
            {canSubmitQc && (
              <button onClick={() => setConfirmAction('submit_qc')}
                className="flex items-center gap-1 px-3 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm">
                <Send className="w-4 h-4" /> <span className="hidden sm:inline">Submit QC</span>
              </button>
            )}
            {gp.status === 'QC_REVIEW' && canApprove && (
              <>
                <button onClick={() => setShowReject(true)}
                  className="flex items-center gap-1 px-3 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-sm">
                  <XCircle className="w-4 h-4" />
                </button>
                <button onClick={() => setConfirmAction('confirm')}
                  className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
                  <CheckCircle2 className="w-4 h-4" /> <span className="hidden sm:inline">Konfirmasi</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 lg:px-6 py-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400 text-xs">Tanggal</span>
            <p className="font-medium text-gray-900 dark:text-white">{fmtDate(gp.processing_date)}</p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400 text-xs">Tipe</span>
            <p className="font-medium text-gray-900 dark:text-white">{gp.processing_type === 'DISASSEMBLY' ? 'Disassembly' : 'Pass-through'}</p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400 text-xs">Gudang</span>
            <p className="font-medium text-gray-900 dark:text-white truncate">{gp.warehouse_name}</p>
          </div>
          {gp.total_input_qty != null && (
            <>
              <div>
                <span className="text-gray-500 dark:text-gray-400 text-xs">Input</span>
                <p className="font-medium text-gray-900 dark:text-white">{fmt(gp.total_input_qty)}</p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400 text-xs">Output</span>
                <p className="font-medium text-green-600 dark:text-green-400">{fmt(gp.total_output_qty ?? 0)}</p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400 text-xs">Yield</span>
                <p className="font-medium text-gray-900 dark:text-white">{gp.yield_percentage}%</p>
              </div>
            </>
          )}
        </div>
        {gp.rejection_reason && (
          <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-300"><strong>Alasan Penolakan:</strong> {gp.rejection_reason}</p>
          </div>
        )}
      </div>

      {/* Inputs & Outputs */}
      <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-4">
        {gp.inputs.map(inp => {
          const outputs = editOutputs[inp.id] ?? []
          const totalNonWaste = outputs.filter(o => !o.is_waste).reduce((s, o) => s + (o.qty_output || 0), 0)
          const totalWaste = outputs.filter(o => o.is_waste).reduce((s, o) => s + (o.qty_output || 0), 0)
          const totalAll = totalNonWaste + totalWaste
          const overInput = totalAll > Number(inp.qty_input)
          const isPassThrough = !inp.requires_processing
          const lineEditable = ['PENDING', 'PROCESSING', 'REJECTED'].includes(inp.status ?? 'PENDING') && canUpdate

          return (
            <div key={inp.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              {/* Input Header with per-line status + actions */}
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{inp.product_name}</span>
                    <span className="text-xs text-gray-500 hidden sm:inline">{inp.product_code}</span>
                    {isPassThrough
                      ? <span className="px-1.5 py-0.5 text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded shrink-0">Pass</span>
                      : <span className="px-1.5 py-0.5 text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 rounded shrink-0">Proses</span>
                    }
                    {inp.status && (
                      <span className={`px-1.5 py-0.5 text-[10px] rounded shrink-0 ${
                        inp.status === 'CONFIRMED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                        inp.status === 'QC_REVIEW' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                        inp.status === 'PROCESSING' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                        inp.status === 'REJECTED' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                        'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      }`}>{inp.status}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-mono text-gray-700 dark:text-gray-300">{fmt(inp.qty_input)} {inp.uom}</span>
                    {/* Per-line action buttons */}
                    {inp.status === 'PENDING' && canUpdate && (
                      <button onClick={() => { startLineMutation.mutateAsync(inp.id).then(() => toast.success('Proses dimulai')).catch((e: unknown) => toast.error(parseApiError(e, 'Gagal'))) }}
                        className="px-2 py-1 text-[10px] bg-blue-600 text-white rounded hover:bg-blue-700">Mulai</button>
                    )}
                    {['PROCESSING', 'REJECTED'].includes(inp.status ?? '') && canUpdate && (
                      <button onClick={() => { submitLineQcMutation.mutateAsync(inp.id).then(() => toast.success('Dikirim ke QC')).catch((e: unknown) => toast.error(parseApiError(e, 'Gagal'))) }}
                        className="px-2 py-1 text-[10px] bg-yellow-600 text-white rounded hover:bg-yellow-700">Submit QC</button>
                    )}
                    {inp.status === 'QC_REVIEW' && canApprove && (
                      <button onClick={() => { confirmLineMutation.mutateAsync(inp.id).then(() => toast.success('Dikonfirmasi')).catch((e: unknown) => toast.error(parseApiError(e, 'Gagal'))) }}
                        className="px-2 py-1 text-[10px] bg-green-600 text-white rounded hover:bg-green-700">Confirm</button>
                    )}
                  </div>
                </div>
                {inp.status === 'CONFIRMED' && inp.qc_confirmed_by_name && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">✓ Dikonfirmasi oleh {inp.qc_confirmed_by_name}{inp.qc_confirmed_at ? ` · ${fmtDate(inp.qc_confirmed_at)}` : ''}</p>
                )}
                {inp.status === 'REJECTED' && inp.rejection_reason && (
                  <p className="text-xs text-red-500 mt-1">✗ Ditolak: {inp.rejection_reason}</p>
                )}
              </div>

              {/* Pass-through: show conversion suggestion */}
              {isPassThrough && (
                <div className="px-4 py-3 bg-green-50/50 dark:bg-green-900/5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-green-700 dark:text-green-400">Output = Input (langsung masuk gudang)</p>
                    <span className="text-sm font-mono text-gray-700 dark:text-gray-300">{fmt(inp.qty_input)} {inp.uom}</span>
                  </div>
                  {(() => {
                    const uoms = uomData?.[inp.product_id]
                    if (!uoms || uoms.length <= 1) return null
                    const inputUom = uoms.find(u => u.unit_name === inp.uom)
                    const baseUom = uoms.find(u => u.is_base_unit)
                    if (!inputUom || !baseUom || inputUom.is_base_unit) return null
                    const converted = Number(inp.qty_input) * inputUom.conversion_factor
                    return (
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        → Konversi: {fmt(converted)} {baseUom.unit_name}
                        <span className="text-gray-400 ml-1">(1 {inp.uom} = {fmt(inputUom.conversion_factor)} {baseUom.unit_name})</span>
                      </p>
                    )
                  })()}
                </div>
              )}

              {/* Disassembly: editable outputs */}
              {!isPassThrough && (
                <div className="p-4 space-y-3">
                  {outputs.map(out => (
                    <div key={out.key} className={`p-3 rounded-lg border ${out.is_waste ? 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/10' : 'border-gray-200 dark:border-gray-700'}`}>
                      {lineEditable ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Product picker button */}
                            <button onClick={() => { setPickerInputId(inp.id); setPickerOutputKey(out.key); setShowProductPicker(true) }}
                              className="flex-1 min-w-[150px] px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm text-left bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:border-blue-400 truncate">
                              {out.product_id ? out.product_name || 'Produk dipilih' : <span className="text-gray-400">Pilih produk...</span>}
                            </button>
                            <input type="number" min="0" value={out.qty_output || ''}
                              onChange={e => updateOutput(inp.id, out.key, 'qty_output', parseFloat(e.target.value) || 0)}
                              className="w-24 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm text-right bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              placeholder="Qty" />
                            <input type="text" value={out.uom}
                              onChange={e => updateOutput(inp.id, out.key, 'uom', e.target.value)}
                              className="w-16 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              placeholder="UOM" />
                            <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 shrink-0 cursor-pointer">
                              <input type="checkbox" checked={out.is_waste}
                                onChange={e => updateOutput(inp.id, out.key, 'is_waste', e.target.checked)}
                                className="w-3.5 h-3.5 rounded border-gray-300 text-red-600" />
                              Waste
                            </label>
                            <button onClick={() => removeOutput(inp.id, out.key)} className="p-1 text-gray-400 hover:text-red-500 shrink-0">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          {out.is_waste && (
                            <input type="text" value={out.waste_reason}
                              onChange={e => updateOutput(inp.id, out.key, 'waste_reason', e.target.value)}
                              placeholder="Alasan waste (tulang, kulit, dll)"
                              className="w-full px-2 py-1.5 border border-red-300 dark:border-red-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            {out.is_waste && <span className="px-1.5 py-0.5 text-xs bg-red-200 text-red-700 dark:bg-red-800 dark:text-red-300 rounded shrink-0">Waste</span>}
                            <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{out.product_name}</span>
                            {out.waste_reason && <span className="text-xs text-red-500">({out.waste_reason})</span>}
                          </div>
                          <span className="text-sm font-mono text-gray-700 dark:text-gray-300 shrink-0">{fmt(out.qty_output)} {out.uom}</span>
                        </div>
                      )}
                    </div>
                  ))}

                  {lineEditable && (
                    <button onClick={() => addOutput(inp.id, inp)}
                      className="flex items-center gap-1 px-3 py-2 text-xs text-gray-600 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-orange-400 hover:text-orange-600 w-full justify-center">
                      <Plus className="w-3.5 h-3.5" /> Tambah Output
                    </button>
                  )}

                  <div className={`flex justify-between text-xs pt-2 border-t border-gray-200 dark:border-gray-700 ${overInput ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                    <span>Output: {fmt(totalNonWaste)} + waste {fmt(totalWaste)} = {fmt(totalAll)}</span>
                    <span>dari {fmt(inp.qty_input)} {inp.uom} {overInput && '⚠️ Melebihi input!'}</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <ConfirmModal isOpen={!!confirmAction} onClose={() => setConfirmAction(null)} onConfirm={handleAction}
        title={confirmAction === 'start' ? 'Mulai Proses' : confirmAction === 'submit_qc' ? 'Submit ke QC' : 'Konfirmasi QC'}
        message={
          confirmAction === 'start' ? 'Mulai proses barang ini?' :
          confirmAction === 'submit_qc' ? 'Kirim ke QC untuk review? Pastikan semua output sudah benar.' :
          'Konfirmasi barang masuk? Stock akan tercatat di gudang.'
        }
        confirmText={confirmAction === 'confirm' ? 'Konfirmasi' : 'Lanjut'}
        variant={confirmAction === 'confirm' ? 'success' : 'info'}
        isLoading={startMutation.isPending || submitQcMutation.isPending || confirmMutation.isPending} />

      {/* Reject Modal */}
      <ConfirmModal isOpen={showReject} onClose={() => { setShowReject(false); setRejectReason('') }}
        onConfirm={handleReject}
        title="Tolak Barang Masuk" confirmText="Tolak" variant="danger"
        isLoading={rejectMutation.isPending}
        message={
          <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
            placeholder="Alasan penolakan (wajib)"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm mt-2"
            rows={3} />
        } />

      {/* Product Picker for disassembly outputs */}
      <ProductPickerModal
        open={showProductPicker}
        onClose={() => { setShowProductPicker(false); setPickerInputId(null); setPickerOutputKey(null) }}
        onSelect={(product) => {
          if (pickerInputId && pickerOutputKey) {
            updateOutput(pickerInputId, pickerOutputKey, 'product_id', product.id)
            updateOutput(pickerInputId, pickerOutputKey, 'product_name', product.name)
            updateOutput(pickerInputId, pickerOutputKey, 'uom', product.uom_base)
          }
          setShowProductPicker(false)
          setPickerInputId(null)
          setPickerOutputKey(null)
        }}
        branchId={gp?.branch_id}
        showStock
      />
    </div>
  )
}
