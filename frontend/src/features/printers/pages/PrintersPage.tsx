import { useState } from 'react'
import { Printer as PrinterIcon, Plus, Trash2, Wifi, Star } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { usePrinters, useCreatePrinter, useUpdatePrinter, useDeletePrinter, useTestPrinter } from '../api'
import type { CreatePrinterDto, Printer } from '../types'

export default function PrintersPage() {
  const toast = useToast()
  const { data: printers = [], isLoading } = usePrinters()
  const createPrinter = useCreatePrinter()
  const updatePrinter = useUpdatePrinter()
  const deletePrinter = useDeletePrinter()
  const testPrinter = useTestPrinter()

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [form, setForm] = useState<CreatePrinterDto>({ printer_name: '', ip_address: '', port: 9100, paper_width: 80, is_default: false })

  const resetForm = () => { setForm({ printer_name: '', ip_address: '', port: 9100, paper_width: 80, is_default: false }); setEditId(null); setShowForm(false) }

  const handleEdit = (p: Printer) => {
    setForm({ printer_name: p.printer_name, ip_address: p.ip_address, port: p.port, paper_width: p.paper_width, is_default: p.is_default, is_active: p.is_active })
    setEditId(p.id)
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editId) {
        await updatePrinter.mutateAsync({ id: editId, ...form })
        toast.success('Printer diperbarui')
      } else {
        await createPrinter.mutateAsync(form)
        toast.success('Printer ditambahkan')
      }
      resetForm()
    } catch (err) { toast.error(parseApiError(err, 'Gagal menyimpan printer')) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus printer ini?')) return
    try { await deletePrinter.mutateAsync(id); toast.success('Printer dihapus') }
    catch (err) { toast.error(parseApiError(err, 'Gagal menghapus')) }
  }

  const handleTest = async (id: string) => {
    setTestingId(id)
    try {
      const connected = await testPrinter.mutateAsync(id)
      toast[connected ? 'success' : 'error'](connected ? 'Printer terhubung ✓' : 'Printer tidak dapat dijangkau')
    } catch (err) { toast.error(parseApiError(err, 'Gagal test koneksi')) }
    finally { setTestingId(null) }
  }

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 lg:p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PrinterIcon className="w-6 h-6 text-indigo-600" />
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Printer Settings</h1>
          </div>
          <button onClick={() => { resetForm(); setShowForm(true) }} className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
            <Plus className="w-4 h-4" /> Tambah Printer
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Printer *</label>
                <input type="text" value={form.printer_name} onChange={e => setForm(f => ({ ...f, printer_name: e.target.value }))} required
                  placeholder="misal: Printer Gudang" className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">IP Address *</label>
                  <input type="text" value={form.ip_address} onChange={e => setForm(f => ({ ...f, ip_address: e.target.value }))} required
                    placeholder="192.168.1.100" className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Port *</label>
                  <input type="number" value={form.port} onChange={e => setForm(f => ({ ...f, port: parseInt(e.target.value) || 9100 }))} required
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={form.is_default} onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))} className="rounded border-gray-300 text-indigo-600" />
                Default Printer
              </label>
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span className="text-xs">Lebar kertas:</span>
                <select value={form.paper_width} onChange={e => setForm(f => ({ ...f, paper_width: parseInt(e.target.value) }))} className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                  <option value={80}>80mm</option>
                  <option value={58}>58mm</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={createPrinter.isPending || updatePrinter.isPending}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {editId ? 'Simpan' : 'Tambah'}
              </button>
              <button type="button" onClick={resetForm} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg">Batal</button>
            </div>
          </form>
        )}

        {/* List */}
        <div className="space-y-2">
          {printers.length === 0 && <p className="text-center text-gray-400 py-8">Belum ada printer terdaftar</p>}
          {printers.map(p => (
            <div key={p.id} className="bg-white dark:bg-gray-800 rounded-lg shadow px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <PrinterIcon className={`w-5 h-5 ${p.is_active ? 'text-indigo-600' : 'text-gray-400'}`} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-900 dark:text-white">{p.printer_name}</span>
                    {p.is_default && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                    {!p.is_active && <span className="text-xs text-red-500">Nonaktif</span>}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{p.ip_address}:{p.port} • {p.paper_width}mm{p.branch_name ? ` • ${p.branch_name}` : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => handleTest(p.id)} disabled={testingId === p.id} title="Test koneksi"
                  className="p-1.5 text-gray-400 hover:text-green-600 rounded">
                  <Wifi className={`w-4 h-4 ${testingId === p.id ? 'animate-pulse' : ''}`} />
                </button>
                <button onClick={() => handleEdit(p)} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded text-xs">Edit</button>
                <button onClick={() => handleDelete(p.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
