import { useBankVouchersStore } from '../store/bankVouchers.store'

const formatIDR = (amount: number): string =>
  new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)

const formatDate = (dateStr: string): string => {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export const BankVoucherSummary = () => {
  const { summaryData, loading } = useBankVouchersStore()

  if (loading.summary) {
    return (
      <div className="animate-pulse space-y-4 p-4">
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          ))}
        </div>
        <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-lg" />
      </div>
    )
  }

  if (!summaryData) {
    return (
      <div className="text-center py-16 text-gray-500 dark:text-gray-400 text-sm">
        Pilih periode dan klik <strong>Tampilkan</strong> untuk melihat ringkasan
      </div>
    )
  }

  const ob = summaryData.opening_balance

  return (
    <div className="space-y-6 p-1">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
            Saldo Awal
          </p>
          <p className="text-xl font-bold font-mono text-gray-700 dark:text-gray-300">
            {formatIDR(ob)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {ob === 0 ? 'Belum diisi' : 'Opening balance'}
          </p>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <p className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wider mb-1">
            Total Bank Masuk
          </p>
          <p className="text-xl font-bold font-mono text-green-700 dark:text-green-300">
            {formatIDR(summaryData.total_bank_masuk)}
          </p>
          <p className="text-xs text-green-500 dark:text-green-500 mt-1">Nett setelah fee</p>
        </div>

        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wider mb-1">
            Total Bank Keluar
          </p>
          <p className="text-xl font-bold font-mono text-red-700 dark:text-red-300">
            {formatIDR(summaryData.total_bank_keluar)}
          </p>
          <p className="text-xs text-red-400 dark:text-red-500 mt-1">BK voucher</p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">
            Saldo Akhir
          </p>
          <p className={`text-xl font-bold font-mono ${
            summaryData.saldo_berjalan >= 0
              ? 'text-blue-700 dark:text-blue-300'
              : 'text-red-700 dark:text-red-300'
          }`}>
            {formatIDR(summaryData.saldo_berjalan)}
          </p>
          <p className="text-xs text-blue-400 dark:text-blue-500 mt-1">Awal + Masuk - Keluar</p>
        </div>
      </div>

      {ob === 0 && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-700 dark:text-amber-400">
          ⚠ Saldo awal belum diisi. Klik tombol <strong>"Saldo Awal"</strong> di toolbar untuk mengisi opening balance per rekening bank.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Per bank */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Per Rekening Bank</h3>
          </div>
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr className="text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <th className="px-4 py-2 text-left">Rekening</th>
                <th className="px-4 py-2 text-right">Saldo Awal</th>
                <th className="px-4 py-2 text-right text-green-600 dark:text-green-400">Masuk</th>
                <th className="px-4 py-2 text-right text-red-600 dark:text-red-400">Keluar</th>
                <th className="px-4 py-2 text-right text-blue-600 dark:text-blue-400">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {summaryData.by_bank.map((row) => (
                <tr key={row.bank_account_id} className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-200">{row.bank_account_name}</td>
                  <td className="px-4 py-2 text-right font-mono text-gray-500">{formatIDR(row.opening_balance)}</td>
                  <td className="px-4 py-2 text-right font-mono text-green-700 dark:text-green-400">{formatIDR(row.total_masuk)}</td>
                  <td className="px-4 py-2 text-right font-mono text-red-600 dark:text-red-400">
                    {row.total_keluar > 0 ? formatIDR(row.total_keluar) : '-'}
                  </td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-blue-700 dark:text-blue-400">{formatIDR(row.saldo)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-100 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-600 font-bold">
              <tr>
                <td className="px-4 py-2 text-gray-700 dark:text-gray-300">Total</td>
                <td className="px-4 py-2 text-right font-mono text-gray-500">{formatIDR(ob)}</td>
                <td className="px-4 py-2 text-right font-mono text-green-700 dark:text-green-400">{formatIDR(summaryData.total_bank_masuk)}</td>
                <td className="px-4 py-2 text-right font-mono text-red-600 dark:text-red-400">{formatIDR(summaryData.total_bank_keluar)}</td>
                <td className="px-4 py-2 text-right font-mono text-blue-700 dark:text-blue-400">{formatIDR(summaryData.saldo_berjalan)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Per hari - running balance */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Saldo Berjalan Harian</h3>
          </div>
          <div className="overflow-y-auto max-h-72">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                <tr className="text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <th className="px-4 py-2 text-left">Tanggal</th>
                  <th className="px-4 py-2 text-right text-green-600 dark:text-green-400">Masuk</th>
                  <th className="px-4 py-2 text-right text-blue-600 dark:text-blue-400">Saldo Berjalan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {/* Opening balance row */}
                {ob > 0 && (
                  <tr className="bg-gray-50/50 dark:bg-gray-800/50">
                    <td className="px-4 py-2 font-mono text-gray-400 italic">— Saldo Awal —</td>
                    <td className="px-4 py-2 text-right font-mono text-gray-400">-</td>
                    <td className="px-4 py-2 text-right font-mono font-semibold text-gray-500">{formatIDR(ob)}</td>
                  </tr>
                )}
                {summaryData.by_date.map((row) => (
                  <tr key={row.transaction_date} className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-2 font-mono text-gray-600 dark:text-gray-400">{formatDate(row.transaction_date)}</td>
                    <td className="px-4 py-2 text-right font-mono text-green-700 dark:text-green-400">{formatIDR(row.total_masuk)}</td>
                    <td className="px-4 py-2 text-right font-mono font-semibold text-blue-700 dark:text-blue-400">{formatIDR(row.running_balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
