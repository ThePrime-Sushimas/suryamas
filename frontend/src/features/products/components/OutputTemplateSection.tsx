import { useState } from 'react'
import { Plus, Trash2, Save, ChevronDown, ChevronUp, Package } from 'lucide-react'
import { useProductOutputTemplate, useSaveProductOutputTemplate } from '@/features/goods-processing/api/goodsProcessing.api'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { ProductPickerModal } from '@/components/shared/ProductPickerModal'

// Define PickedProduct interface inline since it might not be exported
interface PickedProduct {
  id: string
  name: string
  uom_base: string
}

interface TemplateRow {
  output_product_id: string
  output_product_name: string  // display only
  output_uom: string
  suggested_pct: number | null
  sort_order: number
  notes: string | null
}

interface Props {
  productId: string
  productName: string
}

export function OutputTemplateSection({ productId, productName }: Props) {
  const { addToast } = useToast()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<TemplateRow[]>([])
  const [dirty, setDirty] = useState(false)
  const [productPickerOpen, setProductPickerOpen] = useState(false)
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null)

  const { data: template, isLoading } = useProductOutputTemplate(productId)
  const saveMut = useSaveProductOutputTemplate(productId)

  // Sync from server when first opened
  const handleOpen = () => {
    if (!open && template) {
      setRows(
        template.map((t, i) => ({
          output_product_id: t.output_product_id,
          output_product_name: t.output_product_name,
          output_uom: t.output_uom,
          suggested_pct: t.suggested_pct,
          sort_order: i,
          notes: t.notes,
        }))
      )
      setDirty(false)
    }
    setOpen((v) => !v)
  }

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        output_product_id: '',
        output_product_name: '',
        output_uom: '',
        suggested_pct: null,
        sort_order: prev.length,
        notes: null,
      },
    ])
    setDirty(true)
  }

  const removeRow = (i: number) => {
    setRows((prev) => prev.filter((_, idx) => idx !== i))
    setDirty(true)
  }

  const updateRow = (i: number, field: keyof TemplateRow, value: unknown) => {
    setRows((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r))
    )
    setDirty(true)
  }

  const handleSave = async () => {
    // Validate
    for (const r of rows) {
      if (!r.output_product_id || !r.output_uom) {
        addToast('error', 'Isi product ID dan UOM untuk semua baris')
        return
      }
    }
    try {
      await saveMut.mutateAsync({
        items: rows.map((r, i) => ({
          output_product_id: r.output_product_id,
          output_uom: r.output_uom,
          suggested_pct: r.suggested_pct,
          sort_order: i,
          notes: r.notes,
        })),
      })
      addToast('success', 'Template disimpan')
      setDirty(false)
    } catch (e) {
      addToast('error', parseApiError(e, 'Gagal menyimpan template'))
    }
  }

  const totalPct = rows.reduce((s, r) => s + (r.suggested_pct ?? 0), 0)

  const openProductPicker = (index: number) => {
    setEditingRowIndex(index)
    setProductPickerOpen(true)
  }

  const handleProductSelect = (product: PickedProduct) => {
    if (editingRowIndex !== null) {
      updateRow(editingRowIndex, 'output_product_id', product.id)
      updateRow(editingRowIndex, 'output_product_name', product.name)
      updateRow(editingRowIndex, 'output_uom', product.uom_base)
    }
    setProductPickerOpen(false)
    setEditingRowIndex(null)
  }

  const handlePickerClose = () => {
    setProductPickerOpen(false)
    setEditingRowIndex(null)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header toggle */}
      <button
        type="button"
        onClick={handleOpen}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            🔀 Output Template (Disassembly)
          </span>
          {template && template.length > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded-full">
              {template.length} output
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {open && (
        <div className="border-t border-gray-100 dark:border-gray-700 p-5 space-y-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Template ini akan otomatis muncul saat{' '}
            <strong className="text-gray-700 dark:text-gray-300">{productName}</strong> diproses
            sebagai input disassembly di Goods Processing.
          </p>

          {isLoading ? (
            <div className="h-12 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
          ) : (
            <>
              {/* Table */}
              {rows.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                        <th className="text-left pb-2 pr-3">Product ID Output</th>
                        <th className="text-left pb-2 pr-3">UOM</th>
                        <th className="text-left pb-2 pr-3">Yield % (opsional)</th>
                        <th className="text-left pb-2 pr-3">Catatan</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                      {rows.map((row, i) => (
                        <tr key={i}>
                          <td className="py-2 pr-3">
                            {row.output_product_id && row.output_product_name ? (
                              <div className="flex items-center gap-2">
                                <div className="flex-1 px-2 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg">
                                  <p className="text-xs text-gray-900 dark:text-white truncate">{row.output_product_name}</p>
                                  <p className="text-[10px] text-gray-400 font-mono truncate">{row.output_product_id}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => openProductPicker(i)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                >
                                  <Package size={14} />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openProductPicker(i)}
                                className="w-full flex items-center justify-center gap-2 px-3 py-1.5 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-gray-500 dark:text-gray-400 text-xs"
                              >
                                <Package size={14} />
                                Pilih Produk Output
                              </button>
                            )}
                          </td>
                          <td className="py-2 pr-3">
                            <input
                              type="text"
                              value={row.output_uom}
                              onChange={(e) => updateRow(i, 'output_uom', e.target.value)}
                              placeholder="kg, pcs..."
                              className="w-24 px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                          </td>
                          <td className="py-2 pr-3">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.1}
                                value={row.suggested_pct ?? ''}
                                onChange={(e) =>
                                  updateRow(i, 'suggested_pct', e.target.value ? parseFloat(e.target.value) : null)
                                }
                                placeholder="—"
                                className="w-20 px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs text-right focus:outline-none focus:ring-2 focus:ring-blue-400"
                              />
                              <span className="text-xs text-gray-400">%</span>
                            </div>
                          </td>
                          <td className="py-2 pr-3">
                            <input
                              type="text"
                              value={row.notes ?? ''}
                              onChange={(e) => updateRow(i, 'notes', e.target.value || null)}
                              placeholder="—"
                              className="w-full px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                          </td>
                          <td className="py-2">
                            <button
                              type="button"
                              onClick={() => removeRow(i)}
                              className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Yield total warning */}
                  {totalPct > 0 && (
                    <p className={`text-xs mt-2 ${totalPct > 100 ? 'text-red-600' : totalPct === 100 ? 'text-green-600' : 'text-gray-500'}`}>
                      Total yield: {totalPct.toFixed(1)}%{totalPct > 100 ? ' ⚠ melebihi 100%' : totalPct === 100 ? ' ✓' : ' (belum 100%)'}
                    </p>
                  )}
                </div>
              )}

              {rows.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">
                  Belum ada template. Klik "+ Tambah Output" untuk mulai.
                </p>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={addRow}
                  className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                >
                  <Plus size={13} /> Tambah Output
                </button>
                {dirty && (
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saveMut.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    <Save size={13} />
                    {saveMut.isPending ? 'Menyimpan...' : 'Simpan Template'}
                  </button>
                )}
              </div>
            </>
          )}

          {/* Product Picker Modal */}
          <ProductPickerModal
            open={productPickerOpen}
            onClose={handlePickerClose}
            onSelect={handleProductSelect}
            title="Pilih Produk Output"
          />
        </div>
      )}
    </div>
  )
}