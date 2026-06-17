import { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2, Search, Layers, X } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import Pagination from '@/components/ui/Pagination'
import { AccountSelector } from '@/features/accounting/journals/shared/AccountSelector'
import { useDebounce } from '@/hooks/_shared/useDebounce'
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  type AssetCategory,
  type CreateCategoryDto,
  type UpdateCategoryDto,
} from '../api/fixed-assets.api'

// ─── Category Form Modal ─────────────────────────────────────────────────────

interface CategoryFormModalProps {
  open: boolean
  onClose: () => void
  editCategory: AssetCategory | null
}

function CategoryFormModal({ open, onClose, editCategory }: CategoryFormModalProps) {
  const toast = useToast()
  const createMutation = useCreateCategory()
  const updateMutation = useUpdateCategory()
  const isEdit = !!editCategory

  const [form, setForm] = useState({
    category_code: '',
    category_name: '',
    asset_coa_id: '',
    depreciation_expense_coa_id: '',
    accumulated_depreciation_coa_id: '',
    default_useful_life_months: 60,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    if (editCategory) {
      setForm({
        category_code: editCategory.category_code,
        category_name: editCategory.category_name,
        asset_coa_id: editCategory.asset_coa_id,
        depreciation_expense_coa_id: editCategory.depreciation_expense_coa_id,
        accumulated_depreciation_coa_id: editCategory.accumulated_depreciation_coa_id,
        default_useful_life_months: editCategory.default_useful_life_months,
      })
    } else {
      setForm({
        category_code: '',
        category_name: '',
        asset_coa_id: '',
        depreciation_expense_coa_id: '',
        accumulated_depreciation_coa_id: '',
        default_useful_life_months: 60,
      })
    }
    setErrors({})
  }, [open, editCategory])

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!form.category_code.trim()) errs.category_code = 'Kode kategori wajib diisi'
    if (form.category_code.length > 10) errs.category_code = 'Maksimal 10 karakter'
    if (!form.category_name.trim()) errs.category_name = 'Nama kategori wajib diisi'
    if (!form.asset_coa_id) errs.asset_coa_id = 'Akun aset wajib dipilih'
    if (!form.depreciation_expense_coa_id) errs.depreciation_expense_coa_id = 'Akun beban penyusutan wajib dipilih'
    if (!form.accumulated_depreciation_coa_id) errs.accumulated_depreciation_coa_id = 'Akun akumulasi penyusutan wajib dipilih'
    if (!form.default_useful_life_months || form.default_useful_life_months < 1) {
      errs.default_useful_life_months = 'Umur manfaat harus minimal 1 bulan'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    try {
      if (isEdit) {
        const body: UpdateCategoryDto = {
          category_name: form.category_name,
          asset_coa_id: form.asset_coa_id,
          depreciation_expense_coa_id: form.depreciation_expense_coa_id,
          accumulated_depreciation_coa_id: form.accumulated_depreciation_coa_id,
          default_useful_life_months: form.default_useful_life_months,
        }
        await updateMutation.mutateAsync({ id: editCategory!.id, body })
        toast.success('Kategori berhasil diperbarui')
      } else {
        const body: CreateCategoryDto = {
          category_code: form.category_code,
          category_name: form.category_name,
          asset_coa_id: form.asset_coa_id,
          depreciation_expense_coa_id: form.depreciation_expense_coa_id,
          accumulated_depreciation_coa_id: form.accumulated_depreciation_coa_id,
          default_useful_life_months: form.default_useful_life_months,
        }
        await createMutation.mutateAsync(body)
        toast.success('Kategori berhasil dibuat')
      }
      onClose()
    } catch (err: unknown) {
      toast.error(parseApiError(err, isEdit ? 'Gagal memperbarui kategori' : 'Gagal membuat kategori'))
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 dark:bg-black/70 overflow-y-auto py-6 px-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">
            {isEdit ? 'Edit Kategori Aset' : 'Tambah Kategori Aset'}
          </h2>
          <button type="button" onClick={onClose} disabled={isPending} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <X size={18} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Category Code & Name */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Kode Kategori *</label>
              <input
                type="text"
                value={form.category_code}
                onChange={(e) => setForm(prev => ({ ...prev, category_code: e.target.value.toUpperCase() }))}
                disabled={isEdit}
                maxLength={10}
                placeholder="e.g. KND"
                className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                  errors.category_code ? 'border-red-400' : 'border-gray-200 dark:border-gray-600'
                } ${isEdit ? 'bg-gray-50 dark:bg-gray-600 cursor-not-allowed' : ''}`}
              />
              {errors.category_code && <p className="text-xs text-red-500">{errors.category_code}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Umur Manfaat (bulan) *</label>
              <input
                type="number"
                value={form.default_useful_life_months}
                onChange={(e) => setForm(prev => ({ ...prev, default_useful_life_months: parseInt(e.target.value) || 0 }))}
                min={1}
                className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                  errors.default_useful_life_months ? 'border-red-400' : 'border-gray-200 dark:border-gray-600'
                }`}
              />
              {errors.default_useful_life_months && <p className="text-xs text-red-500">{errors.default_useful_life_months}</p>}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Nama Kategori *</label>
            <input
              type="text"
              value={form.category_name}
              onChange={(e) => setForm(prev => ({ ...prev, category_name: e.target.value }))}
              placeholder="e.g. Kendaraan"
              className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                errors.category_name ? 'border-red-400' : 'border-gray-200 dark:border-gray-600'
              }`}
            />
            {errors.category_name && <p className="text-xs text-red-500">{errors.category_name}</p>}
          </div>

          {/* COA Selectors */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Akun Aset (COA) *</label>
            <AccountSelector
              value={form.asset_coa_id}
              onChange={(id) => setForm(prev => ({ ...prev, asset_coa_id: id }))}
              placeholder="Pilih akun aset..."
              priorityPrefix={['1']}
            />
            {errors.asset_coa_id && <p className="text-xs text-red-500">{errors.asset_coa_id}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Akun Beban Penyusutan (COA) *</label>
            <AccountSelector
              value={form.depreciation_expense_coa_id}
              onChange={(id) => setForm(prev => ({ ...prev, depreciation_expense_coa_id: id }))}
              placeholder="Pilih akun beban penyusutan..."
              priorityPrefix={['6']}
            />
            {errors.depreciation_expense_coa_id && <p className="text-xs text-red-500">{errors.depreciation_expense_coa_id}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Akun Akumulasi Penyusutan (COA) *</label>
            <AccountSelector
              value={form.accumulated_depreciation_coa_id}
              onChange={(id) => setForm(prev => ({ ...prev, accumulated_depreciation_coa_id: id }))}
              placeholder="Pilih akun akumulasi penyusutan..."
              priorityPrefix={['1']}
            />
            {errors.accumulated_depreciation_coa_id && <p className="text-xs text-red-500">{errors.accumulated_depreciation_coa_id}</p>}
          </div>
        </div>

        <div className="flex gap-3 justify-end px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button type="button" onClick={onClose} disabled={isPending}
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
            Batal
          </button>
          <button type="button" onClick={handleSubmit} disabled={isPending}
            className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-60">
            {isPending ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AssetCategoriesPage() {
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const debouncedSearch = useDebounce(search, 400)

  // Modal state
  const [formOpen, setFormOpen] = useState(false)
  const [editCategory, setEditCategory] = useState<AssetCategory | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AssetCategory | null>(null)

  // Data
  const { data, isLoading } = useCategories({
    page,
    limit,
    search: debouncedSearch || undefined,
  })
  const deleteMutation = useDeleteCategory()

  const categories = data?.data ?? []
  const pagination = data?.pagination

  const handleSearchChange = (v: string) => { setSearch(v); setPage(1) }

  const handleOpenCreate = () => {
    setEditCategory(null)
    setFormOpen(true)
  }

  const handleOpenEdit = (cat: AssetCategory) => {
    setEditCategory(cat)
    setFormOpen(true)
  }

  const handleCloseForm = () => {
    setFormOpen(false)
    setEditCategory(null)
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteMutation.mutateAsync(deleteTarget.id)
      toast.success('Kategori berhasil dihapus')
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal menghapus kategori'))
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Layers className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Kategori Aset</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{pagination?.total ?? 0} total</p>
            </div>
          </div>
          <button onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
            <Plus className="w-4 h-4" /> Tambah Kategori
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cari kategori..."
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
          />
          {search && (
            <button onClick={() => handleSearchChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Memuat data...</div>
          ) : categories.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Layers size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Tidak ada kategori aset</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Kode</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Nama Kategori</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Umur Manfaat</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Status</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {categories.map((cat) => (
                    <tr key={cat.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-900 dark:text-gray-100">{cat.category_code}</td>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{cat.category_name}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{cat.default_useful_life_months} bulan</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          cat.is_active
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            : 'bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
                        }`}>
                          {cat.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(cat)}
                            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400"
                            title="Edit kategori"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(cat)}
                            className="p-1.5 rounded-md text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                            title="Hapus kategori"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {pagination && pagination.total > 0 && (
          <div className="mt-4">
            <Pagination
              pagination={pagination}
              onPageChange={setPage}
              onLimitChange={(l) => { setLimit(l); setPage(1) }}
              currentLength={categories.length}
              loading={isLoading}
            />
          </div>
        )}
      </div>

      {/* Form Modal */}
      <CategoryFormModal
        open={formOpen}
        onClose={handleCloseForm}
        editCategory={editCategory}
      />

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Hapus Kategori Aset"
        message={`Yakin ingin menghapus kategori "${deleteTarget?.category_name}"? Kategori yang sudah digunakan oleh aset tidak dapat dihapus.`}
        confirmText="Hapus"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
