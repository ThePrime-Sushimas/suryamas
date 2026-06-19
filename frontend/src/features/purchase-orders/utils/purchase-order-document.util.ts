import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { PurchaseOrder } from '../api/purchaseOrders.api'

const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n)

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })

type JsPdfWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } }

function safePdfFilename(poNumber: string): string {
  return poNumber.replace(/[^\w.-]+/g, '_') || 'purchase-order'
}

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function formatPaymentLabel(po: PurchaseOrder): string {
  if (po.payment_term_name) return po.payment_term_name
  if (po.payment_type === 'CASH') return 'Tunai'
  if (po.payment_terms_days) return `Tempo ${po.payment_terms_days} hari`
  return '—'
}

export function buildPurchaseOrderWhatsAppMessage(po: PurchaseOrder): string {
  const items = (po.lines ?? [])
    .map((l, i) => `${i + 1}. ${l.product_name} - ${fmt(l.qty)} ${l.uom}`)
    .join('\n')

  return (
    `*ORDERAN ${po.branch_name}*\n\n` +
    `• PO: ${po.po_number}\n` +
    `• Tanggal: ${new Date(po.order_date).toLocaleDateString('id-ID')}\n` +
    `• Cabang: ${po.branch_name}\n` +
    `• Supplier: ${po.supplier_name}\n\n` +
    `*DETAIL ITEM*\n${items}` +
    (po.pr_notes ? `\n\n📝 Catatan PR: ${po.pr_notes}` : '') +
    (po.notes ? `\n\n📝 Catatan PO: ${po.notes}` : '') +
    `\n\n_Dokumen ini digenerate otomatis_`
  )
}

export function normalizeWhatsAppPhone(raw: string): string {
  let clean = raw.replace(/[^0-9]/g, '')
  if (clean.startsWith('0')) clean = '62' + clean.substring(1)
  if (!clean.startsWith('62')) clean = '62' + clean
  return clean
}

export function openPurchaseOrderWhatsApp(po: PurchaseOrder, phone: string): void {
  const trimmed = phone.trim()
  if (!trimmed) return
  const message = buildPurchaseOrderWhatsAppMessage(po)
  const url = `https://wa.me/${normalizeWhatsAppPhone(trimmed)}?text=${encodeURIComponent(message)}`
  window.open(url, '_blank')
}

