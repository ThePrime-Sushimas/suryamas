import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertOctagon,
  Building2,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  Package,
  Users,
} from 'lucide-react'
import { useBranches } from '@/features/branches/api/branches.api'
import { useCategories } from '@/features/categories/api/categories.api'
import { usePositions } from '@/features/settings/api/settings.api'
import { employeesApi } from '@/features/employees/api/employees.api'
import { usePermission } from '@/features/branch_context/hooks/usePermission'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import {
  useShortageReport,
  useShortageReportByEmployee,
  useShortageReportByDepartment,
  useDepartmentEmployees,
  useShortageReportByItem,
  useResolveShortage,
  useMarkDeductionPaid,
  useEditResolution,
  type ShortageRecord,
  type ShortageReportParams,
  type ShortageResolveStatus,
} from '../api/shortageReport.api'
import { exportShortageDeductionExcel } from '../utils/shortageReportExport'

const fmtRp = (n: number | null | undefined) =>
  n == null
    ? '-'
    : new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
      }).format(n)

const fmt = (n: number | null | undefined) =>
  n == null
    ? '-'
    : new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

const SOURCE_LABEL: Record<import('../api/shortageReport.api').ShortageSourceType, string> = {
  DAILY_OPNAME: 'Opname Harian',
  MONTHLY_OPNAME: 'SO Bulanan',
}

const STATUS_LABEL: Record<ShortageResolveStatus, string> = {
  UNRESOLVED: 'Belum selesai',
  RESOLVED: 'Sudah investigasi',
  CONVERTED_TO_WASTE: 'Jadi Waste',
}

const STATUS_CLASS: Record<ShortageResolveStatus, string> = {
  UNRESOLVED: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  RESOLVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  CONVERTED_TO_WASTE: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
}

type TabId = 'list' | 'by-item' | 'by-employee' | 'by-department'

function SummaryCard({
  title,
  value,
  subtitle,
  accent,
}: {
  title: string
  value: string
  subtitle: string
  accent?: string
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 shadow-sm p-5">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{title}</p>
      <p className={`text-2xl font-bold mt-1 tabular-nums ${accent ?? 'text-gray-900 dark:text-white'}`}>
        {value}
      </p>
      <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
    </div>
  )
}

