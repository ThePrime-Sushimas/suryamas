import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useWipItem, useUpdateWipItem, useCreateWipItem, useProductList } from '../api/food-production.api'
import type { ProductUomOption } from '../api/food-production.api'
import api from '@/lib/axios'

const fmt = (n: number) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(n)

interface EditableIngredient {
  product_id: string
  qty: number
  uom: string
  cost_per_unit: number
}

export default function WipDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const isNew = id === 'new'

  const wipItem = useWipItem(isNew ? '' : (id || ''))
  const updateWip = useUpdateWipItem()
  const createWip = useCreateWipItem()
  const products = useProductList()
  const { data: metricUnits = [] } = useQuery({
    queryKey: ['metric-units'],
    queryFn: async () => { const { data } = await api.get('/metric-units', { params: { limit: 200 } }); return (data.data || []) as { id: string; unit_name: string }[] },
  })

  const [wipName, setWipName] = useState('')
  const [wipCode, setWipCode] = useState('')
  const [uom, setUom] = useState('gram')
  const [yieldQty, setYieldQty] = useState(1)
  const [notes, setNotes] = useState('')
  const [ingredients, setIngredients] = useState<EditableIngredient[]>([])
  const [dirty, setDirty] = useState(false)
  const liveTotal = ingredients.reduce((sum, i) => sum + (i.qty * i.cost_per_unit), 0)

  // Build product cost map for live display
  const productCostMap = useMemo(() => new Map((products.data || []).map(p => [p.id, p.average_cost || 0])), [products.data])
  const productUomMap = useMemo(() => new Map((products.data || []).map(p => [p.id, p.default_purchase_unit || 'gram'])), [products.data])

  // Fetch UOMs per product on demand
  const productUomsCache = useRef<Map<string, ProductUomOption[]>>(new Map())
  const [productUomsMap, setProductUomsMap] = useState<Map<string, ProductUomOption[]>>(new Map())

  const fetchUomsForProduct = useCallback(async (productId: string): Promise<ProductUomOption[]> => {
    const cached = productUomsCache.current.get(productId)
    if (cached) return cached
    try {
      const { data } = await api.get(`/products/${productId}/uoms`)
      const uoms = (data.data || []) as ProductUomOption[]
      productUomsCache.current.set(productId, uoms)
      setProductUomsMap(new Map(productUomsCache.current))
      return uoms
    } catch { return [] }
  }, [])

  useEffect(() => {
    if (wipItem.data) {
      setWipName(wipItem.data.wip_name)
      setUom(wipItem.data.uom)
      setYieldQty(wipItem.data.yield_qty)
      setNotes(wipItem.data.notes || '')
      setIngredients(wipItem.data.ingredients.map(i => ({
        product_id: i.product_id,
        qty: i.qty,
        uom: i.uom,
        cost_per_unit: i.cost_per_unit,
      })))
      setDirty(false)
      // Fetch UOMs for existing products
      for (const i of wipItem.data.ingredients) {
        if (i.product_id) fetchUomsForProduct(i.product_id)
      }
    }
  }, [wipItem.data, fetchUomsForProduct])

  const addIngredient = () => {
    setIngredients([...ingredients, { product_id: '', qty: 0, uom: 'gram', cost_per_unit: 0 }])
    setDirty(true)
  }

  const removeIngredient = (idx: number) => {
    setIngredients(ingredients.filter((_, i) => i !== idx))
    setDirty(true)
  }

  const updateIngredient = async (idx: number, field: keyof EditableIngredient, value: string | number) => {
    const updated = [...ingredients]
    if (field === 'product_id') {
      const uoms = await fetchUomsForProduct(value as string)
      const baseUom = uoms.find(u => u.is_base_unit)
      const defaultUom = baseUom?.metric_units?.unit_name || productUomMap.get(value as string) || 'gram'
      const baseCost = productCostMap.get(value as string) ?? 0
      updated[idx] = { ...updated[idx], product_id: value as string, cost_per_unit: baseCost, uom: defaultUom }
    } else if (field === 'uom') {
      // Recalculate cost based on conversion factor
      const productId = updated[idx].product_id
      const uoms = productUomsMap.get(productId) || []
      const selectedUom = uoms.find(u => u.metric_units?.unit_name === value)
      const baseCost = productCostMap.get(productId) ?? 0
      // cost_per_unit = average_cost (per base unit) × conversion_factor (base units per this UOM)
      // Example: avg_cost = 0.05/gram, UOM = kg (factor=1000) → cost/kg = 50
      const costPerUnit = selectedUom ? baseCost * selectedUom.conversion_factor : baseCost
      updated[idx] = { ...updated[idx], uom: value as string, cost_per_unit: costPerUnit }
    } else {
      updated[idx] = { ...updated[idx], [field]: value }
    }
    setIngredients(updated)
    setDirty(true)
  }

  const handleSave = async () => {
    if (isNew) {
      if (!wipCode.trim() || !wipName.trim()) { toast.warning('Kode dan nama WIP wajib diisi'); return }
      const validIngredients = ingredients.filter(i => i.product_id && i.qty > 0)
      try {
        const created = await createWip.mutateAsync({ wip_code: wipCode, wip_name: wipName, uom, yield_qty: yieldQty, notes: notes || undefined, ingredients: validIngredients })
        toast.success('WIP berhasil dibuat')
        navigate(`/food-production/wip/${created.id}`, { replace: true })
      } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal membuat WIP')) }
    } else {
      if (!id) return
      const validIngredients = ingredients.filter(i => i.product_id && i.qty > 0)
      try {
        await updateWip.mutateAsync({ id, wip_name: wipName, uom, yield_qty: yieldQty, notes: notes || undefined, ingredients: validIngredients })
        toast.success('WIP berhasil disimpan')
        navigate('/food-production/wip')
      } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal menyimpan WIP')) }
    }
  }

  if (!id) return null
  const w = isNew ? null : wipItem.data

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/food-production/wip')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{isNew ? 'Tambah WIP Baru' : (w?.wip_name || 'Loading...')}</h1>
          <p className="text-xs text-gray-400">{isNew ? 'Buat bahan setengah jadi baru' : w?.wip_code}</p>
        </div>
        {(dirty || isNew) && (
          <button onClick={handleSave} disabled={updateWip.isPending || createWip.isPending}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
            <Save className="w-3.5 h-3.5" /> {updateWip.isPending || createWip.isPending ? 'Menyimpan...' : 'Simpan'}
          </button>
        )}
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {!isNew && (
          <>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
              <p className="text-xs text-gray-400">Cost / Batch</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{w && w.estimated_cost > 0 ? fmt(w.estimated_cost) : '—'}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
              <p className="text-xs text-gray-400">Cost / Unit</p>
              <p className="text-lg font-bold text-emerald-600">{w && w.cost_per_unit > 0 ? fmt(w.cost_per_unit) : '—'}</p>
            </div>
          </>
        )}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
          <p className="text-xs text-gray-400">Hasil / Batch</p>
          <input type="number" value={yieldQty} onChange={e => { setYieldQty(Number(e.target.value)); setDirty(true) }} min={0.01} step="0.01"
            className="text-lg font-bold text-gray-900 dark:text-white bg-transparent w-full outline-none border-b border-dashed border-gray-300 dark:border-gray-600 focus:border-purple-500" />
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
          <p className="text-xs text-gray-400">UOM Hasil</p>
          <select value={uom} onChange={e => { setUom(e.target.value); setDirty(true) }}
            className="text-lg font-bold text-gray-900 dark:text-white bg-transparent w-full outline-none border-b border-dashed border-gray-300 dark:border-gray-600 focus:border-purple-500">
            {metricUnits.map(u => (
              <option key={u.id} value={u.unit_name}>{u.unit_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* WIP Name + Code + Notes */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
        {isNew && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Kode WIP</label>
            <input value={wipCode} onChange={e => { setWipCode(e.target.value); setDirty(true) }}
              className="w-full h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="cth: WIP-NASI-SUSHI" />
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Nama WIP</label>
          <input value={wipName} onChange={e => { setWipName(e.target.value); setDirty(true) }}
            className="w-full h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Catatan (opsional)</label>
          <textarea value={notes} onChange={e => { setNotes(e.target.value); setDirty(true) }} rows={2}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
        </div>
      </div>

      {/* Ingredients Editor */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Bahan Baku</h2>
          <button onClick={addIngredient} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">
            <Plus className="w-3 h-3" /> Tambah Bahan
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-[40%]">Bahan Baku</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">Qty</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-20">UOM</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cost/Unit</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Line Cost</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {ingredients.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">
                  Belum ada bahan. Klik "Tambah Bahan" untuk mulai.
                </td></tr>
              ) : ingredients.map((ing, idx) => {
                return (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-3 py-2">
                      <select value={ing.product_id} onChange={e => updateIngredient(idx, 'product_id', e.target.value)}
                        className="w-full h-8 px-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                        <option value="">Pilih bahan baku...</option>
                        {(products.data || []).map(p => (
                          <option key={p.id} value={p.id}>{p.product_code} — {p.product_name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" value={ing.qty || ''} onChange={e => updateIngredient(idx, 'qty', Number(e.target.value))} min={0} step="0.01"
                        className="w-full h-8 px-2 text-sm text-right border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                    </td>
                    <td className="px-3 py-2">
                      <select value={ing.uom} onChange={e => updateIngredient(idx, 'uom', e.target.value)}
                        className="w-full h-8 px-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                        {(productUomsMap.get(ing.product_id) || []).map(u => (
                          <option key={u.metric_units?.unit_name || u.id} value={u.metric_units?.unit_name || ''}>{u.metric_units?.unit_name || '—'}</option>
                        ))}
                        {(productUomsMap.get(ing.product_id) || []).length === 0 && (
                          <option value={ing.uom}>{ing.uom}</option>
                        )}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-500 font-mono text-xs">
                      {ing.cost_per_unit > 0 ? fmt(ing.cost_per_unit) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-900 dark:text-white font-mono text-xs">
                      {ing.qty > 0 && ing.cost_per_unit > 0 ? fmt(ing.qty * ing.cost_per_unit) : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => removeIngredient(idx)} className="p-1 text-gray-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {liveTotal > 0 && (
              <tfoot className="bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-right text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Total Cost / Batch:</td>
                  <td className="px-3 py-2 text-right font-mono font-bold text-gray-900 dark:text-white">{fmt(liveTotal)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