export function buildPurchaseOrderPrintHtml(po: PurchaseOrder): string {
  const lines = po.lines ?? []
  const paymentLabel = formatPaymentLabel(po)

  const rows = lines
    .map(
      (l, i) =>
        `<tr>
          <td class="text-center">${i + 1}</td>
          <td>
            <strong>${esc(l.product_name ?? '')}</strong>
            ${l.product_code ? `<br><span class="muted">${esc(l.product_code)}</span>` : ''}
          </td>
          <td class="text-right">${fmt(l.qty)}</td>
          <td class="text-center">${esc(l.uom)}</td>
        </tr>`
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>PO ${esc(po.po_number)}</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; margin: 24px; font-size: 11pt; color: #000; }
    h1 { margin: 0 0 4px; font-size: 16pt; }
    .subtitle { margin: 0; color: #444; font-size: 10pt; }
    .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #000; padding-bottom: 12px; }
    .info { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin-bottom: 20px; font-size: 10pt; }
    .info dt { font-weight: bold; margin: 0; }
    .info dd { margin: 0 0 8px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #333; padding: 8px; vertical-align: top; }
    th { background: #f0f0f0; font-size: 9pt; text-transform: uppercase; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .muted { color: #555; font-size: 9pt; }
    .notes { margin-top: 16px; padding: 10px; border: 1px solid #ccc; font-size: 10pt; }
    .footer { margin-top: 40px; text-align: center; font-size: 9pt; color: #666; }
    @media print { body { margin: 12mm; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>PURCHASE ORDER</h1>
    <p class="subtitle">${esc(po.po_number)}</p>
  </div>
  <dl class="info">
    <div><dt>Tanggal Order</dt><dd>${esc(fmtDate(po.order_date))}</dd></div>
    <div><dt>Cabang</dt><dd>${esc(po.branch_name)}</dd></div>
    <div><dt>Supplier</dt><dd>${esc(po.supplier_name)}</dd></div>
    <div><dt>Pembayaran</dt><dd>${esc(paymentLabel)}</dd></div>
    <div><dt>No. PR</dt><dd>${esc(po.request_number)}</dd></div>
    <div><dt>Status</dt><dd>${esc(po.status)}</dd></div>
  </dl>
  <table>
    <thead>
      <tr>
        <th class="text-center" style="width:40px">No</th>
        <th>Produk</th>
        <th class="text-right" style="width:90px">Qty</th>
        <th class="text-center" style="width:100px">Satuan beli</th>
      </tr>
    </thead>
    <tbody>${rows || '<tr><td colspan="4" class="text-center muted">Tidak ada item</td></tr>'}</tbody>
  </table>
  ${po.pr_notes ? `<div class="notes"><strong>Catatan PR:</strong> ${esc(po.pr_notes)}</div>` : ''}
  ${po.notes ? `<div class="notes" style="margin-top:8px"><strong>Catatan PO:</strong> ${esc(po.notes)}</div>` : ''}
  <p class="footer">Dicetak ${new Date().toLocaleString('id-ID')}</p>
</body>
</html>`
}

export function printPurchaseOrder(po: PurchaseOrder): void {
  const printWindow = window.open('', '_blank')
  if (!printWindow) return
  printWindow.document.write(buildPurchaseOrderPrintHtml(po))
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}

/** Export PO as PDF (same content as print view — no prices, no estimasi kirim). */
export function exportPurchaseOrderPdf(po: PurchaseOrder): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const paymentLabel = formatPaymentLabel(po)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('PURCHASE ORDER', pageWidth / 2, 18, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text(po.po_number, pageWidth / 2, 25, { align: 'center' })

  const col1X = 14
  const col2X = pageWidth / 2 + 4
  let infoY = 34

  const drawInfo = (label: string, value: string, x: number, y: number) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(label, x, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const lines = doc.splitTextToSize(value || '—', pageWidth / 2 - 20)
    doc.text(lines, x, y + 4.5)
  }

  drawInfo('Tanggal Order', fmtDate(po.order_date), col1X, infoY)
  drawInfo('Cabang', po.branch_name, col2X, infoY)
  infoY += 16
  drawInfo('Supplier', po.supplier_name, col1X, infoY)
  drawInfo('Pembayaran', paymentLabel, col2X, infoY)
  infoY += 16
  drawInfo('No. PR', po.request_number, col1X, infoY)
  drawInfo('Status', po.status, col2X, infoY)

  const lines = po.lines ?? []
  const tableBody = lines.map((l, i) => [
    String(i + 1),
    l.product_code ? `${l.product_name ?? ''}\n(${l.product_code})` : (l.product_name ?? ''),
    fmt(l.qty),
    l.uom,
  ])

  autoTable(doc, {
    startY: infoY + 10,
    head: [['No', 'Produk', 'Qty', 'Satuan beli']],
    body: tableBody.length > 0 ? tableBody : [['—', 'Tidak ada item', '—', '—']],
    styles: { fontSize: 9, cellPadding: 2.5, overflow: 'linebreak' },
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      2: { halign: 'right', cellWidth: 22 },
      3: { halign: 'center', cellWidth: 28 },
    },
  })

  let finalY = (doc as JsPdfWithAutoTable).lastAutoTable?.finalY ?? infoY + 10

  if (po.pr_notes?.trim()) {
    finalY += 8
    doc.setTextColor(0)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('Catatan PR:', 14, finalY)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const noteLines = doc.splitTextToSize(po.pr_notes.trim(), pageWidth - 28)
    doc.text(noteLines, 14, finalY + 5)
    finalY += 5 + noteLines.length * 4.5
  }

  if (po.notes?.trim()) {
    finalY += 8
    doc.setTextColor(0)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('Catatan PO:', 14, finalY)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const noteLines = doc.splitTextToSize(po.notes.trim(), pageWidth - 28)
    doc.text(noteLines, 14, finalY + 5)
    finalY += 5 + noteLines.length * 4.5
  }

  doc.setFontSize(8)
  doc.setTextColor(100)
  doc.text(`Diekspor ${new Date().toLocaleString('id-ID')}`, pageWidth / 2, pageHeight - 10, {
    align: 'center',
  })

  doc.save(`${safePdfFilename(po.po_number)}.pdf`)
}
