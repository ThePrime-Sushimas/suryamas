import { fmtCurrency } from '../utils/format'
import type { MarketplaceCheckoutLine, MarketplaceSessionStatus } from '../types/marketplacePo.types'

interface Props {
  lines: MarketplaceCheckoutLine[]
  sessionStatus: MarketplaceSessionStatus
  canUpdate: boolean
  onRemoveLine?: (lineId: string) => void
  onCancelLine?: (line: { id: string; productName: string }) => void
  isRemovePending?: boolean
}

export function SessionItemsTab({
  lines,
  sessionStatus,
  canUpdate,
  onRemoveLine,
  onCancelLine,
  isRemovePending,
}: Props) {
  const showActions =
    canUpdate &&
    ((sessionStatus === 'DRAFT' && onRemoveLine) ||
      (sessionStatus === 'SHIPPED' && onCancelLine))

  const byBranch = lines.reduce<Record<string, MarketplaceCheckoutLine[]>>((acc, line) => {
    const key = line.branch_name ?? line.branch_id
    if (!acc[key]) acc[key] = []
    acc[key].push(line)
    return acc
  }, {})

  const activeLines = lines.filter((l) => (l.status ?? 'ACTIVE') === 'ACTIVE')
  const grandTotal = activeLines.reduce((s, l) => s + Number(l.total_netto), 0)

  if (lines.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-8">Belum ada item dalam session ini.</p>
    )
  }

  return (
    <div className="space-y-4">
      {Object.entries(byBranch).map(([branch, branchLines]) => {
        const subtotal = branchLines
          .filter((l) => (l.status ?? 'ACTIVE') === 'ACTIVE')
          .reduce((s, l) => s + Number(l.total_netto), 0)
        return (
          <div
            key={branch}
            className="rounded-xl border border-gray-200/60 dark:border-gray-700/60 overflow-hidden"
          >
            <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{branch}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase">
                    <th className="px-4 py-2">Produk</th>
                    <th className="px-4 py-2 text-right">Qty</th>
                    <th className="px-4 py-2 text-right">Harga Netto</th>
                    <th className="px-4 py-2 text-right">Subtotal</th>
                    <th className="px-4 py-2">Status</th>
                    {showActions && <th className="px-4 py-2">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {branchLines.map((line) => {
                    const isActive = (line.status ?? 'ACTIVE') === 'ACTIVE'
                    return (
                      <tr
                        key={line.id}
                        className={!isActive ? 'opacity-60 bg-gray-50/50 dark:bg-gray-800/20' : undefined}
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {line.product_name}
                          </p>
                          <p className="text-xs text-gray-400">{line.product_code}</p>
                          {line.po_number && (
                            <p className="text-xs text-teal-600 mt-0.5">PO: {line.po_number}</p>
                          )}
                          {!isActive && line.cancel_reason && (
                            <p className="text-xs text-red-500 mt-1">{line.cancel_reason}</p>
                          )}
                          {!isActive && line.correction_journal_id && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              Jurnal koreksi:{' '}
                              <span className="font-mono">
                                {line.correction_journal_id.slice(0, 8)}...
                              </span>
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">{line.qty}</td>
                        <td className="px-4 py-3 text-right">{fmtCurrency(line.unit_price_netto)}</td>
                        <td className="px-4 py-3 text-right font-medium">
                          {fmtCurrency(line.total_netto)}
                        </td>
                        <td className="px-4 py-3">
                          {isActive ? (
                            <span className="text-xs text-green-600 font-medium">Aktif</span>
                          ) : (
                            <span className="text-xs text-red-500 font-medium">Dibatalkan</span>
                          )}
                        </td>
                        {showActions && (
                          <td className="px-4 py-3">
                            {sessionStatus === 'DRAFT' && isActive && onRemoveLine && (
                              <button
                                type="button"
                                onClick={() => onRemoveLine(line.id)}
                                disabled={isRemovePending}
                                className="text-xs text-red-500 hover:underline disabled:opacity-50"
                              >
                                Hapus
                              </button>
                            )}
                            {sessionStatus === 'SHIPPED' && isActive && onCancelLine && (
                              <button
                                type="button"
                                onClick={() =>
                                  onCancelLine({
                                    id: line.id,
                                    productName: line.product_name ?? 'Item',
                                  })
                                }
                                className="text-xs text-orange-500 hover:underline"
                              >
                                Batalkan Item
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50/50 dark:bg-gray-800/30">
                    <td
                      colSpan={3}
                      className="px-4 py-2 text-right text-xs font-medium text-gray-500"
                    >
                      SUBTOTAL
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-gray-900 dark:text-white">
                      {fmtCurrency(subtotal)}
                    </td>
                    <td className="px-4 py-2" />
                    {showActions && <td className="px-4 py-2" />}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )
      })}
      <div className="flex justify-end pt-2 border-t border-gray-200 dark:border-gray-700">
        <p className="text-base font-bold text-gray-900 dark:text-white">
          Total Keseluruhan (aktif): {fmtCurrency(grandTotal)}
        </p>
      </div>
    </div>
  )
}
