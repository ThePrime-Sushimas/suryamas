import { useState, useMemo } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Package, ChevronRight, Clock, CheckCircle2, XCircle, Scale, LoaderCircle } from "lucide-react"
import { Pagination } from "@/components/ui/Pagination"
import { useGoodsProcessingList } from "../api/goodsProcessing.api"

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("id-ID", {
    day: "numeric", month: "short", year: "numeric",
  })

const fmtDateShort = (d: string) =>
  new Date(d).toLocaleDateString("id-ID", {
    day: "numeric", month: "short",
  })

const STATUS_CONFIG: Record<string, {
  label: string
  dot: string
  badge: string
  icon: React.ReactNode
}> = {
  DRAFT:      { label: "Menunggu",  dot: "bg-gray-400",   badge: "bg-gray-100 text-gray-600",    icon: <Clock size={12} /> },
  PROCESSING: { label: "Diproses",  dot: "bg-blue-500",   badge: "bg-blue-50 text-blue-700",     icon: <LoaderCircle size={12} /> },
  PARTIAL:    { label: "Sebagian selesai", dot: "bg-indigo-500", badge: "bg-indigo-50 text-indigo-700", icon: <LoaderCircle size={12} /> },
  CONFIRMED:  { label: "Selesai",   dot: "bg-green-500",  badge: "bg-green-50 text-green-700",   icon: <CheckCircle2 size={12} /> },
  CORRECTING: { label: "Koreksi",   dot: "bg-amber-500",  badge: "bg-amber-50 text-amber-800",   icon: <LoaderCircle size={12} /> },
  REJECTED:   { label: "Ditolak",   dot: "bg-red-500",    badge: "bg-red-50 text-red-700",       icon: <XCircle size={12} /> },
}

function normalizeGpListStatus(status: string): string {
  return status === "QC_REVIEW" ? "PROCESSING" : status
}

function resolveGpListStatusConfig(gp: { status: string; input_count?: number | null; done_input_count?: number | null }) {
  const key = normalizeGpListStatus(gp.status)
  const cfg = STATUS_CONFIG[key] ?? STATUS_CONFIG.DRAFT
  if (gp.status === "PARTIAL" && gp.input_count && gp.done_input_count === gp.input_count) {
    return { ...cfg, label: "Menunggu konfirmasi" }
  }
  return cfg
}

function WeighingSummary({ summary }: { summary?: string | null }) {
  if (summary) {
    return (
      <div className="flex items-start gap-1.5 text-xs text-teal-800 dark:text-teal-300">
        <Scale className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span className="line-clamp-2" title={summary}>{summary}</span>
      </div>
    )
  }
  return <span className="text-xs text-gray-400">—</span>
}

const FILTER_OPTS = [
  { value: "",                          label: "Semua" },
  { value: "DRAFT,PROCESSING,PARTIAL,REJECTED,CORRECTING", label: "Perlu diproses" },
  { value: "CONFIRMED",                 label: "Selesai" },
]