export default function ShortageReportPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { hasPermission: canEdit } = usePermission('shortage_report', 'update')

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [branchId, setBranchId] = useState('')
  const [positionId, setPositionId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [resolveStatus, setResolveStatus] = useState<ShortageResolveStatus | ''>('')
  const [applied, setApplied] = useState<ShortageReportParams | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('list')
  const [resolveModal, setResolveModal] = useState<ShortageRecord | null>(null)
  const [editModal, setEditModal] = useState<ShortageRecord | null>(null)
  const [convertModal, setConvertModal] = useState<ShortageRecord | null>(null)
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null)
  const [expandedDepartment, setExpandedDepartment] = useState<string | null>(null)

  const { data: branchesData } = useBranches({ limit: 100, filter: { status: 'active' } })
  const branches = branchesData?.data ?? []
  const { data: categoriesData } = useCategories({ limit: 200, is_active: 'true' })
  const categories = categoriesData?.data ?? []
  const { data: positionsData } = usePositions()
  const positions = positionsData ?? []

  const params = useMemo(() => applied, [applied])
  const { data: report, isLoading, isFetching } = useShortageReport(params ?? { start_date: '', end_date: '' }, !!params)
  const { data: byItem = [], isLoading: byItemLoading } = useShortageReportByItem(
    params ?? { start_date: '', end_date: '' },
    !!params && activeTab === 'by-item',
  )
  const employeeParams = useMemo(
    () =>
      params
        ? { start_date: params.start_date, end_date: params.end_date, ...(params.branch_id ? { branch_id: params.branch_id } : {}) }
        : { start_date: '', end_date: '' },
    [params],
  )
  const { data: byEmployee = [], isLoading: byEmployeeLoading } = useShortageReportByEmployee(
    employeeParams,
    !!params && activeTab === 'by-employee',
  )
  const { data: byDepartment = [], isLoading: byDepartmentLoading } = useShortageReportByDepartment(
    employeeParams,
    !!params && activeTab === 'by-department',
  )

  const resolveMutation = useResolveShortage()
  const markPaidMutation = useMarkDeductionPaid()
  const editMutation = useEditResolution()

  useEffect(() => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 30)
    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])
  }, [])

  const canQuery = !!startDate && !!endDate

  const applyFilters = () => {
    if (!canQuery) return
    setApplied({
      start_date: startDate,
      end_date: endDate,
      ...(branchId ? { branch_id: branchId } : {}),
      ...(positionId ? { position_id: positionId } : {}),
      ...(categoryId ? { category_id: categoryId } : {}),
      ...(resolveStatus ? { resolve_status: resolveStatus } : {}),
    })
  }

  const summary = report?.summary

  return (
    <div className="min-h-full bg-gray-50/80 dark:bg-gray-900/50">
      <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-orange-50 dark:bg-orange-950/40 shadow-sm">
              <AlertOctagon className="w-7 h-7 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                Laporan Shortage
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Investigasi shortage dari opname harian — resolve, potongan karyawan, atau konversi ke waste
              </p>
            </div>
          </div>
          {isFetching && <Loader2 className="w-5 h-5 animate-spin text-orange-500" />}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 shadow-sm p-5">
          <div className="flex flex-wrap gap-4 items-end">
            <FilterDate label="Dari tanggal *" value={startDate} onChange={setStartDate} />
            <FilterDate label="Sampai tanggal *" value={endDate} onChange={setEndDate} />
            <FilterSelect label="Cabang" value={branchId} onChange={setBranchId}>
              <option value="">Semua cabang</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.branch_name}</option>
              ))}
            </FilterSelect>
            <FilterSelect label="Posisi" value={positionId} onChange={setPositionId}>
              <option value="">Semua posisi</option>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>{p.position_name}</option>
              ))}
            </FilterSelect>
            <FilterSelect label="Kategori" value={categoryId} onChange={setCategoryId}>
              <option value="">Semua kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.category_name}</option>
              ))}
            </FilterSelect>
            <FilterSelect
              label="Status"
              value={resolveStatus}
              onChange={(v) => setResolveStatus(v as ShortageResolveStatus | '')}
            >
              <option value="">Semua status</option>
              <option value="UNRESOLVED">Belum selesai</option>
              <option value="RESOLVED">Sudah investigasi</option>
              <option value="CONVERTED_TO_WASTE">Jadi Waste</option>
            </FilterSelect>
            <button
              type="button"
              onClick={applyFilters}
              disabled={!canQuery}
              className="px-5 py-2.5 text-sm font-semibold text-white rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 transition-colors"
            >
              Tampilkan
            </button>
          </div>
        </div>

        {!applied ? (
          <div className="text-center py-20 text-gray-500">Atur filter dan klik Tampilkan.</div>
        ) : isLoading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          </div>
        ) : (
          <>
            {summary && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <SummaryCard
                  title="Total Shortage"
                  value={fmtRp(summary.total_shortage_cost)}
                  subtitle={`${report?.records.length ?? 0} kejadian`}
                />
                <SummaryCard
                  title="Belum Selesai"
                  value={fmtRp(summary.unresolved_cost)}
                  subtitle={`${summary.unresolved_count} kejadian`}
                  accent="text-red-600 dark:text-red-400"
                />
                <SummaryCard
                  title="Sudah Investigasi"
                  value={fmtRp(summary.resolved_cost)}
                  subtitle={`${summary.resolved_count} kejadian`}
                  accent="text-emerald-600 dark:text-emerald-400"
                />
                <SummaryCard
                  title="Dikonversi ke Waste"
                  value={fmtRp(summary.converted_to_waste_cost)}
                  subtitle={`${summary.converted_to_waste_count} kejadian`}
                />
                <SummaryCard
                  title="Total Potongan"
                  value={fmtRp(summary.total_deduction_amount)}
                  subtitle="Akan terintegrasi ke modul Payroll"
                  accent="text-amber-600 dark:text-amber-400"
                />
              </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 shadow-sm overflow-hidden">
              <div className="flex flex-wrap gap-1 p-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30">
                {([
                  { id: 'list' as const, label: 'Daftar Shortage', icon: AlertOctagon },
                  { id: 'by-item' as const, label: 'Per Produk', icon: Package },
                  { id: 'by-employee' as const, label: 'Potongan Karyawan', icon: Users },
                  { id: 'by-department' as const, label: 'Potongan Divisi', icon: Building2 },
                ]).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
                      activeTab === tab.id
                        ? 'bg-white dark:bg-gray-800 text-orange-700 dark:text-orange-400 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-5">
                {activeTab === 'list' && (
                  <ListTab
                    records={report?.records ?? []}
                    canEdit={canEdit}
                    onResolve={setResolveModal}
                    onConvert={setConvertModal}
                    onEdit={setEditModal}
                  />
                )}
                {activeTab === 'by-item' && (
                  byItemLoading ? (
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-orange-500" />
                  ) : (
                    <ByItemTab groups={byItem} />
                  )
                )}
                {activeTab === 'by-employee' && (
                  byEmployeeLoading ? (
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-orange-500" />
                  ) : (
                    <ByEmployeeTab
                      groups={byEmployee}
                      expanded={expandedEmployee}
                      onToggle={(id) => setExpandedEmployee((p) => (p === id ? null : id))}
                      onExport={() => {
                        if (!applied) return
                        exportShortageDeductionExcel(byEmployee, applied.start_date, applied.end_date)
                      }}
                      onMarkPaid={(id, paid) => {
                        markPaidMutation.mutate(
                          { id, paid },
                          {
                            onSuccess: () => toast.success(paid ? 'Ditandai sudah dibayar' : 'Ditandai belum dibayar'),
                            onError: (e) => toast.error(parseApiError(e, "Terjadi kesalahan")),
                          },
                        )
                      }}
                      canEdit={canEdit}
                    />
                  )
                )}
                {activeTab === 'by-department' && (
                  byDepartmentLoading ? (
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-orange-500" />
                  ) : (
                    <ByDepartmentTab
                      groups={byDepartment}
                      expanded={expandedDepartment}
                      onToggle={(id) => setExpandedDepartment((p) => (p === id ? null : id))}
                      onMarkPaid={(id, paid) => {
                        markPaidMutation.mutate(
                          { id, paid },
                          {
                            onSuccess: () => toast.success(paid ? 'Ditandai sudah dibayar' : 'Ditandai belum dibayar'),
                            onError: (e) => toast.error(parseApiError(e, "Terjadi kesalahan")),
                          },
                        )
                      }}
                      canEdit={canEdit}
                    />
                  )
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {resolveModal && (
        <ResolveModal
          record={resolveModal}
          onClose={() => setResolveModal(null)}
          loading={resolveMutation.isPending}
          onSubmit={(payload) => {
            resolveMutation.mutate(
              { vcl_ids: [resolveModal.id], action: 'RESOLVE', ...payload },
              {
                onSuccess: () => {
                  toast.success('Shortage berhasil diselesaikan')
                  setResolveModal(null)
                },
                onError: (e) => toast.error(parseApiError(e, "Terjadi kesalahan")),
              },
            )
          }}
        />
      )}

      {editModal && (
        <ResolveModal
          record={editModal}
          onClose={() => setEditModal(null)}
          loading={editMutation.isPending}
          onSubmit={(payload) => {
            editMutation.mutate(
              { id: editModal.id, vcl_ids: [editModal.id], action: 'RESOLVE', ...payload },
              {
                onSuccess: () => {
                  toast.success('Potongan berhasil diperbarui')
                  setEditModal(null)
                },
                onError: (e) => toast.error(parseApiError(e, "Gagal mengupdate")),
              },
            )
          }}
        />
      )}

      {convertModal && (
        <ConvertModal
          record={convertModal}
          onClose={() => setConvertModal(null)}
          loading={resolveMutation.isPending}
          onSubmit={(notes) => {
            resolveMutation.mutate(
              { vcl_ids: [convertModal.id], action: 'CONVERT_TO_WASTE', resolved_notes: notes },
              {
                onSuccess: (result) => {
                  setConvertModal(null)
                  if (result.journal_pending) {
                    toast.warning(
                      'Berhasil dikonversi ke waste. Jurnal sedang diproses — cek Stock Adjustment jika belum muncul.',
                    )
                  } else {
                    toast.success('Berhasil dikonversi ke waste dan jurnal sudah dibuat.')
                  }
                  if (result.converted_sa_id) {
                    navigate(`/inventory/stock-adjustments/${result.converted_sa_id}`)
                  }
                },
                onError: (e) => toast.error(parseApiError(e, "Terjadi kesalahan")),
              },
            )
          }}
        />
      )}
    </div>
  )
}

function FilterDate({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">{label}</label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
      />
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-w-[160px]"
      >
        {children}
      </select>
    </div>
  )
}

function ListTab({
  records,
  canEdit,
  onResolve,
  onConvert,
  onEdit,
}: {
  records: ShortageRecord[]
  canEdit: boolean
  onResolve: (r: ShortageRecord) => void
  onConvert: (r: ShortageRecord) => void
  onEdit: (r: ShortageRecord) => void
}) {
  if (records.length === 0) {
    return <p className="text-center py-12 text-gray-500">Tidak ada data shortage untuk filter ini.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 border-b border-gray-100 dark:border-gray-700">
            <th className="pb-3 pr-3">Sumber</th>
            <th className="pb-3 pr-3">Tanggal</th>
            <th className="pb-3 pr-3">Cabang</th>
            <th className="pb-3 pr-3">Posisi</th>
            <th className="pb-3 pr-3">Divisi</th>
            <th className="pb-3 pr-3">Produk</th>
            <th className="pb-3 pr-3 text-right">Qty</th>
            <th className="pb-3 pr-3 text-right">Nilai</th>
            <th className="pb-3 pr-3">Status</th>
            <th className="pb-3 pr-3">Karyawan</th>
            <th className="pb-3 pr-3 text-right">Potongan</th>
            {canEdit && <th className="pb-3">Aksi</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
          {records.map((r) => (
            <tr key={r.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-900/30">
              <td className="py-3 pr-3 whitespace-nowrap">
                <span className="text-xs font-medium px-2 py-1 rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {SOURCE_LABEL[r.source_type]}
                </span>
              </td>
              <td className="py-3 pr-3 whitespace-nowrap">{fmtDate(r.date)}</td>
              <td className="py-3 pr-3">{r.branch_name}</td>
              <td className="py-3 pr-3">{r.position_name ?? '-'}</td>
              <td className="py-3 pr-3">{r.department_name ?? '-'}</td>
              <td className="py-3 pr-3 font-medium text-gray-900 dark:text-white">{r.item_name}</td>
              <td className="py-3 pr-3 text-right tabular-nums">{fmt(r.qty)}</td>
              <td className="py-3 pr-3 text-right tabular-nums">{fmtRp(r.total_cost)}</td>
              <td className="py-3 pr-3">
                <span className={`text-xs font-medium px-2 py-1 rounded-lg ${STATUS_CLASS[r.resolve_status]}`}>
                  {STATUS_LABEL[r.resolve_status]}
                </span>
              </td>
              <td className="py-3 pr-3">
                {r.deduction_mode === 'DIVISION'
                  ? `Divisi: ${r.department_name ?? '-'}`
                  : r.deducted_employee_name ?? r.shortage_assigned_to_name ?? '-'}
              </td>
              <td className="py-3 pr-3 text-right tabular-nums">
                {r.deduction_mode === 'DIVISION'
                  ? fmtRp(r.deduction_amount ?? r.total_cost)
                  : r.deduction_amount != null
                    ? fmtRp(r.deduction_amount)
                    : r.shortage_assigned_to_name
                      ? `${fmtRp(r.total_cost)}*`
                      : '-'}
              </td>
              {canEdit && (
                <td className="py-3">
                  {r.resolve_status === 'UNRESOLVED' && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onResolve(r)}
                        className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      >
                        Selesaikan
                      </button>
                      <button
                        type="button"
                        onClick={() => onConvert(r)}
                        className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                      >
                        Jadikan Waste
                      </button>
                    </div>
                  )}
                  {r.resolve_status === 'RESOLVED' && (
                    <button
                      type="button"
                      onClick={() => onEdit(r)}
                      className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100"
                    >
                      Edit
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ByItemTab({ groups }: { groups: import('../api/shortageReport.api').ShortageByItemGroup[] }) {
  if (groups.length === 0) return <p className="text-center py-12 text-gray-500">Tidak ada data.</p>
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-gray-500 border-b">
          <th className="pb-3 pr-3">#</th>
          <th className="pb-3 pr-3">Produk</th>
          <th className="pb-3 pr-3">Kategori</th>
          <th className="pb-3 pr-3 text-right">Total Qty</th>
          <th className="pb-3 pr-3 text-right">Total Nilai</th>
          <th className="pb-3 pr-3 text-right">Belum Selesai</th>
          <th className="pb-3 text-right">% Belum</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {groups.map((g, i) => {
          const pct = g.total_cost > 0 ? (g.unresolved_cost / g.total_cost) * 100 : 0
          return (
            <tr key={g.item_id}>
              <td className="py-3 pr-3 text-gray-400">{i + 1}</td>
              <td className="py-3 pr-3 font-medium">{g.item_name}</td>
              <td className="py-3 pr-3">{g.category_name ?? '-'}</td>
              <td className="py-3 pr-3 text-right tabular-nums">{fmt(g.total_qty)}</td>
              <td className="py-3 pr-3 text-right tabular-nums">{fmtRp(g.total_cost)}</td>
              <td className="py-3 pr-3 text-right tabular-nums">{fmtRp(g.unresolved_cost)}</td>
              <td className="py-3 text-right tabular-nums">{pct.toFixed(1)}%</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function ByEmployeeTab({
  groups,
  expanded,
  onToggle,
  onExport,
  onMarkPaid,
  canEdit,
}: {
  groups: import('../api/shortageReport.api').ShortageByEmployeeGroup[]
  expanded: string | null
  onToggle: (id: string) => void
  onExport: () => void
  onMarkPaid: (id: string, paid: boolean) => void
  canEdit: boolean
}) {
  if (groups.length === 0) {
    return <p className="text-center py-12 text-gray-500">Belum ada shortage dengan karyawan ter-assign dari opname.</p>
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200/60 text-sm text-sky-900 dark:text-sky-200">
        <p>
          Laporan ini adalah penampung sementara sebelum modul Payroll dibangun.
          Gunakan Export Excel untuk diserahkan ke HR/Finance.
        </p>
        <button
          type="button"
          onClick={onExport}
          className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-gray-800 border text-sm font-medium hover:shadow-sm"
        >
          <Download className="w-4 h-4" />
          Export Excel
        </button>
      </div>
      {groups.map((g) => (
        <div key={g.employee_id} className="border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => onToggle(g.employee_id)}
            className="w-full flex items-center justify-between px-5 py-4 bg-gray-50/80 dark:bg-gray-900/30 hover:bg-gray-100/80"
          >
            <div className="text-left">
              <p className="font-semibold text-gray-900 dark:text-white">{g.employee_name}</p>
              <p className="text-xs text-gray-500">{g.branch_name} · {g.shortage_count} kejadian</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-bold text-amber-700 tabular-nums">{fmtRp(g.total_deduction_amount)}</span>
              {expanded === g.employee_id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>
          {expanded === g.employee_id && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-t">
                  <th className="py-2 px-5 text-left">Tanggal</th>
                  <th className="py-2 text-left">Produk</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Nilai</th>
                  <th className="py-2 text-right">Potongan</th>
                  <th className="py-2 text-left">Status</th>
                  <th className="py-2 text-left">Catatan</th>
                  {canEdit && <th className="py-2 px-5 text-left">Status Bayar</th>}
                </tr>
              </thead>
              <tbody>
                {g.detail.map((d) => (
                  <tr key={d.id} className="border-t border-gray-50">
                    <td className="py-2 px-5">{fmtDate(d.date)}</td>
                    <td className="py-2">{d.item_name}</td>
                    <td className="py-2 text-right tabular-nums">{fmt(d.qty)}</td>
                    <td className="py-2 text-right tabular-nums">{fmtRp(d.total_cost)}</td>
                    <td className="py-2 text-right tabular-nums">
                      {fmtRp(d.deduction_amount)}
                      {d.is_provisional && (
                        <span className="text-[10px] text-amber-600 ml-1">estimasi</span>
                      )}
                    </td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-lg ${STATUS_CLASS[d.resolve_status]}`}>
                        {STATUS_LABEL[d.resolve_status]}
                      </span>
                    </td>
                    <td className="py-2 text-gray-500">{d.notes ?? '-'}</td>
                    {canEdit && (
                      <td className="py-2 px-5">
                        <button
                          type="button"
                          onClick={() => onMarkPaid(d.allocation_id ?? d.id, !d.deduction_paid_at)}
                          className={`text-xs px-2 py-1 rounded-lg ${
                            d.deduction_paid_at
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {d.deduction_paid_at ? 'Sudah' : 'Belum'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  )
}

function ByDepartmentTab({
  groups,
  expanded,
  onToggle,
  onMarkPaid,
  canEdit,
}: {
  groups: import('../api/shortageReport.api').ShortageByDepartmentGroup[]
  expanded: string | null
  onToggle: (id: string) => void
  onMarkPaid: (id: string, paid: boolean) => void
  canEdit: boolean
}) {
  if (groups.length === 0) {
    return (
      <p className="text-center py-12 text-gray-500">
        Belum ada potongan divisi. Selesaikan shortage SO bulanan dengan mode bagi rata per divisi.
      </p>
    )
  }
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.department_id} className="border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => onToggle(g.department_id)}
            className="w-full flex items-center justify-between px-5 py-4 bg-gray-50/80 dark:bg-gray-900/30 hover:bg-gray-100/80"
          >
            <div className="text-left">
              <p className="font-semibold text-gray-900 dark:text-white">{g.department_name}</p>
              <p className="text-xs text-gray-500">
                {g.branch_name} · {g.employee_count} karyawan · {g.shortage_count} alokasi
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-bold text-amber-700 tabular-nums">{fmtRp(g.total_deduction_amount)}</span>
              {expanded === g.department_id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>
          {expanded === g.department_id && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-t">
                  <th className="py-2 px-5 text-left">Tanggal</th>
                  <th className="py-2 text-left">Produk</th>
                  <th className="py-2 text-left">Karyawan</th>
                  <th className="py-2 text-right">Potongan</th>
                  <th className="py-2 text-left">Status</th>
                  {canEdit && <th className="py-2 px-5 text-left">Status Bayar</th>}
                </tr>
              </thead>
              <tbody>
                {g.detail.map((d) => (
                  <tr key={d.id} className="border-t border-gray-50">
                    <td className="py-2 px-5">{fmtDate(d.date)}</td>
                    <td className="py-2">{d.item_name}</td>
                    <td className="py-2">{d.employee_name ?? '-'}</td>
                    <td className="py-2 text-right tabular-nums">
                      {fmtRp(d.deduction_amount)}
                      {d.is_provisional && (
                        <span className="text-[10px] text-amber-600 ml-1">estimasi</span>
                      )}
                    </td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-lg ${STATUS_CLASS[d.resolve_status]}`}>
                        {STATUS_LABEL[d.resolve_status]}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="py-2 px-5">
                        {d.allocation_id && !d.is_provisional ? (
                          <button
                            type="button"
                            onClick={() => onMarkPaid(d.allocation_id!, !d.deduction_paid_at)}
                            className={`text-xs px-2 py-1 rounded-lg ${
                              d.deduction_paid_at
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {d.deduction_paid_at ? 'Sudah' : 'Belum'}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  )
}

function ResolveModal({
  record,
  onClose,
  onSubmit,
  loading,
}: {
  record: ShortageRecord
  onClose: () => void
  onSubmit: (p: {
    allocation_mode?: 'INDIVIDUAL' | 'DIVISION'
    department_id?: string
    resolved_notes?: string
    deducted_employee_id?: string
    deduction_amount?: number
    deduction_notes?: string
  }) => void
  loading: boolean
}) {
  const defaultDivision =
    record.source_type === 'MONTHLY_OPNAME' && !record.shortage_assigned_to
  const [allocationMode, setAllocationMode] = useState<'INDIVIDUAL' | 'DIVISION'>(
    defaultDivision ? 'DIVISION' : 'INDIVIDUAL',
  )
  const [notes, setNotes] = useState(record.shortage_note ?? '')
  const [hasDeduction, setHasDeduction] = useState(defaultDivision || !!record.shortage_assigned_to)
  const [positionId, setPositionId] = useState(record.position_id ?? '')
  const [employeeId, setEmployeeId] = useState(record.shortage_assigned_to ?? record.deducted_employee_id ?? '')
  const [amount, setAmount] = useState(String(record.deduction_amount ?? record.total_cost))
  const [deductionNotes, setDeductionNotes] = useState('')
  const [employees, setEmployees] = useState<{ id: string; full_name: string }[]>([])

  const { data: positionsData } = usePositions()
  const allPositions = positionsData ?? []
  const { data: deptEmployees = [], isLoading: deptEmployeesLoading } = useDepartmentEmployees(
    record.branch_id,
    positionId,
    allocationMode === 'DIVISION' && !!positionId,
    'position',
  )

  const splitPreview = useMemo(() => {
    if (allocationMode !== 'DIVISION' || deptEmployees.length === 0) return []
    const total = Math.round(Number(record.total_cost) || 0)
    const base = Math.floor(total / deptEmployees.length)
    return deptEmployees.map((e, i) => ({
      ...e,
      amount: i === deptEmployees.length - 1 ? total - base * (deptEmployees.length - 1) : base,
    }))
  }, [allocationMode, deptEmployees, record.total_cost])

  useEffect(() => {
    employeesApi.search('', 1, 200, undefined, undefined, { is_active: 'true' }).then((res) => {
      setEmployees(res.data.map((e) => ({ id: e.id, full_name: e.full_name })))
    }).catch(() => {})
  }, [])

  const canSubmitDivision = allocationMode === 'DIVISION' && !!positionId && deptEmployees.length > 0
  const canSubmitIndividual = allocationMode === 'INDIVIDUAL' && (!hasDeduction || !!employeeId)

  return (
    <ModalShell title="Selesaikan Shortage" onClose={onClose}>
      <p className="text-sm text-gray-600 mb-4">
        <strong>{record.item_name}</strong> · Qty {fmt(record.qty)} · {fmtRp(record.total_cost)}
        {record.shortage_assigned_to_name && (
          <span className="block text-xs text-gray-500 mt-1">
            Assigned dari opname: {record.shortage_assigned_to_name}
          </span>
        )}
        {record.department_name && (
          <span className="block text-xs text-gray-500 mt-1">
            Divisi: {record.department_name}
          </span>
        )}
      </p>
      <label className="block text-xs font-medium text-gray-500 mb-1">Catatan investigasi</label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        className="w-full border rounded-xl px-3 py-2 text-sm mb-4 dark:bg-gray-700 dark:border-gray-600"
      />
      <label className="flex items-center gap-2 text-sm mb-3">
        <input
          type="checkbox"
          checked={hasDeduction}
          onChange={(e) => setHasDeduction(e.target.checked)}
        />
        Ditanggung karyawan?
      </label>
      {hasDeduction && (
        <div className="space-y-3 mb-4 pl-1">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAllocationMode('INDIVIDUAL')}
              className={`flex-1 px-3 py-2 text-xs font-medium rounded-xl border ${
                allocationMode === 'INDIVIDUAL'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'border-gray-200 text-gray-600'
              }`}
            >
              Perorangan
            </button>
            <button
              type="button"
              onClick={() => setAllocationMode('DIVISION')}
              className={`flex-1 px-3 py-2 text-xs font-medium rounded-xl border ${
                allocationMode === 'DIVISION'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'border-gray-200 text-gray-600'
              }`}
            >
              Bagi rata divisi
            </button>
          </div>
          {allocationMode === 'INDIVIDUAL' ? (
            <>
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="w-full border rounded-xl px-3 py-2 text-sm dark:bg-gray-700"
              >
                <option value="">Pilih karyawan</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.full_name}</option>
                ))}
              </select>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full border rounded-xl px-3 py-2 text-sm dark:bg-gray-700"
                placeholder="Jumlah potongan"
              />
            </>
          ) : (
            <>
              <select
                value={positionId}
                onChange={(e) => setPositionId(e.target.value)}
                className="w-full border rounded-xl px-3 py-2 text-sm dark:bg-gray-700"
              >
                <option value="">Pilih position</option>
                {allPositions.map((p) => (
                  <option key={p.id} value={p.id}>{p.position_name}</option>
                ))}
              </select>
              {deptEmployeesLoading ? (
                <p className="text-xs text-gray-500">Memuat karyawan position...</p>
              ) : positionId && deptEmployees.length === 0 ? (
                <p className="text-xs text-red-600">Tidak ada karyawan aktif di position ini pada cabang terkait.</p>
              ) : splitPreview.length > 0 ? (
                <div className="rounded-xl border border-gray-200 dark:border-gray-600 p-3 space-y-1 max-h-40 overflow-y-auto">
                  <p className="text-xs font-medium text-gray-500 mb-2">
                    Preview bagi rata ({deptEmployees.length} karyawan)
                  </p>
                  {splitPreview.map((e) => (
                    <div key={e.id} className="flex justify-between text-xs">
                      <span>{e.full_name}</span>
                      <span className="tabular-nums font-medium">{fmtRp(e.amount)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          )}
          <textarea
            value={deductionNotes}
            onChange={(e) => setDeductionNotes(e.target.value)}
            rows={2}
            placeholder="Catatan potongan"
            className="w-full border rounded-xl px-3 py-2 text-sm dark:bg-gray-700"
          />
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm">Batal</button>
        <button
          type="button"
          disabled={loading || (hasDeduction && !(canSubmitDivision || canSubmitIndividual))}
          onClick={() => {
            const selectedPosition = allPositions.find((p) => p.id === positionId)
            onSubmit({
              resolved_notes: notes || undefined,
              ...(hasDeduction
                ? allocationMode === 'DIVISION'
                  ? {
                      allocation_mode: 'DIVISION' as const,
                      department_id: selectedPosition?.department_id ?? positionId,
                      deduction_notes: deductionNotes || undefined,
                    }
                  : {
                      allocation_mode: 'INDIVIDUAL' as const,
                      deducted_employee_id: employeeId,
                      deduction_amount: Number(amount) || 0,
                      deduction_notes: deductionNotes || undefined,
                    }
                : {}),
            })
          }}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-emerald-600 disabled:opacity-50"
        >
          {loading ? 'Menyimpan...' : 'Simpan'}
        </button>
      </div>
    </ModalShell>
  )
}

function ConvertModal({
  record,
  onClose,
  onSubmit,
  loading,
}: {
  record: ShortageRecord
  onClose: () => void
  onSubmit: (notes: string) => void
  loading: boolean
}) {
  const [notes, setNotes] = useState('')
  return (
    <ModalShell title="Jadikan Waste" onClose={onClose}>
      <p className="text-sm text-amber-700 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-xl mb-4">
        Tindakan ini tidak dapat dibatalkan.
      </p>
      <p className="text-sm mb-2">
        Shortage: <strong>{record.item_name}</strong> · {fmt(record.qty)} · {fmtRp(record.total_cost)}
      </p>
      <label className="block text-xs font-medium text-gray-500 mb-1">Alasan konversi *</label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        className="w-full border rounded-xl px-3 py-2 text-sm mb-4 dark:bg-gray-700"
      />
      <div className="text-xs text-gray-500 space-y-1 mb-4 p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl">
        <p>✓ Stock Adjustment WASTE dibuat otomatis</p>
        <p>✓ Data muncul di Laporan Waste</p>
        <p>✓ Jurnal: DR 510301 / CR 110505 (DR: Waste - Station {record.position_name ?? 'opname'})</p>
        <p className="text-amber-600">⚠ Jurnal mungkin tertunda jika periode fiskal belum dibuka</p>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm">Batal</button>
        <button
          type="button"
          disabled={loading || !notes.trim()}
          onClick={() => onSubmit(notes.trim())}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-orange-600 disabled:opacity-50"
        >
          {loading ? 'Memproses...' : 'Ya, Jadikan Waste'}
        </button>
      </div>
    </ModalShell>
  )
}

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">{title}</h2>
        {children}
        <button type="button" onClick={onClose} className="sr-only">Tutup</button>
      </div>
    </div>
  )
}
