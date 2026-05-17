import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Package, ChevronRight } from "lucide-react"
import { Pagination } from "@/components/ui/Pagination"
import { useGoodsProcessingList } from "../api/goodsProcessing.api"

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("id-ID", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  })

const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  DRAFT:      { label: "Menunggu",  dot: "bg-gray-400",  badge: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300" },
  PROCESSING: { label: "Diproses",  dot: "bg-blue-500",  badge: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  QC_REVIEW:  { label: "Review QC", dot: "bg-yellow-500", badge: "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" },
  CONFIRMED:  { label: "Selesai",   dot: "bg-green-500", badge: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  REJECTED:   { label: "Ditolak",   dot: "bg-red-500",   badge: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
}

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
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 lg:px-6 py-4">
        <div className="flex items-center gap-3">
          <Package className="w-6 h-6 text-orange-600" />
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Barang Masuk</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Proses barang sebelum masuk gudang</p>
          </div>
        </div>
      </div>

      {/* Filter chips */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2.5 flex gap-2 overflow-x-auto">
        {[
          { value: "",                        label: "Semua" },
          { value: "DRAFT,PROCESSING,REJECTED", label: "Perlu diproses" },
          { value: "CONFIRMED",               label: "Selesai" },
        ].map(opt => (
          <button
            key={opt.value}
            onClick={() => { setStatusFilter(opt.value); setPage(1) }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              statusFilter === opt.value
                ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto">
        {isLoading && items.length === 0 ? (
          <div className="p-4 space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="h-28 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Package className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm">Tidak ada data</p>
          </div>
        ) : (
          <div className="p-4 space-y-3 max-w-2xl mx-auto">
            {items.map(gp => {
              const cfg = STATUS_CONFIG[gp.status] ?? STATUS_CONFIG.DRAFT
              const names = gp.item_names ?? []

              return (
                <div
                  key={gp.id}
                  onClick={() => navigate(`/inventory/goods-processing/${gp.id}`)}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 active:scale-[0.99] transition-all"
                >
                  {/* Top */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{gp.supplier_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{fmtDate(gp.processing_date)}</p>
                    </div>
                    <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${cfg.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                  </div>

                  {/* Item names */}
                  <div className="space-y-1 mb-3">
                    {names.slice(0, 3).map((name, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600 shrink-0" />
                        <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{name}</span>
                      </div>
                    ))}
                    {names.length > 3 && (
                      <p className="text-xs text-gray-400 pl-3">+{names.length - 3} item lainnya</p>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-2.5 border-t border-gray-100 dark:border-gray-700">
                    <span className="text-xs text-gray-400 font-mono">{gp.gr_number}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
                        {gp.branch_name}
                      </span>
                      <ChevronRight size={14} className="text-gray-400" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {pagination && pagination.total > 0 && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 max-w-2xl mx-auto">
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