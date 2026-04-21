import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp,
  Save, X, Loader2, Palette, Check
} from 'lucide-react'
import { useGroups, useCreateGroup, useUpdateGroup, useDeleteGroup } from '../api/useCashFlowApi'
import type { PaymentMethodGroup, AvailablePaymentMethod, CreateGroupPayload, UpdateGroupPayload } from '../types/cash-flow.types'
import { useToast } from '@/contexts/ToastContext'

// ============================================================
// Preset Colors
// ============================================================
const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#06b6d4', '#64748b', '#1e293b',
]

const ColorPicker = ({ value, onChange }: { value: string; onChange: (c: string) => void }) => (
  <div className="flex flex-wrap gap-1.5">
    {COLORS.map(c => (
      <button
        key={c} type="button" onClick={() => onChange(c)}
        className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 ${value === c ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : ''}`}
        style={{ backgroundColor: c }}
      >
        {value === c && <Check className="w-3.5 h-3.5 text-white" />}
      </button>
    ))}
  </div>
)

// ============================================================
// Payment Method Chip (toggleable)
// ============================================================
const PaymentMethodChip = ({
  pm, selected, onClick, color
}: {
  pm: AvailablePaymentMethod
  selected: boolean
  onClick: () => void
  color: string
}) => (
  <button
    type="button" onClick={onClick}
    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
      selected
        ? 'text-white shadow-sm'
        : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
    }`}
    style={selected ? { backgroundColor: color } : {}}
  >
    {pm.name}
  </button>
)

// ============================================================
// Group Card
// ============================================================
const GroupCard = ({
  group, allMethods, onSave, onDelete, isSaving, isDeleting
}: {
  group: PaymentMethodGroup
  allMethods: AvailablePaymentMethod[]
  onSave: (payload: UpdateGroupPayload) => void
  onDelete: () => void
  isSaving: boolean
  isDeleting: boolean
}) => {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(group.name)
  const [color, setColor] = useState(group.color)
  const [selectedIds, setSelectedIds] = useState<number[]>(group.mappings?.map(m => m.payment_method_id) || [])
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Reset state when group data changes (after save)
  useEffect(() => {
    setName(group.name)
    setColor(group.color)
    setSelectedIds(group.mappings?.map(m => m.payment_method_id) || [])
  }, [group])

  const toggle = (id: number) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const handleSave = () => {
    onSave({ name, color, payment_method_ids: selectedIds })
    setEditing(false)
  }

  const handleCancel = () => {
    setName(group.name)
    setColor(group.color)
    setSelectedIds(group.mappings?.map(m => m.payment_method_id) || [])
    setEditing(false)
    setConfirmDelete(false)
  }

  // Eligible: unassigned OR already in this group
  const eligible = allMethods.filter(m => m.current_group_id === null || m.current_group_id === group.id)
  const assignedNames = allMethods.filter(m => selectedIds.includes(m.id)).map(m => m.name)

  return (
    <div className={`rounded-xl border-2 transition-all ${editing ? 'border-indigo-300 dark:border-indigo-600 bg-white dark:bg-gray-800 shadow-lg' : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm'}`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3.5 cursor-pointer" onClick={() => !editing && setOpen(!open)}>
        <div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: group.color }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{group.name}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
            {assignedNames.length > 0 ? assignedNames.join(', ') : 'Belum ada metode pembayaran'}
          </p>
        </div>
        <span className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-700 px-2 py-0.5 rounded-full flex-shrink-0">
          {group.mappings?.length || 0}
        </span>
        {!editing && (
          <button
            onClick={e => { e.stopPropagation(); setEditing(true); setOpen(true) }}
            className="text-xs text-indigo-600 hover:underline flex-shrink-0"
          >
            Edit
          </button>
        )}
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </div>

      {/* Body */}
      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-50 dark:border-gray-700 pt-4">
          {editing ? (
            <>
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Nama Group</label>
                <input
                  value={name} onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              </div>

              {/* Color */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Warna</label>
                <ColorPicker value={color} onChange={setColor} />
              </div>

              {/* Payment methods */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Metode Pembayaran — klik untuk assign/unassign
                </label>
                {eligible.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {eligible.map(m => (
                      <PaymentMethodChip
                        key={m.id} pm={m}
                        selected={selectedIds.includes(m.id)}
                        onClick={() => toggle(m.id)}
                        color={color}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">Semua metode sudah di-assign ke group lain.</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-between items-center pt-2">
                {confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-600">Yakin hapus?</span>
                    <button onClick={onDelete} disabled={isDeleting}
                      className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 disabled:opacity-50">
                      {isDeleting && <Loader2 className="w-3 h-3 animate-spin inline mr-1" />}Hapus
                    </button>
                    <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg">Batal</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(true)} className="text-xs text-red-500 hover:underline flex items-center gap-1">
                    <Trash2 className="w-3.5 h-3.5" /> Hapus Group
                  </button>
                )}
                <div className="flex gap-2">
                  <button onClick={handleCancel} className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-1">
                    <X className="w-3.5 h-3.5" /> Batal
                  </button>
                  <button onClick={handleSave} disabled={isSaving || !name.trim()}
                    className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1">
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Simpan
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* View mode */
            <div className="flex flex-wrap gap-1.5">
              {assignedNames.length > 0 ? assignedNames.map(n => (
                <span key={n} className="px-2.5 py-1 text-xs font-medium text-white rounded-full" style={{ backgroundColor: group.color }}>
                  {n}
                </span>
              )) : (
                <p className="text-xs text-gray-400 italic">Klik "Edit" untuk menambahkan metode pembayaran.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Group Card Wrapper (own mutation hooks)
// ============================================================
const GroupCardWrapper = ({ group, allMethods }: { group: PaymentMethodGroup; allMethods: AvailablePaymentMethod[] }) => {
  const toast = useToast()
  const updateMutation = useUpdateGroup(group.id)
  const deleteMutation = useDeleteGroup(group.id)

  return (
    <GroupCard
      group={group}
      allMethods={allMethods}
      onSave={async (payload) => {
        try { await updateMutation.mutateAsync(payload); toast.success('Group diperbarui') }
        catch (e: any) { toast.error(e?.response?.data?.message || 'Gagal memperbarui') }
      }}
      onDelete={async () => {
        try { await deleteMutation.mutateAsync(); toast.success('Group dihapus') }
        catch (e: any) { toast.error(e?.response?.data?.message || 'Gagal menghapus') }
      }}
      isSaving={updateMutation.isPending}
      isDeleting={deleteMutation.isPending}
    />
  )
}

// ============================================================
// Create Group Inline
// ============================================================
const CreateGroupInline = ({
  allMethods, onSubmit, onCancel, isLoading
}: {
  allMethods: AvailablePaymentMethod[]
  onSubmit: (p: CreateGroupPayload) => void
  onCancel: () => void
  isLoading: boolean
}) => {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#6366f1')
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  const unassigned = allMethods.filter(m => m.current_group_id === null)
  const toggle = (id: number) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  return (
    <div className="bg-indigo-50/70 dark:bg-indigo-900/20 border-2 border-indigo-200 dark:border-indigo-700 rounded-xl p-5 space-y-4">
      <p className="text-sm font-bold text-indigo-900 dark:text-indigo-300">Buat Group Baru</p>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Nama Group</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="cth: Penjualan Online"
          className="w-full px-3 py-2 text-sm border border-indigo-200 dark:border-indigo-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" autoFocus />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Warna</label>
        <ColorPicker value={color} onChange={setColor} />
      </div>

      {unassigned.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Metode Pembayaran (opsional)</label>
          <div className="flex flex-wrap gap-2">
            {unassigned.map(m => (
              <PaymentMethodChip key={m.id} pm={m} selected={selectedIds.includes(m.id)} onClick={() => toggle(m.id)} color={color} />
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:bg-white rounded-lg">Batal</button>
        <button onClick={() => name.trim() && onSubmit({ name: name.trim(), color, payment_method_ids: selectedIds })}
          disabled={isLoading || !name.trim()}
          className="px-5 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />} Buat Group
        </button>
      </div>
    </div>
  )
}

// ============================================================
// Main Page
// ============================================================
export const CashFlowSettingsPage = () => {
  const toast = useToast()
  const { data, isLoading } = useGroups()
  const createMutation = useCreateGroup()
  const [showCreate, setShowCreate] = useState(false)

  const groups = data?.groups || []
  const allMethods = data?.available_payment_methods || []
  const unassignedCount = allMethods.filter(m => m.current_group_id === null).length

  const handleCreate = async (payload: CreateGroupPayload) => {
    try {
      await createMutation.mutateAsync(payload)
      toast.success('Group berhasil dibuat')
      setShowCreate(false)
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Gagal membuat group')
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 dark:bg-gray-900 min-h-screen">
      {/* Back + Header */}
      <div className="mb-8">
        <Link to="/cash-flow" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Kembali ke Cash Flow
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Konfigurasi Cash Flow</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Buat group lalu assign metode pembayaran ke dalamnya. Group ini akan muncul sebagai kategori di halaman Cash Flow.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* Guide for first-time users */}
          {groups.length === 0 && !showCreate && (
            <div className="text-center py-16 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl mb-4">
              <Palette className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm mb-1">Belum ada group.</p>
              <p className="text-gray-400 text-xs mb-5">Buat group pertama untuk mengelompokkan metode pembayaran.</p>
              <button onClick={() => setShowCreate(true)}
                className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 inline-flex items-center gap-2">
                <Plus className="w-4 h-4" /> Buat Group Pertama
              </button>
            </div>
          )}

          {/* Unassigned warning */}
          {groups.length > 0 && unassignedCount > 0 && (
            <div className="mb-5 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-400 mb-1.5">
                {unassignedCount} metode pembayaran belum masuk group manapun
              </p>
              <div className="flex flex-wrap gap-1.5">
                {allMethods.filter(m => m.current_group_id === null).map(m => (
                  <span key={m.id} className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">{m.name}</span>
                ))}
              </div>
            </div>
          )}

          {/* Groups */}
          <div className="space-y-3 mb-4">
            {groups.map(g => <GroupCardWrapper key={g.id} group={g} allMethods={allMethods} />)}
          </div>

          {/* Create */}
          {showCreate ? (
            <CreateGroupInline allMethods={allMethods} onSubmit={handleCreate} onCancel={() => setShowCreate(false)} isLoading={createMutation.isPending} />
          ) : groups.length > 0 && (
            <button onClick={() => setShowCreate(true)}
              className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-500 hover:border-indigo-300 dark:hover:border-indigo-600 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all">
              <Plus className="w-4 h-4" /> Tambah Group
            </button>
          )}
        </>
      )}
    </div>
  )
}
