import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Printer, MessageCircle, FileDown } from 'lucide-react'
import { usePurchaseOrder } from '../api/purchaseOrders.api'
import { PurchaseOrderPrintDocument } from '../components/PurchaseOrderPrintDocument'
import { PoWhatsAppModal } from '../components/PoWhatsAppModal'
import {
  exportPurchaseOrderPdf,
  openPurchaseOrderWhatsApp,
  printPurchaseOrder,
} from '../utils/purchase-order-document.util'

export default function PurchaseOrderPrintPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: po, isLoading } = usePurchaseOrder(id ?? '')
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="h-8 w-48 bg-gray-200 animate-pulse rounded" />
      </div>
    )
  }

  if (!po) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-500">Purchase order tidak ditemukan</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(`/inventory/purchase-orders/${po.id}`)}
            className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft className="w-4 h-4" /> Kembali
          </button>
          <button
            type="button"
            onClick={() => exportPurchaseOrderPdf(po)}
            className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            <FileDown className="w-4 h-4" /> PDF
          </button>
          <button
            type="button"
            onClick={() => printPurchaseOrder(po)}
            className="flex items-center gap-1 px-3 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
          <button
            type="button"
            onClick={() => setShowWhatsAppModal(true)}
            className="flex items-center gap-1 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <MessageCircle className="w-4 h-4" /> WhatsApp
          </button>
        </div>
      </div>

      <div className="p-6 print:p-0 max-w-4xl mx-auto">
        <PurchaseOrderPrintDocument po={po} />
      </div>

      <PoWhatsAppModal
        open={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        onConfirm={async (phone) => {
          openPurchaseOrderWhatsApp(po, phone)
          setShowWhatsAppModal(false)
        }}
        title="Kirim via WhatsApp"
        description="Kirim ringkasan PO ke purchasing atau pihak terkait."
        confirmLabel="Buka WhatsApp"
      />
    </div>
  )
}
