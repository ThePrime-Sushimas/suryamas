import QRCode from 'qrcode'
import PDFDocument from 'pdfkit'

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

/**
 * Generate a QR code as a data URL for a single asset.
 * The QR encodes: {FRONTEND_URL}/fixed-assets/{assetId}
 */
export async function generateQrCode(assetId: string): Promise<string> {
  const url = `${FRONTEND_URL}/fixed-assets/${assetId}`
  const dataUrl = await QRCode.toDataURL(url, {
    width: 200,
    margin: 1,
    errorCorrectionLevel: 'M',
  })
  return dataUrl
}

/**
 * Generate a PDF with a grid of QR codes for bulk printing.
 * Layout: A4 page (595 × 842 pts), 4 columns × 7 rows = 28 QR codes per page.
 * Each cell contains the QR code image and the asset_code label below it.
 */
export async function generateBulkQrPdf(
  assets: Array<{ id: string; asset_code: string }>
): Promise<Buffer> {
  const PAGE_WIDTH = 595
  const PAGE_HEIGHT = 842
  const COLS = 4
  const ROWS = 7
  const ITEMS_PER_PAGE = COLS * ROWS

  const MARGIN_X = 30
  const MARGIN_Y = 30
  const CELL_WIDTH = (PAGE_WIDTH - 2 * MARGIN_X) / COLS
  const CELL_HEIGHT = (PAGE_HEIGHT - 2 * MARGIN_Y) / ROWS
  const QR_SIZE = Math.min(CELL_WIDTH - 20, CELL_HEIGHT - 30) // Leave room for label
  const LABEL_FONT_SIZE = 7

  const doc = new PDFDocument({
    size: 'A4',
    margin: 0,
    autoFirstPage: false,
  })

  const chunks: Buffer[] = []
  doc.on('data', (chunk: Buffer) => chunks.push(chunk))

  const pdfReady = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })

  // Process assets in pages
  const totalPages = Math.ceil(assets.length / ITEMS_PER_PAGE)

  for (let page = 0; page < totalPages; page++) {
    doc.addPage({ size: 'A4', margin: 0 })

    const pageAssets = assets.slice(
      page * ITEMS_PER_PAGE,
      (page + 1) * ITEMS_PER_PAGE
    )

    for (let i = 0; i < pageAssets.length; i++) {
      const asset = pageAssets[i]
      const col = i % COLS
      const row = Math.floor(i / COLS)

      const cellX = MARGIN_X + col * CELL_WIDTH
      const cellY = MARGIN_Y + row * CELL_HEIGHT

      // Generate QR as PNG buffer for embedding in PDF
      const url = `${FRONTEND_URL}/fixed-assets/${asset.id}`
      const qrBuffer = await QRCode.toBuffer(url, {
        width: QR_SIZE * 2, // Higher res for print quality
        margin: 1,
        errorCorrectionLevel: 'M',
      })

      // Center QR in cell
      const qrX = cellX + (CELL_WIDTH - QR_SIZE) / 2
      const qrY = cellY + 5

      doc.image(qrBuffer, qrX, qrY, {
        width: QR_SIZE,
        height: QR_SIZE,
      })

      // Asset code label below QR
      const labelY = qrY + QR_SIZE + 3
      doc
        .fontSize(LABEL_FONT_SIZE)
        .font('Helvetica')
        .text(asset.asset_code, cellX, labelY, {
          width: CELL_WIDTH,
          align: 'center',
        })
    }
  }

  doc.end()
  return pdfReady
}
