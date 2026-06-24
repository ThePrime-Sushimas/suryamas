import PDFDocument from 'pdfkit'
import type { ClosingSnapshotHeader } from './closing-snapshots.repository'

interface PdfGenerateParams {
  header: ClosingSnapshotHeader
  companyName: string
  periodLabel: string
  trialBalance: Array<Record<string, unknown>>
  incomeStatement: Array<Record<string, unknown>>
  balanceSheet: Array<Record<string, unknown>>
}

const PAGE_MARGIN = 30
const FONT_SIZE_TITLE = 12
const FONT_SIZE_SUBTITLE = 9
const FONT_SIZE_TABLE = 7
const FONT_SIZE_HEADER = 7.5
const ROW_HEIGHT = 13
const COL_GAP = 2

function fmtNum(n: unknown): string {
  const num = Number(n ?? 0)
  if (num === 0) return '-'
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(num)
}

/**
 * Generate a PDF buffer for a closing snapshot.
 * Trial Balance uses LANDSCAPE A4 (wide table), IS/BS use PORTRAIT A4.
 */
export function generateSnapshotPdf(params: PdfGenerateParams): Promise<Buffer> {
  const { header, companyName, periodLabel, trialBalance, incomeStatement, balanceSheet } = params

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape', // Start landscape for Trial Balance
      margins: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN },
      bufferPages: true,
    })

    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // ─── Page Header Helper ────────────────────────────────────────────────
    function drawPageHeader(title: string, usableWidth: number) {
      doc.fontSize(FONT_SIZE_TITLE).font('Helvetica-Bold')
        .text(companyName, PAGE_MARGIN, PAGE_MARGIN, { align: 'center', width: usableWidth })
      doc.fontSize(FONT_SIZE_SUBTITLE).font('Helvetica')
        .text(`${title}`, { align: 'center', width: usableWidth })
        .text(`Periode: ${periodLabel} | Versi: v${header.version} | Cetak: ${new Date().toLocaleDateString('id-ID')}`, { align: 'center', width: usableWidth })
      doc.moveDown(0.3)
      doc.moveTo(PAGE_MARGIN, doc.y).lineTo(PAGE_MARGIN + usableWidth, doc.y).stroke()
      doc.moveDown(0.3)
    }

    // ─── Table Header Helper ─────────────────────────────────────────────────
    function drawTableHeader(columns: { label: string; width: number; align?: 'left' | 'right' }[]) {
      doc.font('Helvetica-Bold').fontSize(FONT_SIZE_HEADER)
      const headerY = doc.y
      let x = PAGE_MARGIN
      for (const col of columns) {
        doc.text(col.label, x, headerY, { width: col.width, align: col.align ?? 'left' })
        x += col.width + COL_GAP
      }
      doc.y = headerY + ROW_HEIGHT
      doc.moveTo(PAGE_MARGIN, doc.y).lineTo(PAGE_MARGIN + columns.reduce((s, c) => s + c.width + COL_GAP, -COL_GAP), doc.y).lineWidth(0.3).stroke()
      doc.moveDown(0.1)
    }

    // ─── Table Drawing with Page Break + Header Reprint ──────────────────────
    function drawTable(
      columns: { label: string; width: number; align?: 'left' | 'right' }[],
      rows: string[][],
      pageTitle: string,
      usableWidth: number,
      pageHeight: number,
    ) {
      drawTableHeader(columns)

      doc.font('Helvetica').fontSize(FONT_SIZE_TABLE)
      for (const row of rows) {
        // Check page break
        if (doc.y + ROW_HEIGHT > pageHeight - PAGE_MARGIN - 10) {
          doc.addPage()
          drawPageHeader(pageTitle + ' (lanjutan)', usableWidth)
          drawTableHeader(columns)
          doc.font('Helvetica').fontSize(FONT_SIZE_TABLE)
        }

        const rowY = doc.y
        let x = PAGE_MARGIN
        for (let i = 0; i < columns.length; i++) {
          const col = columns[i]
          doc.text(row[i] ?? '', x, rowY, { width: col.width, align: col.align ?? 'left' })
          x += col.width + COL_GAP
        }
        doc.y = rowY + ROW_HEIGHT
      }
    }

    // ─── Page 1+: Trial Balance (LANDSCAPE) ──────────────────────────────────
    const landscapeWidth = doc.page.width - PAGE_MARGIN * 2
    const landscapeHeight = doc.page.height

    drawPageHeader('Trial Balance (Neraca Saldo)', landscapeWidth)

    const tbCols = [
      { label: 'Kode', width: 50 },
      { label: 'Nama Akun', width: 180 },
      { label: 'Tipe', width: 50 },
      { label: 'Open D', width: 70, align: 'right' as const },
      { label: 'Open C', width: 70, align: 'right' as const },
      { label: 'Period D', width: 70, align: 'right' as const },
      { label: 'Period C', width: 70, align: 'right' as const },
      { label: 'Close D', width: 70, align: 'right' as const },
      { label: 'Close C', width: 70, align: 'right' as const },
    ]
    const tbRows = trialBalance.map(r => [
      String(r.account_code ?? ''),
      String(r.account_name ?? '').slice(0, 40),
      String(r.account_type ?? ''),
      fmtNum(r.opening_debit),
      fmtNum(r.opening_credit),
      fmtNum(r.period_debit),
      fmtNum(r.period_credit),
      fmtNum(r.closing_debit),
      fmtNum(r.closing_credit),
    ])
    drawTable(tbCols, tbRows, 'Trial Balance', landscapeWidth, landscapeHeight)

    // ─── Income Statement (new page, PORTRAIT) ───────────────────────────────
    doc.addPage({ size: 'A4', layout: 'portrait', margins: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN } })
    const portraitWidth = doc.page.width - PAGE_MARGIN * 2
    const portraitHeight = doc.page.height

    drawPageHeader('Income Statement (Laba Rugi)', portraitWidth)

    const isCols = [
      { label: 'Kode', width: 50 },
      { label: 'Nama Akun', width: 200 },
      { label: 'Tipe', width: 60 },
      { label: 'Group', width: 90 },
      { label: 'Debit', width: 65, align: 'right' as const },
      { label: 'Credit', width: 65, align: 'right' as const },
    ]
    const isRows = incomeStatement.map(r => [
      String(r.account_code ?? ''),
      String(r.account_name ?? '').slice(0, 50),
      String(r.account_type ?? ''),
      String(r.group_label ?? '').slice(0, 25),
      fmtNum(r.debit_amount),
      fmtNum(r.credit_amount),
    ])
    drawTable(isCols, isRows, 'Income Statement', portraitWidth, portraitHeight)

    // Summary
    doc.moveDown(0.5)
    doc.font('Helvetica-Bold').fontSize(FONT_SIZE_SUBTITLE)
    doc.text(`Total Revenue: ${fmtNum(header.total_revenue)}`, PAGE_MARGIN)
    doc.text(`Total Expense: ${fmtNum(header.total_expense)}`)
    doc.text(`Net Income: ${fmtNum(header.net_income)}`)

    // ─── Balance Sheet (new page, PORTRAIT) ──────────────────────────────────
    doc.addPage({ size: 'A4', layout: 'portrait', margins: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN } })

    drawPageHeader('Balance Sheet (Neraca)', portraitWidth)

    const bsCols = [
      { label: 'Kode', width: 50 },
      { label: 'Nama Akun', width: 200 },
      { label: 'Tipe', width: 60 },
      { label: 'Group', width: 90 },
      { label: 'Debit', width: 65, align: 'right' as const },
      { label: 'Credit', width: 65, align: 'right' as const },
    ]
    const bsRows = balanceSheet.map(r => [
      String(r.account_code ?? ''),
      String(r.account_name ?? '').slice(0, 50),
      String(r.account_type ?? ''),
      String(r.group_label ?? '').slice(0, 25),
      fmtNum(r.debit_amount),
      fmtNum(r.credit_amount),
    ])
    drawTable(bsCols, bsRows, 'Balance Sheet', portraitWidth, portraitHeight)

    doc.end()
  })
}