export default function GoodsProcessingPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState("")

  const queryParams = useMemo(() => ({
    page, limit: 25,
    status: statusFilter || undefined,
  }), [page, statusFilter])

  const { data, isLoading } = useGoodsProcessingList(queryParams)
  const items = data?.data ?? []
  const pagination = data?.pagination

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">

      {/* ── Header ── */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 lg:px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6 text-orange-600 shrink-0" />
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">Barang Masuk</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Proses barang sebelum masuk gudang</p>
            </div>
          </div>

          {/* Desktop filter — di header */}
          <div className="hidden lg:flex items-center gap-2">
            {FILTER_OPTS.map(opt => (
              <button
                key={opt.value}
                onClick={() => { setStatusFilter(opt.value); setPage(1) }}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  statusFilter === opt.value
                    ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile filter chips */}
      <div className="lg:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2.5 flex gap-2 overflow-x-auto">
        {FILTER_OPTS.map(opt => (
          <button
            key={opt.value}
            onClick={() => { setStatusFilter(opt.value); setPage(1) }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              statusFilter === opt.value
                ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto">
        {isLoading && items.length === 0 ? (
          /* Skeleton */
          <div className="p-4 lg:p-6 space-y-3">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-20 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <Package className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">Tidak ada data</p>
            <p className="text-xs mt-1 text-gray-300">
              {statusFilter ? "Coba ubah filter" : "Belum ada goods processing"}
            </p>
          </div>
        ) : (
          <>
            {/* ── Mobile: card list ── */}
            <div className="lg:hidden p-4 space-y-3">
              {items.map(gp => {
                const cfg = resolveGpListStatusConfig(gp)
                const names = gp.item_names ?? []
                return (
                  <Link
                    key={gp.id}
                    to={`/inventory/goods-processing/${gp.id}`}
                    className="block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 cursor-pointer hover:border-blue-300 active:scale-[0.99] transition-all"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{gp.supplier_name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{fmtDate(gp.processing_date)}</p>
                      </div>
                      <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${cfg.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                    </div>
                    <div className="space-y-1 mb-2">
                      {names.slice(0, 3).map((name, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="w-1 h-1 rounded-full bg-gray-300 shrink-0" />
                          <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{name}</span>
                        </div>
                      ))}
                      {names.length > 3 && <p className="text-xs text-gray-400 pl-3">+{names.length - 3} item lainnya</p>}
                    </div>
                    {gp.weighing_summary && (
                      <div className="flex items-start gap-1.5 text-xs text-teal-800 dark:text-teal-300 bg-teal-50/50 dark:bg-teal-900/20 p-2 rounded-lg mb-2">
                        <Scale className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{gp.weighing_summary}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
                      <span className="text-xs text-gray-400 font-mono">{gp.gr_number}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
                          {gp.branch_name}
                        </span>
                        <ChevronRight size={14} className="text-gray-400" />
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>

            {/* ── Desktop: table ── */}
            <div className="hidden lg:block px-6 py-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">No. GP / GR</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Supplier</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Item</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Hasil Timbang</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tanggal</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cabang</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                    {items.map(gp => {
                      const cfg = resolveGpListStatusConfig(gp)
                      const names = gp.item_names ?? []
                      return (
                        <tr
                          key={gp.id}
                          onClick={() => navigate(`/inventory/goods-processing/${gp.id}`)}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors group"
                        >
                          {/* No. GP / GR */}
                          <td className="px-4 py-3.5">
                            <p className="font-mono text-xs font-semibold text-gray-800 dark:text-gray-200">
                              <Link to={`/inventory/goods-processing/${gp.id}`} className="text-blue-600 dark:text-blue-400 hover:underline" onClick={e => e.stopPropagation()}>
                                {gp.processing_number}
                              </Link>
                            </p>
                            <p className="font-mono text-xs text-gray-400 mt-0.5">{gp.gr_number}</p>
                          </td>

                          {/* Supplier */}
                          <td className="px-4 py-3.5">
                            <p className="font-medium text-gray-800 dark:text-gray-200">{gp.supplier_name}</p>
                          </td>

                          {/* Item */}
                          <td className="px-4 py-3.5 max-w-[220px]">
                            <div className="space-y-0.5">
                              {names.slice(0, 2).map((name, i) => (
                                <p key={i} className="text-xs text-gray-600 dark:text-gray-400 truncate">· {name}</p>
                              ))}
                              {names.length > 2 && (
                                <p className="text-xs text-gray-400">+{names.length - 2} lainnya</p>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 mt-1">
                              {gp.input_count} item
                            </p>
                          </td>

                          {/* Hasil Timbang */}
                          <td className="px-4 py-3.5 max-w-[220px]">
                            <WeighingSummary summary={gp.weighing_summary} />
                          </td>

                          {/* Tanggal */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <p className="text-sm text-gray-700 dark:text-gray-300">{fmtDateShort(gp.processing_date)}</p>
                          </td>

                          {/* Cabang */}
                          <td className="px-4 py-3.5">
                            <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-1 rounded-full whitespace-nowrap">
                              {gp.branch_name}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3.5">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.badge}`}>
                              {cfg.icon}
                              {cfg.label}
                            </span>
                          </td>

                          {/* Arrow */}
                          <td className="px-4 py-3.5">
                            <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Pagination */}
        {pagination && pagination.total > 0 && (
          <div className="px-4 lg:px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            <Pagination
              pagination={pagination}
              onPageChange={setPage}
              onLimitChange={() => {}}
              currentLength={items.length}
              loading={isLoading}
            />
          </div>
        )}
      </div>
    </div>
  )
}