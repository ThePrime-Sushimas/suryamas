import { fmtCurrency } from '../utils/format'
import type { MarketplaceCheckoutLine } from '../types/marketplacePo.types'

export function SessionItemsTab({ lines }: { lines: MarketplaceCheckoutLine[] }) {
  const byBranch = lines.reduce<Record<string, MarketplaceCheckoutLine[]>>((acc, line) => {
    const key = line.branch_name ?? line.branch_id
    if (!acc[key]) acc[key] = []
    acc[key].push(line)
    return acc
  }, {})

  const grandTotal = lines.reduce((s, l) => s + Number(l.total_netto), 0)

  if (lines.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-8">Belum ada item dalam session ini.</p>
    )
  }

  return (
    <div className="space-y-4">
      {Object.entries(byBranch).map(([branch, branchLines]) => {
        const subtotal = branchLines.reduce((s, l) => s + Number(l.total_netto), 0)
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {branchLines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {line.product_name}
                        </p>
                        <p className="text-xs text-gray-400">{line.product_code}</p>
                        {line.po_number && (
                          <p className="text-xs text-teal-600 mt-0.5">PO: {line.po_number}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">{line.qty}</td>
                      <td className="px-4 py-3 text-right">{fmtCurrency(line.unit_price_netto)}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        {fmtCurrency(line.total_netto)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50/50 dark:bg-gray-800/30">
                    <td colSpan={3} className="px-4 py-2 text-right text-xs font-medium text-gray-500">
                      Subtotal cabang
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-gray-900 dark:text-white">
                      {fmtCurrency(subtotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )
      })}
      <div className="flex justify-end pt-2 border-t border-gray-200 dark:border-gray-700">
        <p className="text-base font-bold text-gray-900 dark:text-white">
          Total Keseluruhan: {fmtCurrency(grandTotal)}
        </p>
      </div>
    </div>
  )
}
