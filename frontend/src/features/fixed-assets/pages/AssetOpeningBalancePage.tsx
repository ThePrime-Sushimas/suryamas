import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Calculator, Package, Loader2 } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useUserBranches } from '@/hooks/_shared/useUserBranches'
import { ProductPickerModal } from '@/components/shared/ProductPickerModal'
import type { PickedProduct } from '@/components/shared/ProductPickerModal'
import {
  useCategories,
  useEquityAccounts,
  useDepreciationPreview,
  useCreateOpeningBalance,
  type CreateOpeningBalanceDto,
} from '../api/fixed-assets.api'

const today = () => new Date().toISOString().split('T')[0]
const fmtCurrency = (n: number) => `Rp ${n.toLocaleString('id-ID')}`

export default function AssetOpeningBalancePage() {
  const navigate = useNavigate()
  const toast = useToast()
  const branches = useUserBranches()
  const createMutation = useCreateOpeningBalance()

  // Form state
  const [branchId, setBranchId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [productId, setProductId] = useState('')
  const [productName, setProductName] = useState('')
  const [assetName, setAssetName] = useState('')
  const [acquisitionDate, setAcquisitionDate] = useState('')
  const [cost, setCost] = useState('')
  const [salvageValue, setSalvageValue] = useState('0')
  const [usefulLifeMonths, setUsefulLifeMonths] = useState('')
  const [accumDeprMode, setAccumDeprMode] = useState<'manual' | 'auto'>('auto')
  const [manualAccumDepr, setManualAccumDepr] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [uom, setUom] = useState('PCS')
  const [equityCoaId, setEquityCoaId] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [locationNote, setLocationNote] = useState('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [showProductModal, setShowProductModal] = useState(false)
  const [result, setResult] = useState<{ asset_code: string; journal_id: string } | null>(null)

  // Data queries
  const { data: categoriesData } = useCategories({ limit: 100, is_active: true })
  const { data: equityAccounts = [] } = useEquityAccounts()
  const categories = categoriesData?.data ?? []

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId),
    [categories, categoryId],
  )
  const isPooled = selectedCategory?.tracking_method === 'POOLED'

  // Auto-fill useful_life from category default
  useEffect(() => {
    if (selectedCategory && !usefulLifeMonths) {
      setUsefulLifeMonths(String(selectedCategory.default_useful_life_months))
    }
  }, [selectedCategory, usefulLifeMonths])

  // Auto-select first equity account with "Modal" in name as default
  useEffect(() => {
    if (equityAccounts.length > 0 && !equityCoaId) {
      const modalAccount = equityAccounts.find(
        (a) => a.account_name.toLowerCase().includes('modal'),
      )
      setEquityCoaId(modalAccount?.id ?? equityAccounts[0].id)
    }
  }, [equityAccounts, equityCoaId])

  // Depreciation preview (auto mode)
  const previewParams = useMemo(() => {
    if (accumDeprMode !== 'auto') return null
    const c = Number(cost) || 0
    const s = Number(salvageValue) || 0
    const u = Number(usefulLifeMonths) || 0
    if (!acquisitionDate || c <= 0 || u <= 0) return null
    return { acquisition_date: acquisitionDate, cost: c, salvage_value: s, useful_life_months: u }
  }, [accumDeprMode, acquisitionDate, cost, salvageValue, usefulLifeMonths])

  const { data: deprPreview } = useDepreciationPreview(previewParams)

  const accumulatedDepreciation = useMemo(() => {
    if (accumDeprMode === 'manual') return Number(manualAccumDepr) || 0
    return deprPreview?.estimated_accumulated_depreciation ?? 0
  }, [accumDeprMode, manualAccumDepr, deprPreview])

  const bookValue = (Number(cost) || 0) - accumulatedDepreciation

  const handleProductSelect = (product: PickedProduct) => {
    setProductId(product.id)
    setProductName(`${product.code} - ${product.name}`)
    setAssetName(product.name)
    setShowProductModal(false)
  }

  const handleSubmit = async () => {
    if (!branchId) { toast.error('Pilih cabang'); return }
    if (!categoryId) { toast.error('Pilih kategori aset'); return }
    if (!productId) { toast.error('Pilih produk'); return }
    if (!assetName.trim()) { toast.error('Nama aset wajib diisi'); return }
    if (!acquisitionDate) { toast.error('Tanggal perolehan wajib diisi'); return }
    if (!cost || Number(cost) <= 0) { toast.error('Harga perolehan harus > 0'); return }
    if (!equityCoaId) { toast.error('Pilih akun ekuitas'); return }

    const maxDepr = (Number(cost) || 0) - (Number(salvageValue) || 0)
    if (accumulatedDepreciation > maxDepr) {
      toast.error(`Akumulasi penyusutan tidak boleh melebihi ${fmtCurrency(maxDepr)}`)
      return
    }

    const body: CreateOpeningBalanceDto = {
      branch_id: branchId,
      asset_category_id: categoryId,
      product_id: productId,
      asset_name: assetName.trim(),
      acquisition_date: acquisitionDate,
      cost: Number(cost),
      salvage_value: Number(salvageValue) || 0,
      useful_life_months: Number(usefulLifeMonths) || undefined,
      accumulated_depreciation: accumulatedDepreciation,
      equity_coa_id: equityCoaId,
      serial_number: serialNumber.trim() || null,
      location_note: locationNote.trim() || null,
      description: description.trim() || null,
      notes: notes.trim() || null,
    }
    if (isPooled) {
      body.quantity = Number(quantity) || 1
      body.uom = uom || 'PCS'
    }

    try {
      const res = await createMutation.mutateAsync(body)
      setResult({ asset_code: res.asset_code, journal_id: res.journal_id })
      toast.success(`Saldo awal aset ${res.asset_code} berhasil dibuat`)
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal membuat saldo awal aset'))
    }
  }

  // ─── Success Screen ──────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg max-w-md w-full p-8 text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
            <Package className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Saldo Awal Berhasil Dibuat</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Aset <strong>{result.asset_code}</strong> telah tercatat dengan status ACTIVE.
            Jurnal pembukaan telah di-posting otomatis.
          </p>
          <div className="pt-4 flex flex-col gap-2">
            <button
              onClick={() => navigate('/fixed-assets')}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              Lihat Daftar Aset
            </button>
            <button
              onClick={() => { setResult(null); setProductId(''); setProductName(''); setAssetName('') }}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
            >
              Buat Saldo Awal Lagi
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Main Form ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Package className="w-6 h-6 text-blue-600 hidden sm:block" />
          <div>
            <h1 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white">Saldo Awal Aset</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
              Catat aset yang sudah ada sebelum sistem ini digunakan
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Basic Info */}
        <Section title="Informasi Dasar">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Cabang *">
              <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={inputCls}>
                <option value="">Pilih cabang...</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
              </select>
            </Field>
            <Field label="Kategori Aset *">
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
                <option value="">Pilih kategori...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.category_code} - {c.category_name} {c.tracking_method === 'POOLED' ? '(Pooled)' : ''}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Produk / SKU *">
            <div className="flex gap-2">
              <input value={productName} readOnly placeholder="Belum dipilih" className={`${inputCls} flex-1 bg-gray-50 dark:bg-gray-600 cursor-pointer`} onClick={() => setShowProductModal(true)} />
              <button onClick={() => setShowProductModal(true)} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Pilih</button>
            </div>
          </Field>

          <Field label="Nama Aset *">
            <input value={assetName} onChange={(e) => setAssetName(e.target.value)} placeholder="Nama aset..." className={inputCls} />
          </Field>

          {isPooled && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Jumlah (Qty) *">
                <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Satuan (UoM)">
                <input value={uom} onChange={(e) => setUom(e.target.value.toUpperCase())} placeholder="PCS" className={inputCls} />
              </Field>
            </div>
          )}
        </Section>

        {/* Financial Info */}
        <Section title="Informasi Keuangan">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Tanggal Perolehan *">
              <input type="date" value={acquisitionDate} max={today()} onChange={(e) => setAcquisitionDate(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Masa Manfaat (bulan)">
              <input type="number" min={1} value={usefulLifeMonths} onChange={(e) => setUsefulLifeMonths(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Harga Perolehan *">
              <input type="number" min={0} value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" className={inputCls} />
            </Field>
            <Field label="Nilai Sisa">
              <input type="number" min={0} value={salvageValue} onChange={(e) => setSalvageValue(e.target.value)} placeholder="0" className={inputCls} />
            </Field>
          </div>

          {/* Depreciation Mode */}
          <div className="mt-4 space-y-3">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Akumulasi Penyusutan</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={accumDeprMode === 'auto'} onChange={() => setAccumDeprMode('auto')} className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Hitung otomatis dari tanggal perolehan</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={accumDeprMode === 'manual'} onChange={() => setAccumDeprMode('manual')} className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Input manual</span>
              </label>
            </div>

            {accumDeprMode === 'manual' ? (
              <input type="number" min={0} value={manualAccumDepr} onChange={(e) => setManualAccumDepr(e.target.value)} placeholder="0" className={inputCls} />
            ) : deprPreview ? (
              <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Bulan terpakai</span><span className="font-medium">{deprPreview.months_elapsed} bulan</span></div>
                <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Penyusutan/bulan</span><span className="font-medium">{fmtCurrency(deprPreview.monthly_depreciation)}</span></div>
                <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Estimasi akum. penyusutan</span><span className="font-bold text-blue-700 dark:text-blue-300">{fmtCurrency(deprPreview.estimated_accumulated_depreciation)}</span></div>
                <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Estimasi nilai buku</span><span className="font-bold">{fmtCurrency(deprPreview.estimated_book_value)}</span></div>
                {deprPreview.is_fully_depreciated && <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">Aset sudah sepenuhnya terdepresiasi berdasarkan umur manfaat.</p>}
                <p className="text-xs text-gray-400 mt-2 italic">Estimasi berdasarkan bulan kalender penuh (tanpa prorate harian). Gunakan mode manual kalau perlu angka presisi dari laporan lama.</p>
              </div>
            ) : (
              <p className="text-xs text-gray-400">Isi tanggal perolehan, harga, dan masa manfaat untuk melihat estimasi.</p>
            )}
          </div>
        </Section>

        {/* Journal / Equity Account */}
        <Section title="Jurnal Pembukaan">
          <Field label="Akun Ekuitas (lawan jurnal) *">
            <select value={equityCoaId} onChange={(e) => setEquityCoaId(e.target.value)} className={inputCls}>
              <option value="">Pilih akun ekuitas...</option>
              {equityAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.account_code} - {a.account_name}</option>
              ))}
            </select>
          </Field>
          <div className="mt-3 rounded-lg bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-600 p-4 text-sm space-y-2">
            <p className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2"><Calculator className="w-4 h-4" /> Preview Jurnal</p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span>Dr Akun Aset ({selectedCategory?.asset_coa_code ?? '...'})</span><span className="font-mono">{fmtCurrency(Number(cost) || 0)}</span></div>
              {accumulatedDepreciation > 0 && <div className="flex justify-between pl-4 text-gray-500"><span>Cr Akum. Penyusutan ({selectedCategory?.accumulated_depreciation_coa_code ?? '...'})</span><span className="font-mono">{fmtCurrency(accumulatedDepreciation)}</span></div>}
              <div className="flex justify-between pl-4 text-gray-500"><span>Cr Ekuitas ({equityAccounts.find(a => a.id === equityCoaId)?.account_code ?? '...'})</span><span className="font-mono">{fmtCurrency(bookValue)}</span></div>
            </div>
          </div>
        </Section>

        {/* Optional Info */}
        <Section title="Informasi Tambahan (opsional)">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Serial Number"><input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} className={inputCls} /></Field>
            <Field label="Lokasi"><input value={locationNote} onChange={(e) => setLocationNote(e.target.value)} className={inputCls} /></Field>
          </div>
          <Field label="Deskripsi"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={`${inputCls} resize-none`} /></Field>
          <Field label="Catatan Opening Balance"><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Misal: Migrasi data awal Jan 2026" className={inputCls} /></Field>
        </Section>
      </div>

      {/* Sticky Submit Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3 z-40">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Nilai Buku: <strong className="text-gray-900 dark:text-white">{fmtCurrency(bookValue)}</strong>
          </div>
          <button
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Simpan Saldo Awal
          </button>
        </div>
      </div>

      {/* Product Picker Modal */}
      <ProductPickerModal
        open={showProductModal}
        onClose={() => setShowProductModal(false)}
        onSelect={handleProductSelect}
        filterAsset={true}
        title="Pilih Produk Aset"
      />
    </div>
  )
}

// ─── Utility Components ──────────────────────────────────────────────────────

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30">
        <h2 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h2>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">{label}</label>
      {children}
    </div>
  )
}
