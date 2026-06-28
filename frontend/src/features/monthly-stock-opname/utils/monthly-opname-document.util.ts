import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { MonthlyStockOpnameDetail, MonthlyStockOpnameLine } from '../types'

type JsPdfWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } }

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v)

const fmtQty = (v: number) =>
  new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v)

function safePdfFilename(opnameNumber: string): string {
  return opnameNumber.replace(/[^\w.-]+/g, '_') || 'monthly-stock-opname'
}

function formatMovement(v: number): string {
  if (Math.abs(v) <= 0.0001) return '-'
  const prefix = v > 0 ? '+' : ''
  return `${prefix}${fmtQty(v)}`
}

function formatSelisihQty(v: number | null): string {
  if (v === null || Math.abs(v) <= 0.0001) return '-'
  const prefix = v > 0 ? '+' : ''
  return `${prefix}${fmtQty(v)}`
}

function formatSelisihValue(v: number | null): string {
  if (v === null || Math.abs(v) <= 0.0001) return '-'
  return fmtCurrency(v)
}

function formatActual(v: number | null): string {
  if (v === null) return 'belum diisi'
  return fmtQty(v)
}

function rowFillColor(line: MonthlyStockOpnameLine): number[] | undefined {
  if (line.selisih_qty === null || Math.abs(Number(line.selisih_qty)) <= 0.0001) return undefined
  return Number(line.selisih_qty) < 0 ? [254, 226, 226] : [220, 252, 231]
}

export function exportMonthlyOpnamePdf(detail: MonthlyStockOpnameDetail): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('STOCK OPNAME BULANAN', pageWidth / 2, 14, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text(detail.opname_number, pageWidth / 2, 20, { align: 'center' })

  const col1X = 14
  const col2X = pageWidth / 2 + 4
  let infoY = 28

  const drawInfo = (label: string, value: string, x: number, y: number) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(label, x, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const lines = doc.splitTextToSize(value || '—', pageWidth / 2 - 22)
    doc.text(lines, x, y + 4)
  }

  drawInfo('Tanggal Opname', fmtDate(detail.opname_date), col1X, infoY)
  drawInfo('Status', detail.status, col2X, infoY)
  infoY += 14
  drawInfo('Cabang', detail.branch_name, col1X, infoY)
  drawInfo('Gudang', detail.warehouse_name, col2X, infoY)
  infoY += 14
  drawInfo('PIC', detail.pic_name, col1X, infoY)
  drawInfo(
    'Progress',
    `${detail.summary.completed_products}/${detail.summary.total_products} produk (${detail.summary.completion_pct}%)`,
    col2X,
    infoY,
  )
  infoY += 14
  drawInfo('Produk Selisih', String(detail.summary.products_with_selisih), col1X, infoY)
  drawInfo('Total Selisih Nilai', fmtCurrency(detail.summary.total_selisih_value), col2X, infoY)

  const tableBody = detail.lines.map((line) => [
    `${line.product_code}\n${line.product_name}`,
    fmtQty(Number(line.snapshot_qty)),
    formatMovement(Number(line.movement_during_so)),
    fmtQty(Number(line.expected_qty)),
    formatActual(line.actual_qty !== null ? Number(line.actual_qty) : null),
    formatSelisihQty(line.selisih_qty !== null ? Number(line.selisih_qty) : null),
    formatSelisihValue(line.selisih_value !== null ? Number(line.selisih_value) : null),
    line.investigasi_note?.trim() || (line.selisih_qty !== null && Number(line.selisih_qty) !== 0 ? 'wajib diisi' : '-'),
  ])

  autoTable(doc, {
    startY: infoY + 8,
    head: [['Produk', 'Snapshot', 'Movement', 'Expected', 'Actual', 'Selisih Qty', 'Selisih Nilai', 'Investigasi']],
    body: tableBody.length > 0 ? tableBody : [['—', '—', '—', '—', '—', '—', '—', '—']],
    styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak', valign: 'top' },
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 7.5 },
    columnStyles: {
      0: { cellWidth: 52 },
      1: { halign: 'right', cellWidth: 18 },
      2: { halign: 'right', cellWidth: 20 },
      3: { halign: 'right', cellWidth: 20 },
      4: { halign: 'right', cellWidth: 20 },
      5: { halign: 'right', cellWidth: 22 },
      6: { halign: 'right', cellWidth: 28 },
      7: { cellWidth: 40 },
    },
    didParseCell: (data) => {
      if (data.section !== 'body') return
      const line = detail.lines[data.row.index]
      if (!line) return
      const fill = rowFillColor(line)
      if (fill) data.cell.styles.fillColor = fill
    },
  })

  const finalY = (doc as JsPdfWithAutoTable).lastAutoTable?.finalY ?? infoY + 8

  doc.setFontSize(7)
  doc.setTextColor(100)
  doc.text(`Diekspor ${new Date().toLocaleString('id-ID')}`, pageWidth / 2, Math.min(finalY + 8, pageHeight - 8), {
    align: 'center',
  })

  doc.save(`${safePdfFilename(detail.opname_number)}.pdf`)
}
