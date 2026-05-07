import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Plus, Trash2, RefreshCw } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useMenu, useRecipe, useSaveRecipe, useUpdateMenu, useCreateMenu, useMenuCategories, useMenuGroups, useWipItems, useProductList } from '../api/food-production.api'
import type { ProductUomOption } from '../api/food-production.api'
import api from '@/lib/axios'

const fmt = (n: number) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(n)

interface EditableLine {
  product_id: string | null
  wip_id: string | null
  qty: number
  uom: string
  cost_per_unit: number // local tracking for live display
}

export default function MenuDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const isNew = id === 'new'

  const menu = useMenu(isNew ? '' : (id || ''))
  const recipe = useRecipe(isNew ? '' : (id || ''))
  const saveRecipe = useSaveRecipe()
  const updateMenu = useUpdateMenu()
  const createMenu = useCreateMenu()
  const categories = useMenuCategories()
  const groups = useMenuGroups({})
  const wipItems = useWipItems({ limit: 200 })
  const products = useProductList()

  // Fetch UOMs for all products currently in recipe lines
  const productUomsCache = useRef<Map<string, ProductUomOption[]>>(new Map())
  const [productUomsMap, setProductUomsMap] = useState<Map<string, ProductUomOption[]>>(new Map())

  // Stable function — cache in ref, state only for re-render
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

  // Create mode state
  const [menuCode, setMenuCode] = useState('')
  const [menuName, setMenuName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [sellingPrice, setSellingPrice] = useState(0)

  const [lines, setLines] = useState<EditableLine[]>([])
  const [dirty, setDirty] = useState(false)

  // Build cost lookup maps
  const productCostMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of products.data || []) map.set(p.id, p.average_cost || 0)
    return map
  }, [products.data])

  const wipCostMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const w of wipItems.data?.data || []) map.set(w.id, w.cost_per_unit || 0)
    return map
  }, [wipItems.data])

  const wipUomMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const w of wipItems.data?.data || []) map.set(w.id, w.uom || 'gram')
    return map
  }, [wipItems.data])

  // Load recipe lines + fetch UOMs for existing products
  useEffect(() => {
    if (recipe.data?.lines) {
      setLines(recipe.data.lines.map(l => ({
        product_id: l.product_id,
        wip_id: l.wip_id,
        qty: l.qty,
        uom: l.uom,
        cost_per_unit: l.cost_per_unit,
      })))
      setDirty(false)
      // Fetch UOMs for all products in recipe
      for (const l of recipe.data.lines) {
        if (l.product_id) fetchUomsForProduct(l.product_id)
      }
    }
  }, [recipe.data, fetchUomsForProduct])

  const addLine = () => {
    setLines([...lines, { product_id: null, wip_id: null, qty: 0, uom: 'gram', cost_per_unit: 0 }])
    setDirty(true)
  }

  const removeLine = (idx: number) => {
    setLines(lines.filter((_, i) => i !== idx))
    setDirty(true)
  }

  const handleIngredientChange = async (idx: number, value: string) => {
    const updated = [...lines]
    const [type, uuid] = value.split(':')
    if (type === 'product') {
      const uoms = await fetchUomsForProduct(uuid)
      const baseUom = uoms.find(u => u.is_base_unit)
      const defaultUom = baseUom?.metric_units?.unit_name || products.data?.find(p => p.id === uuid)?.default_purchase_unit || 'gram'
      const baseCost = productCostMap.get(uuid) ?? 0
      updated[idx] = { ...updated[idx], product_id: uuid, wip_id: null, cost_per_unit: baseCost, uom: defaultUom }
    } else if (type === 'wip') {
      updated[idx] = { ...updated[idx], wip_id: uuid, product_id: null, cost_per_unit: wipCostMap.get(uuid) ?? 0, uom: wipUomMap.get(uuid) ?? 'gram' }
    }
    setLines(updated)
    setDirty(true)
  }

  const handleUomChange = (idx: number, uom: string) => {
    const updated = [...lines]
    const line = updated[idx]
    if (line.product_id) {
      const uoms = productUomsMap.get(line.product_id) || []
      const selectedUom = uoms.find(u => u.metric_units?.unit_name === uom)
      const baseCost = productCostMap.get(line.product_id) ?? 0
      // cost_per_unit = average_cost (per base unit) × conversion_factor (base units per this UOM)
      // Example: avg_cost = 0.05/gram, UOM = kg (factor=1000) → cost/kg = 50
      const costPerUnit = selectedUom ? baseCost * selectedUom.conversion_factor : baseCost
      updated[idx] = { ...line, uom, cost_per_unit: costPerUnit }
    } else {
      updated[idx] = { ...line, uom }
    }
    setLines(updated)
    setDirty(true)
  }

  const handleQtyChange = (idx: number, qty: number) => {
    const updated = [...lines]
    updated[idx] = { ...updated[idx], qty }
    setLines(updated)
    setDirty(true)
  }

  const handleSave = async () => {
    if (!id || isNew) return
    const validLines = lines.filter(l => (l.product_id || l.wip_id) && l.qty > 0)
    try {
      await saveRecipe.mutateAsync({ menuId: id, lines: validLines.map(l => ({ product_id: l.product_id, wip_id: l.wip_id, qty: l.qty, uom: l.uom })) })
      toast.success('Resep berhasil disimpan')
      setDirty(false)
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal menyimpan resep')) }
  }

  const handleToggleSync = async () => {
    if (!id || !menu.data) return
    try {
      await updateMenu.mutateAsync({ id, sync_enabled: !menu.data.sync_enabled })
      toast.success(menu.data.sync_enabled ? 'Sync dimatikan' : 'Sync diaktifkan')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal update sync')) }
  }

  // Live calculated total
  const liveTotal = lines.reduce((sum, l) => sum + (l.qty * l.cost_per_unit), 0)

  const handleCreate = async () => {
    if (!menuCode.trim() || !menuName.trim() || !categoryId) { toast.warning('Kode, nama, dan kategori wajib diisi'); return }
    try {
      const created = await createMenu.mutateAsync({ menu_code: menuCode, menu_name: menuName, category_id: categoryId, group_id: groupId || undefined, selling_price: sellingPrice })
      toast.success('Menu berhasil dibuat')
      navigate(`/food-production/menus/${created.id}`, { replace: true })
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal membuat menu')) }
  }

  if (!id) return null
  const m = isNew ? null : menu.data
  const r = isNew ? null : recipe.data

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/food-production/menus')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{isNew ? 'Tambah Menu Baru' : (m?.menu_name || 'Loading...')}</h1>
          <p className="text-xs text-gray-400">{isNew ? 'Buat menu baru' : `${m?.menu_code} • ${m?.category_name} • ${m?.group_name || 'Tanpa group'}`}</p>
        </div>
        {m && !isNew && (
          <button onClick={handleToggleSync}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border ${m.sync_enabled ? 'border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400' : 'border-gray-300 text-gray-500 dark:border-gray-600 dark:text-gray-400'}`}>
            <RefreshCw className="w-3 h-3" />
            {m.sync_enabled ? 'Sync Aktif' : 'Sync Mati'}
          </button>
        )}
      </div>

      {/* Create Form */}
      {isNew && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Kode Menu *</label>
              <input value={menuCode} onChange={e => setMenuCode(e.target.value)} placeholder="cth: MENU-001"
                className="w-full h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nama Menu *</label>
              <input value={menuName} onChange={e => setMenuName(e.target.value)} placeholder="cth: Salmon Roll"
                className="w-full h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Kategori *</label>
              <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
                className="w-full h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                <option value="">Pilih kategori...</option>
                {(categories.data || []).map(c => <option key={c.id} value={c.id}>{c.category_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Group</label>
              <select value={groupId} onChange={e => setGroupId(e.target.value)}
                className="w-full h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                <option value="">Tanpa group</option>
                {(groups.data || []).map(g => <option key={g.id} value={g.id}>{g.group_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Harga Jual</label>
              <input type="number" value={sellingPrice || ''} onChange={e => setSellingPrice(Number(e.target.value))} min={0}
                className="w-full h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
          </div>
          <button onClick={handleCreate} disabled={createMenu.isPending}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50">
            <Save className="w-3.5 h-3.5" /> {createMenu.isPending ? 'Membuat...' : 'Buat Menu'}
          </button>
        </div>
      )}

      {/* Info Cards */}
      {m && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
            <p className="text-xs text-gray-400">Harga Jual</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{fmt(m.selling_price)}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
            <p className="text-xs text-gray-400">Estimasi Cost</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{dirty ? fmt(liveTotal) : r?.estimated_cost ? fmt(r.estimated_cost) : '—'}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
            <p className="text-xs text-gray-400">Cost %</p>
            <p className={`text-lg font-bold ${(() => { const pct = m.selling_price > 0 ? (dirty ? liveTotal : r?.estimated_cost || 0) / m.selling_price * 100 : 0; return pct > 40 ? 'text-red-600' : pct > 30 ? 'text-amber-600' : 'text-emerald-600' })()}`}>
              {m.selling_price > 0 ? `${((dirty ? liveTotal : r?.estimated_cost || 0) / m.selling_price * 100).toFixed(1)}%` : '—'}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
            <p className="text-xs text-gray-400">Status Resep</p>
            <p className={`text-lg font-bold ${r?.has_recipe ? 'text-emerald-600' : 'text-amber-500'}`}>
              {r?.has_recipe ? 'Lengkap' : 'Belum Ada'}
            </p>
          </div>
        </div>
      )}

      {/* Recipe Editor */}
      {!isNew && (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Resep / BOM</h2>
          <div className="flex gap-2">
            <button onClick={addLine} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">
              <Plus className="w-3 h-3" /> Tambah Bahan
            </button>
            {dirty && (
              <button onClick={handleSave} disabled={saveRecipe.isPending}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50">
                <Save className="w-3 h-3" /> {saveRecipe.isPending ? 'Menyimpan...' : 'Simpan'}
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-[40%]">Bahan</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">Qty</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-20">UOM</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cost/Unit</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Line Cost</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {lines.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">
                  Belum ada resep. Klik "Tambah Bahan" untuk mulai.
                </td></tr>
              ) : lines.map((line, idx) => {
                const ingredientValue = line.product_id ? `product:${line.product_id}` : line.wip_id ? `wip:${line.wip_id}` : ''
                const lineCost = line.qty * line.cost_per_unit
                return (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-3 py-2">
                      <select value={ingredientValue} onChange={e => handleIngredientChange(idx, e.target.value)}
                        className="w-full h-8 px-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                        <option value="">Pilih bahan...</option>
                        <optgroup label="Bahan Baku">
                          {(products.data || []).map(p => (
                            <option key={p.id} value={`product:${p.id}`}>{p.product_code} — {p.product_name}</option>
                          ))}
                        </optgroup>
                        <optgroup label="WIP (Setengah Jadi)">
                          {(wipItems.data?.data || []).map(w => (
                            <option key={w.id} value={`wip:${w.id}`}>{w.wip_code} — {w.wip_name}</option>
                          ))}
                        </optgroup>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" value={line.qty || ''} onChange={e => handleQtyChange(idx, Number(e.target.value))} min={0} step="0.01"
                        className="w-full h-8 px-2 text-sm text-right border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                    </td>
                    <td className="px-3 py-2">
                      {line.product_id ? (
                        <select value={line.uom} onChange={e => handleUomChange(idx, e.target.value)}
                          className="w-full h-8 px-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                          {(productUomsMap.get(line.product_id) || []).map(u => (
                            <option key={u.metric_units?.unit_name || u.id} value={u.metric_units?.unit_name || ""}>{u.metric_units?.unit_name || "—"}</option>
                          ))}
                          {(productUomsMap.get(line.product_id) || []).length === 0 && (
                            <option value={line.uom}>{line.uom}</option>
                          )}
                        </select>
                      ) : (
                        <span className="text-sm text-gray-500">{line.uom}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-500 font-mono text-xs">
                      {line.cost_per_unit > 0 ? fmt(line.cost_per_unit) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-900 dark:text-white font-mono text-xs font-medium">
                      {lineCost > 0 ? fmt(lineCost) : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => removeLine(idx)} className="p-1 text-gray-400 hover:text-red-500">
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
                  <td colSpan={4} className="px-3 py-2 text-right text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Total Estimasi Cost:</td>
                  <td className="px-3 py-2 text-right font-mono font-bold text-gray-900 dark:text-white">{fmt(liveTotal)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      )}
    </div>
  )
}
