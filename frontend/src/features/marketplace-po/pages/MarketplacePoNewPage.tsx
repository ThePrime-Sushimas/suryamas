import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ShoppingCart } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import {
  useOwnerCreditCards,
  usePendingPoLines,
  useCreateMarketplaceSession,
} from '../api/marketplacePo.api'
import { fmtCurrency, todayIso } from '../utils/format'
import { PLATFORM_CONFIG } from '../utils/constants'
import type { MarketplacePlatform, SelectedLine } from '../types/marketplacePo.types'

export default function MarketplacePoNewPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const canInsert = usePermissionStore((s) => s.hasPermission)('marketplace_po', 'insert')

  const [platform, setPlatform] = useState<MarketplacePlatform>('SHOPEE')
  const [ccId, setCcId] = useState('')
  const [checkoutDate, setCheckoutDate] = useState(todayIso())
  const [notes, setNotes] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [selectedLines, setSelectedLines] = useState<Map<string, SelectedLine>>(new Map())

  const { data: cards = [] } = useOwnerCreditCards({ is_active: true })
  const { data: pendingLines = [], isLoading } = usePendingPoLines({
    platform,
    branch_id: branchFilter || undefined,
  })
  const createSession = useCreateMarketplaceSession()

  const branchOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const l of pendingLines) map.set(l.branch_id, l.branch_name)
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [pendingLines])

  const grouped = useMemo(() => {
    const g: Record<string, typeof pendingLines> = {}
    for (const l of pendingLines) {
      const key = l.branch_name
      if (!g[key]) g[key] = []
      g[key].push(l)
    }
    return g
  }, [pendingLines])

  const total = useMemo(() => {
    let sum = 0
    selectedLines.forEach((l) => {
      sum += l.qty * l.unit_price_netto
    })
    return sum
  }, [selectedLines])

  const selectedBranchIds = useMemo(() => {
    const ids = new Set<string>()
    selectedLines.forEach((l) => ids.add(l.branch_id))
    return ids
  }, [selectedLines])

  const isMultiBranch = selectedBranchIds.size > 1

  const toggleLine = (line: (typeof pendingLines)[0], checked: boolean) => {
    setSelectedLines((prev) => {
      const next = new Map(prev)
      if (!checked) {
        next.delete(line.po_line_id)
        return next
      }

      // Guard: cek apakah sudah ada item dari cabang lain
      const existingBranchIds = new Set<string>()
      prev.forEach((l) => existingBranchIds.add(l.branch_id))

      if (existingBranchIds.size > 0 && !existingBranchIds.has(line.branch_id)) {
        toast.warning('Satu session hanya untuk satu cabang. Buat session terpisah untuk cabang lain.')
        return prev // tidak update
      }

      const remaining = Number(line.qty) - Number(line.qty_received)
      next.set(line.po_line_id, {
        po_line_id: line.po_line_id,
        po_id: line.po_id,
        branch_id: line.branch_id,
        product_id: line.product_id,
        qty: remaining,
        unit_price_netto: Number(line.unit_price),
      })
      return next
    })
  }

  const updateLine = (poLineId: string, field: 'qty' | 'unit_price_netto', value: number) => {
    setSelectedLines((prev) => {
      const next = new Map(prev)
      const cur = next.get(poLineId)
      if (!cur) return prev
      next.set(poLineId, { ...cur, [field]: value })
      return next
    })
  }

  const handleSubmit = async () => {
    if (isMultiBranch) {
      toast.error('Satu session hanya untuk satu cabang. Hapus item dari cabang lain.')
      return
    }
    if (!ccId) {
      toast.warning('Pilih kartu kredit owner')
      return
    }
    if (selectedLines.size === 0) {
      toast.warning('Pilih minimal 1 item')
      return
    }
    const lines = Array.from(selectedLines.values())
    if (lines.some((l) => l.qty <= 0 || l.unit_price_netto < 0)) {
      toast.warning('Qty dan harga harus valid')
      return
    }
    try {
      const session = await createSession.mutateAsync({
        platform,
        cc_id: ccId,
        checkout_date: checkoutDate,
        notes: notes.trim() || null,
        lines,
      })
      toast.success('Session berhasil dibuat')
      navigate(`/inventory/marketplace-po/${session.id}`)
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal membuat session'))
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900/50 pb-24">
      <div className="bg-white dark:bg-gray-800 border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Buat Checkout Session</h1>
            <p className="text-xs text-gray-500">Pilih platform & item dari PO</p>
          </div>
        </div>
        {canInsert && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={createSession.isPending}
            className="px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
          >
            Simpan Session
          </button>
        )}
      </div>

      <div className="max-w-5xl mx-auto p-4 lg:p-6 space-y-6">
        <section className="bg-white dark:bg-gray-800 rounded-2xl border p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">PLATFORM</h2>
          <div className="grid grid-cols-2 gap-3">
            {(['SHOPEE', 'TOKOPEDIA'] as const).map((p) => {
              const cfg = PLATFORM_CONFIG[p]
              const active = platform === p
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setPlatform(p)
                    setSelectedLines(new Map())
                  }}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    active
                      ? `border-teal-500 ${cfg.bgColor}`
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <ShoppingCart className={`w-6 h-6 mb-2 ${active ? cfg.textColor : 'text-gray-400'}`} />
                  <p className={`font-semibold ${active ? cfg.textColor : 'text-gray-700'}`}>{cfg.label}</p>
                </button>
              )
            })}
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-2xl border p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">CC Owner *</label>
            <select
              value={ccId}
              onChange={(e) => setCcId(e.target.value)}
              className="w-full h-9 px-3 border rounded-lg text-sm bg-white dark:bg-gray-800"
            >
              <option value="">Pilih kartu</option>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.card_label} {c.last4 ? `• ${c.last4}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tanggal Checkout</label>
            <input
              type="date"
              value={checkoutDate}
              onChange={(e) => setCheckoutDate(e.target.value)}
              className="w-full h-9 px-3 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Catatan</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full h-9 px-3 border rounded-lg text-sm"
            />
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-2xl border p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">PILIH ITEM DARI PO</h2>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="h-9 px-3 border rounded-lg text-sm max-w-xs"
            >
              <option value="">Semua Cabang</option>
              {branchOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {isMultiBranch && (
            <div className="mb-3 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
              ⚠️ Item dari lebih dari satu cabang dipilih. Satu session hanya boleh untuk satu cabang.
            </div>
          )}

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : pendingLines.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              Tidak ada item PO yang menunggu checkout untuk platform ini.
            </p>
          ) : (
            <div className="space-y-4">
              {Object.entries(grouped).map(([branch, lines]) => (
                <div key={branch} className="border rounded-xl overflow-hidden">
                  <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 font-medium text-sm">{branch}</div>
                  <div className="divide-y">
                    {lines.map((line) => {
                      const selected = selectedLines.get(line.po_line_id)
                      const remaining = Number(line.qty) - Number(line.qty_received)
                      return (
                        <div key={line.po_line_id} className="p-4 flex flex-col sm:flex-row gap-3">
                          <label className="flex items-start gap-2 flex-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!selected}
                              onChange={(e) => toggleLine(line, e.target.checked)}
                              className="mt-1"
                            />
                            <div>
                              <p className="font-medium text-sm">
                                [{line.product_code}] {line.product_name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {line.po_number} · Sisa: {remaining} {line.uom} · PO @{' '}
                                {fmtCurrency(line.unit_price)}
                              </p>
                            </div>
                          </label>
                          {selected && (
                            <div className="flex gap-2 sm:w-64">
                              <input
                                type="number"
                                min={0}
                                value={selected.qty}
                                onChange={(e) =>
                                  updateLine(line.po_line_id, 'qty', Number(e.target.value))
                                }
                                className="w-20 h-8 px-2 border rounded text-sm"
                                placeholder="Qty"
                              />
                              <input
                                type="number"
                                min={0}
                                value={selected.unit_price_netto}
                                onChange={(e) =>
                                  updateLine(line.po_line_id, 'unit_price_netto', Number(e.target.value))
                                }
                                className="flex-1 h-8 px-2 border rounded text-sm"
                                placeholder="Harga netto"
                              />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t px-6 py-4 flex justify-between items-center">
        <p className="text-lg font-bold">Total: {fmtCurrency(total)}</p>
        {canInsert && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={createSession.isPending}
            className="px-6 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium"
          >
            Simpan Session
          </button>
        )}
      </div>
    </div>
  )
}
