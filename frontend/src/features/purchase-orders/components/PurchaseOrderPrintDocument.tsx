import type { PurchaseOrder } from '../api/purchaseOrders.api'
import { formatPaymentLabel } from '../utils/purchase-order-document.util'

const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n)
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })

interface PurchaseOrderPrintDocumentProps {
  po: PurchaseOrder
}

export function PurchaseOrderPrintDocument({ po }: PurchaseOrderPrintDocumentProps) {
  const lines = po.lines ?? []
  const paymentLabel = formatPaymentLabel(po)

  return (
    <article className="mx-auto max-w-4xl bg-white text-black print:max-w-none">
      <header className="text-center border-b-2 border-black pb-4 mb-6">
        <h1 className="text-xl font-bold tracking-wide">PURCHASE ORDER</h1>
        <p className="text-sm text-gray-600 mt-1">{po.po_number}</p>
      </header>

      <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm mb-6">
        <div>
          <dt className="font-semibold text-gray-700">Tanggal Order</dt>
          <dd>{fmtDate(po.order_date)}</dd>
        </div>
        <div>
          <dt className="font-semibold text-gray-700">Cabang</dt>
          <dd>{po.branch_name}</dd>
        </div>
        <div>
          <dt className="font-semibold text-gray-700">Supplier</dt>
          <dd>{po.supplier_name}</dd>
        </div>
        <div>
          <dt className="font-semibold text-gray-700">Pembayaran</dt>
          <dd>{paymentLabel}</dd>
        </div>
        <div>
          <dt className="font-semibold text-gray-700">No. PR</dt>
          <dd>{po.request_number}</dd>
        </div>
        <div>
          <dt className="font-semibold text-gray-700">Status</dt>
          <dd>{po.status}</dd>
        </div>
      </dl>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border border-gray-800 bg-gray-100">
            <th className="border border-gray-800 px-2 py-2 w-10 text-center">No</th>
            <th className="border border-gray-800 px-2 py-2 text-left">Produk</th>
            <th className="border border-gray-800 px-2 py-2 w-24 text-right">Qty</th>
            <th className="border border-gray-800 px-2 py-2 w-28 text-center">Satuan beli</th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 ? (
            <tr>
              <td colSpan={4} className="border border-gray-800 px-2 py-4 text-center text-gray-500">
                Tidak ada item
              </td>
            </tr>
          ) : (
            lines.map((line, idx) => (
              <tr key={line.id ?? idx}>
                <td className="border border-gray-800 px-2 py-2 text-center">{idx + 1}</td>
                <td className="border border-gray-800 px-2 py-2">
                  <div className="font-medium">{line.product_name}</div>
                  {line.product_code && (
                    <div className="text-xs text-gray-600">{line.product_code}</div>
                  )}
                </td>
                <td className="border border-gray-800 px-2 py-2 text-right font-mono">{fmt(line.qty)}</td>
                <td className="border border-gray-800 px-2 py-2 text-center">{line.uom}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {po.notes && (
        <div className="mt-4 p-3 border border-gray-400 text-sm">
          <span className="font-semibold">Catatan: </span>
          {po.notes}
        </div>
      )}

      <p className="mt-10 text-center text-xs text-gray-500 print:mt-8">
        Dicetak {new Date().toLocaleString('id-ID')}
      </p>
    </article>
  )
}
