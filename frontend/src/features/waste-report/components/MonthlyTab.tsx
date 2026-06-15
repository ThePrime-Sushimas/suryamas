import { AlertTriangle } from 'lucide-react'
import type { MonthlyOpnameSelisih } from '../api/wasteReport.api'
import { EmptyState } from './EmptyState'
import { fmt, fmtRp, fmtDate } from './wasteReport.constants'

export function MonthlyTab({
  rows,
  branchNameById,
}: {
  rows: MonthlyOpnameSelisih[]
  branchNameById: Map<string, string>
}) {
  if (rows.length === 0) {
    return (
      <EmptyState message="Tidak ada selisih negatif dari opname bulanan pada periode ini." />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Indikasi kebocoran bulanan (belum terverifikasi)
          </p>
          <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-1">
            Data ini tidak dijumlah ke total waste di atas. Gunakan untuk monitoring selisih opname
            bulanan yang perlu investigasi lebih lanjut.
          </p>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3">Tanggal Opname</th>
              <th className="px-4 py-3">Cabang</th>
              <th className="px-4 py-3">Produk</th>
              <th className="px-4 py-3 text-right">Selisih Qty</th>
              <th className="px-4 py-3 text-right">Selisih Nilai</th>
              <th className="px-4 py-3">Catatan Investigasi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {rows.map((r) => (
              <tr key={r.reference_id} className="hover:bg-gray-50/80 dark:hover:bg-gray-900/30">
                <td className="px-4 py-3 whitespace-nowrap">{fmtDate(r.date)}</td>
                <td className="px-4 py-3 max-w-[140px] truncate">
                  {r.branch_name ?? branchNameById.get(r.branch_id) ?? '-'}
                </td>
                <td className="px-4 py-3 font-medium">{r.item_name ?? '-'}</td>
                <td className="px-4 py-3 text-right tabular-nums text-red-600 dark:text-red-400">
                  {fmt(r.selisih_qty)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{fmtRp(Math.abs(r.selisih_value))}</td>
                <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{r.investigasi_note ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
