import { logInfo, logError } from '../config/logger'

interface PONotificationData {
  po_number: string
  order_date: string
  expected_delivery_date: string | null
  supplier_name: string
  branch_name: string
  total_amount: number
  lines: Array<{ product_name: string; qty: number; uom: string; unit_price: number }>
}

export class WhatsAppService {
  private readonly apiUrl = 'https://api.fonnte.com/send'

  private getToken(): string | undefined {
    return process.env.FONNTE_TOKEN
  }

  async sendPONotification(po: PONotificationData, phoneNumber: string): Promise<void> {
    const token = this.getToken()
    if (!token) {
      logError('FONNTE_TOKEN not configured', {})
      throw new Error('WhatsApp service not configured')
    }

    const message = this.formatMessage(po)
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: { 'Authorization': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: phoneNumber, message, countryCode: '62' }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`WhatsApp API error: ${response.status} - ${errorText}`)
    }

    logInfo('WhatsApp sent', { po_number: po.po_number, phone: phoneNumber })
  }

  private formatMessage(po: PONotificationData): string {
    const items = po.lines
      .map(l => `- ${l.product_name}: ${l.qty} ${l.uom} @ Rp ${l.unit_price.toLocaleString('id-ID')}`)
      .join('\n')

    return [
      `🛒 *Purchase Order Baru*`,
      ``,
      `Kepada: ${po.supplier_name}`,
      `PO Number: ${po.po_number}`,
      `Tanggal: ${po.order_date}`,
      `Dibutuhkan: ${po.expected_delivery_date ?? '-'}`,
      ``,
      `*Items:*`,
      items,
      ``,
      `*Total Estimasi:* Rp ${po.total_amount.toLocaleString('id-ID')}`,
      ``,
      `Mohon konfirmasi ketersediaan barang.`,
      ``,
      `Terima kasih,`,
      po.branch_name,
    ].join('\n')
  }
}

export const whatsappService = new WhatsAppService()
