import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Plus, Trash2, RefreshCw } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useMenu, useRecipe, useSaveRecipe, useUpdateMenu, useCreateMenu, useMenuCategories, useMenuGroups, useWipItems, useProductList, useMenuBranchPrices, useActiveBranches, useUpsertMenuBranchPrice, useUpdateMenuBranchPrice, useDeleteMenuBranchPrice, useSyncMenuBranchPrices } from '../api/food-production.api'
import type { ProductUomOption, MenuBranchPrice } from '../api/food-production.api'
import type { Menu, MenuCategory, MenuGroup } from '../types/food-production.types'
import api from '@/lib/axios'

const fmt = (n: number) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(n)

// ── Edit Menu Section (collapsible) ──
function EditMenuSection({ menu, categories, groups, onUpdate }: {
  menu: Menu
  categories: MenuCategory[]
  groups: MenuGroup[]
  onUpdate: (data: { id: string; category_id?: string; group_id?: string | null; menu_name?: string; selling_price?: number }) => Promise<unknown>
}) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(menu.menu_name)
  const [catId, setCatId] = useState(menu.category_id)
  const [grpId, setGrpId] = useState(menu.group_id || '')
  const [price, setPrice] = useState(menu.selling_price)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(menu.menu_name); setCatId(menu.category_id); setGrpId(menu.group_id || ''); setPrice(menu.selling_price)
  }, [menu])

  const handleSaveMenu = async () => {
    setSaving(true)
    try {
      await onUpdate({ id: menu.id, menu_name: name, category_id: catId, group_id: grpId || null, selling_price: price })
      toast.success('Menu diupdate')
      setOpen(false)
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal update menu')) }
    finally { setSaving(false) }
  }

  const filteredGroups = groups.filter(g => g.category_id === catId)

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 underline">
        Edit detail menu
      </button>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 rounded-xl p-4 space-y-3">
      <p className="text-xs font-medium text-gray-500 uppercase">✏️ Edit Menu</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Nama Menu</label>
          <input value={name} onChange={e => setName(e.target.value)}
            className="w-full h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Harga Jual</label>
          <input type="number" value={price || ''} onChange={e => setPrice(Number(e.target.value))} min={0}
            className="w-full h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Kategori</label>
          <select value={catId} onChange={e => { setCatId(e.target.value); setGrpId('') }}
            className="w-full h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
            {categories.map(c => <option key={c.id} value={c.id}>{c.category_name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Group</label>
          <select value={grpId} onChange={e => setGrpId(e.target.value)}
            className="w-full h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
            <option value="">Tanpa group</option>
            {filteredGroups.map(g => <option key={g.id} value={g.id}>{g.group_name}</option>)}
          </select>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={handleSaveMenu} disabled={saving}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Menyimpan...' : 'Simpan'}
        </button>
        <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg">Batal</button>
      </div>
    </div>
  )
}

// ── Branch Prices Section ──
const PRICE_TYPES = [
  { key: 'DINE_IN', label: 'Dine In' },
  { key: 'TAKEAWAY', label: 'Take Away' },
  { key: 'DELIVERY', label: 'Delivery' },
] as const

function BranchPricesSection({ menuId, defaultPrice }: { menuId: string; defaultPrice: number }) {
  const toast = useToast()
  const branchPrices = useMenuBranchPrices(menuId)
  const branches = useActiveBranches()
  const upsertPrice = useUpsertMenuBranchPrice()
  const updatePrice = useUpdateMenuBranchPrice()
  const deletePrice = useDeleteMenuBranchPrice()
  const syncPrices = useSyncMenuBranchPrices()

  const [activeTab, setActiveTab] = useState<string>('DINE_IN')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [newBranchId, setNewBranchId] = useState<string | null>(null)
  const [newValue, setNewValue] = useState('')
  const [resetTarget, setResetTarget] = useState<MenuBranchPrice | null>(null)

  const startEdit = (price: MenuBranchPrice) => {
    setNewBranchId(null); setNewValue('')
    setEditingId(price.id); setEditValue(String(Number(price.selling_price)))
  }

  const startNew = (branchId: string) => {
    setEditingId(null); setEditValue('')
    setNewBranchId(branchId); setNewValue(String(defaultPrice))
  }

  // Merge branches with existing prices filtered by active tab
  const rows = useMemo(() => {
    const allBranches = branches.data || []
    const prices = (branchPrices.data || []).filter(p => p.price_type === activeTab)
    const priceMap = new Map(prices.map(p => [p.branch_id, p]))
    return allBranches.map(b => ({ branch: b, price: priceMap.get(b.id) ?? null }))
  }, [branches.data, branchPrices.data, activeTab])

  // Count per tab
  const tabCounts = useMemo(() => {
    const prices = branchPrices.data || []
    return {
      DINE_IN: prices.filter(p => p.price_type === 'DINE_IN').length,
      TAKEAWAY: prices.filter(p => p.price_type === 'TAKEAWAY').length,
      DELIVERY: prices.filter(p => p.price_type === 'DELIVERY').length,
    }
  }, [branchPrices.data])

  const handleSync = async () => {
    try {
      const result = await syncPrices.mutateAsync(menuId)
      toast.success(`Sync selesai: ${result.inserted} baru, ${result.synced} diupdate, ${result.skipped_manual} skip (manual), ${result.skipped_threshold} skip (< 5%)`)
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal sync dari POS')) }
  }

  const handleSaveEdit = async (priceRecord: MenuBranchPrice) => {
    const val = parseFloat(editValue)
    if (!val || val <= 0) { toast.warning('Harga harus lebih dari 0'); return }
    try {
      await updatePrice.mutateAsync({ id: priceRecord.id, menuId, selling_price: val })
      toast.success('Harga diupdate')
      setEditingId(null)
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal update harga')) }
  }

  const handleSetNew = async (branchId: string) => {
    const val = parseFloat(newValue)
    if (!val || val <= 0) { toast.warning('Harga harus lebih dari 0'); return }
    try {
      await upsertPrice.mutateAsync({ menu_id: menuId, branch_id: branchId, selling_price: val, price_type: activeTab })
      toast.success('Harga cabang disimpan')
      setNewBranchId(null); setNewValue('')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal set harga')) }
  }

  const handleReset = async () => {
    if (!resetTarget) return
    try {
      await deletePrice.mutateAsync({ id: resetTarget.id, menuId })
      toast.success('Harga direset ke default')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal reset harga')) }
    finally { setResetTarget(null) }
  }

  const sourceBadge = (source: string) => {
    if (source === 'MANUAL') return <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">MANUAL</span>
    if (source === 'POS_SYNC') return <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">POS</span>
    return <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">{source}</span>
  }

  const formatSyncedAt = (synced_at: string | null) => {
    if (!synced_at) return '—'
    const d = new Date(synced_at)
    const diff = Date.now() - d.getTime()
    const days = Math.floor(diff / 86400000)
    if (days === 0) return 'Hari ini'
    if (days === 1) return 'Kemarin'
    return `${days} hari lalu`
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Harga Cabang</h2>
        <button onClick={handleSync} disabled={syncPrices.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 disabled:opacity-50">
          <RefreshCw className={`w-3 h-3 ${syncPrices.isPending ? 'animate-spin' : ''}`} />
          {syncPrices.isPending ? 'Syncing...' : 'Sync dari POS'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 px-4">
        {PRICE_TYPES.map(t => (
          <button key={t.key} onClick={() => { setActiveTab(t.key); setEditingId(null); setEditValue(''); setNewBranchId(null); setNewValue('') }}
            className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
              activeTab === t.key
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}>
            {t.label}
            {tabCounts[t.key as keyof typeof tabCounts] > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full bg-gray-100 dark:bg-gray-700">
                {tabCounts[t.key as keyof typeof tabCounts]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cabang</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Harga</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Source</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Last POS Sync</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase w-32">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {rows.map(({ branch, price }) => (
              <tr key={branch.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-3 py-2 text-gray-900 dark:text-white">{branch.branch_name}</td>
                <td className="px-3 py-2 text-right font-mono">
                  {editingId === price?.id ? (
                    <input type="number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus
                      onKeyDown={e => { if (e.key === 'Enter' && price) handleSaveEdit(price); if (e.key === 'Escape') setEditingId(null) }}
                      className="w-28 h-7 px-2 text-sm text-right border border-blue-400 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                  ) : newBranchId === branch.id ? (
                    <input type="number" value={newValue} onChange={e => setNewValue(e.target.value)} autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') handleSetNew(branch.id); if (e.key === 'Escape') setNewBranchId(null) }}
                      className="w-28 h-7 px-2 text-sm text-right border border-blue-400 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                  ) : price ? (
                    <span className="text-gray-900 dark:text-white">{fmt(price.selling_price)}</span>
                  ) : (
                    <span className="text-gray-400 italic text-xs">default ({fmt(defaultPrice)})</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">{price ? sourceBadge(price.source) : '—'}</td>
                <td className="px-3 py-2 text-center text-xs text-gray-400">{price ? formatSyncedAt(price.synced_at) : '—'}</td>
                <td className="px-3 py-2 text-center">
                  {editingId === price?.id ? (
                    <div className="flex gap-1 justify-center">
                      <button onClick={() => price && handleSaveEdit(price)} className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded">✓</button>
                      <button onClick={() => setEditingId(null)} className="px-2 py-0.5 text-xs border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded">✕</button>
                    </div>
                  ) : newBranchId === branch.id ? (
                    <div className="flex gap-1 justify-center">
                      <button onClick={() => handleSetNew(branch.id)} className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded">✓</button>
                      <button onClick={() => setNewBranchId(null)} className="px-2 py-0.5 text-xs border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded">✕</button>
                    </div>
                  ) : price ? (
                    <div className="flex gap-1 justify-center">
                      <button onClick={() => startEdit(price)}
                        className="px-2 py-0.5 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400">Edit</button>
                      <button onClick={() => setResetTarget(price)}
                        className="px-2 py-0.5 text-xs text-red-500 hover:text-red-700 dark:text-red-400">Reset</button>
                    </div>
                  ) : (
                    <button onClick={() => startNew(branch.id)}
                      className="px-2 py-0.5 text-xs text-emerald-600 hover:text-emerald-800 dark:text-emerald-400">Set Harga</button>
                  )}
                </td>
              </tr>
            ))}
            {/* Default fallback row */}
            <tr className="bg-gray-50 dark:bg-gray-900/30">
              <td className="px-3 py-2 text-gray-500 italic">Default (fallback)</td>
              <td className="px-3 py-2 text-right font-mono text-gray-500">{fmt(defaultPrice)}</td>
              <td className="px-3 py-2 text-center">—</td>
              <td className="px-3 py-2 text-center">—</td>
              <td className="px-3 py-2"></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Reset Confirm Modal */}
      <ConfirmModal
        isOpen={!!resetTarget}
        onClose={() => setResetTarget(null)}
        onConfirm={handleReset}
        title="Reset Harga Cabang"
        message={`Reset harga ${resetTarget?.branch_name ?? ''} ke default? Record ini akan dihapus dan bisa di-sync ulang dari POS.`}
        confirmText="Reset"
        cancelText="Batal"
        variant="danger"
        isLoading={deletePrice.isPending}
      />
    </div>
  )
}

// ── Main Page ──

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
  
  // Pricing Calculator State
  const [targetFoodCost, setTargetFoodCost] = useState(30)
  const [testPrice, setTestPrice] = useState(0)
  const [testPriceEdited, setTestPriceEdited] = useState(false)

  // Sync testPrice with menu selling price only on initial load
  useEffect(() => {
    if (!testPriceEdited && menu.data?.selling_price !== undefined) {
      setTestPrice(menu.data.selling_price)
    }
  }, [menu.data?.selling_price, testPriceEdited])

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

      {/* Pricing Analysis & Info Cards */}
      {m && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 shadow-sm border-l-4 border-l-indigo-500">
              <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Total Production Cost</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white font-mono">{fmt(liveTotal)}</p>
              <p className="text-[10px] text-gray-500 mt-1">Estimasi resep / porsi</p>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 shadow-sm">
              <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Actual Food Cost</p>
              <p className={`text-xl font-bold font-mono ${(() => { 
                const pct = m.selling_price > 0 ? (liveTotal / m.selling_price * 100) : 0; 
                return pct > 40 ? 'text-red-500' : pct > targetFoodCost ? 'text-amber-500' : 'text-emerald-500' 
              })()}`}>
                {m.selling_price > 0 ? `${(liveTotal / m.selling_price * 100).toFixed(1)}%` : '0%'}
              </p>
              <p className="text-[10px] text-gray-500 mt-1">Berdasarkan harga jual aktif</p>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 shadow-sm">
              <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Gross Margin</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white font-mono">
                {m.selling_price > 0 ? `${((m.selling_price - liveTotal) / m.selling_price * 100).toFixed(1)}%` : '0%'}
              </p>
              <p className="text-[10px] text-gray-500 mt-1">Margin laba kotor</p>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 shadow-sm">
              <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Recipe Status</p>
              <p className={`text-lg font-bold ${r?.has_recipe ? 'text-emerald-600' : 'text-amber-500'}`}>
                {r?.has_recipe ? 'Lengkap ✓' : 'Belum Ada'}
              </p>
              <p className="text-[10px] text-gray-500 mt-1">{lines.length} Bahan baku</p>
            </div>
          </div>

          {/* Detailed Analysis Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight">Kalkulator Harga & Profitabilitas</h2>
                  <p className="text-[10px] text-gray-400 mt-0.5">Analisa profit per porsi menu</p>
                </div>
                <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold rounded">REAL-TIME ANALYSIS</span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Target Food Cost %</label>
                    <div className="relative">
                      <input type="number" value={targetFoodCost} onChange={e => setTargetFoodCost(Number(e.target.value))}
                        className="w-full h-12 pl-4 pr-10 text-xl font-mono border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900/50 focus:ring-2 focus:ring-indigo-500 outline-none" />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2 italic">
                      Harga jual disarankan: <span className="text-indigo-600 font-bold font-mono">Rp {fmt(Math.ceil(targetFoodCost > 0 ? liveTotal / (targetFoodCost / 100) : 0))}</span>
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Simulasi Harga Jual</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">Rp</span>
                      <input type="number" value={testPrice || ''} onChange={e => { setTestPrice(Number(e.target.value)); setTestPriceEdited(true) }} placeholder="Masukkan harga..."
                        className="w-full h-12 pl-12 pr-4 text-xl font-mono border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900/50 focus:ring-2 focus:ring-indigo-500 outline-none font-bold" />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2">Harga aktif: <span className="font-bold">{fmt(m.selling_price)}</span></p>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900/30 rounded-2xl p-5 flex flex-col justify-center space-y-4 border border-dashed border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500 uppercase font-medium">Simulated FC%</span>
                    <span className={`text-xl font-black font-mono ${(() => {
                      const fc = testPrice > 0 ? (liveTotal / testPrice * 100) : 0;
                      return fc > targetFoodCost ? 'text-red-500' : 'text-emerald-500';
                    })()}`}>
                      {testPrice > 0 ? (liveTotal / testPrice * 100).toFixed(1) : '0'}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500 uppercase font-medium">Simulated Margin</span>
                    <span className="text-xl font-black font-mono text-gray-900 dark:text-white">
                      {testPrice > 0 ? (((testPrice - liveTotal) / testPrice) * 100).toFixed(1) : '0'}%
                    </span>
                  </div>
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-tight">Laba Kotor / Porsi</span>
                    <div className="text-right">
                      <span className="text-2xl font-black font-mono text-emerald-600 block">
                        Rp {fmt(Math.max(0, testPrice - liveTotal))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Profit Summary Card */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-6">Ringkasan Profit</h3>
                <div className="space-y-5">
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
                    <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Laba Kotor / Porsi</p>
                    <p className={`text-2xl font-black font-mono ${testPrice > 0 && testPrice - liveTotal < 0 ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
                      Rp {fmt(testPrice > 0 ? testPrice - liveTotal : 0)}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
                    <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Komposisi Harga</p>
                    {testPrice > 0 && (
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="h-2 rounded-full bg-red-400" style={{ width: `${Math.min(100, liveTotal / testPrice * 100)}%` }}></div>
                          <span className="text-[10px] text-gray-500 whitespace-nowrap">Cost {(liveTotal / testPrice * 100).toFixed(0)}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${Math.max(0, Math.min(100, (testPrice - liveTotal) / testPrice * 100))}%` }}></div>
                          <span className="text-[10px] text-gray-500 whitespace-nowrap">Profit {Math.max(0, (testPrice - liveTotal) / testPrice * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Basis Kalkulasi</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">HPP rata-rata berjalan (avg cost)</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Menu Details */}
      {m && !isNew && (
        <EditMenuSection menu={m} categories={categories.data || []} groups={groups.data || []} onUpdate={updateMenu.mutateAsync} />
      )}

      {/* Branch Prices */}
      {m && !isNew && (
        <BranchPricesSection menuId={id} defaultPrice={m.selling_price} />
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
