import { paymentMethodAlertsRepository } from './payment-method-alerts.repository'
import { PaymentMethodAlertErrors } from './payment-method-alerts.errors'
import { AuditService } from '../monitoring/monitoring.service'
import { logInfo, logError, logWarn } from '../../config/logger'
import type { PaymentMethodAlert, CreateAlertDto, UpdateAlertDto, PaymentMethodAlertHistory, AlertHistoryFilters } from './payment-method-alerts.types'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''

export class PaymentMethodAlertsService {
  async list(companyId: string): Promise<PaymentMethodAlert[]> {
    return paymentMethodAlertsRepository.findAll(companyId)
  }

  async getById(id: string, companyId: string): Promise<PaymentMethodAlert> {
    const alert = await paymentMethodAlertsRepository.findById(id, companyId)
    if (!alert) throw PaymentMethodAlertErrors.NOT_FOUND(id)
    return alert
  }

  async create(companyId: string, dto: CreateAlertDto, userId: string): Promise<PaymentMethodAlert> {
    const alert = await paymentMethodAlertsRepository.create(companyId, dto, userId)
    await AuditService.log('CREATE', 'payment_method_alert', alert.id, userId, null, alert)
    logInfo('Payment method alert created', { id: alert.id, payment_method_id: dto.payment_method_id, threshold: dto.threshold_amount })
    return alert
  }

  async update(id: string, companyId: string, dto: UpdateAlertDto, userId: string): Promise<PaymentMethodAlert> {
    const existing = await this.getById(id, companyId)
    const updated = await paymentMethodAlertsRepository.update(id, companyId, dto, userId)
    if (!updated) throw PaymentMethodAlertErrors.NOT_FOUND(id)
    await AuditService.log('UPDATE', 'payment_method_alert', id, userId, existing, updated)
    return updated
  }

  async delete(id: string, companyId: string, userId: string): Promise<void> {
    const existing = await this.getById(id, companyId)
    await paymentMethodAlertsRepository.softDelete(id, companyId, userId)
    await AuditService.log('DELETE', 'payment_method_alert', id, userId, existing, null)
  }

  async testAlert(id: string, companyId: string): Promise<void> {
    const alert = await this.getById(id, companyId)
    const msg = `🔔 *TEST ALERT: ${alert.payment_method_name || 'Payment Method'}*\n\nIni adalah test notifikasi.\nThreshold: Rp ${Number(alert.threshold_amount).toLocaleString('id-ID')}\n\n✅ Koneksi Telegram berhasil!`
    await sendTelegramMessage(alert.telegram_chat_id, msg)
  }

  async getHistory(companyId: string, filters: AlertHistoryFilters = {}): Promise<{ data: PaymentMethodAlertHistory[], total: number }> {
    return paymentMethodAlertsRepository.getHistory(companyId, filters)
  }

  async getHistoryById(id: string, companyId: string): Promise<PaymentMethodAlertHistory> {
    const history = await paymentMethodAlertsRepository.getHistoryById(id, companyId)
    if (!history) throw PaymentMethodAlertErrors.NOT_FOUND(id)
    return history
  }

  /**
   * Check all active alerts for a company after POS sync
   * Called from pos-sync.service.ts (fire-and-forget)
   */
  async checkAlerts(companyId: string, salesDate: string): Promise<void> {
    const alerts = await paymentMethodAlertsRepository.findActiveByCompany(companyId)
    
    if (alerts.length === 0) {
      return
    }

    const totals = await paymentMethodAlertsRepository.getDailyTotals(companyId, salesDate)
    
    if (totals.length === 0) {
      return
    }

    // Aggregate per payment_method
    const pmMap = new Map<number, { name: string; total: number; branches: Array<{ branch_name: string; amount: number }> }>()
    for (const t of totals) {
      if (!pmMap.has(t.payment_method_id)) {
        pmMap.set(t.payment_method_id, { name: t.payment_method_name, total: 0, branches: [] })
      }
      const entry = pmMap.get(t.payment_method_id)!
      entry.total += t.daily_total
      entry.branches.push({ branch_name: t.branch_name, amount: t.daily_total })
    }

    for (const alert of alerts) {
      const pmData = pmMap.get(alert.payment_method_id)
      if (!pmData) {
        continue
      }

      const currentTotal = pmData.total

      if (currentTotal < alert.threshold_amount) {
        continue
      }

      // Skip if already alerted for this amount level today
      if (alert.last_triggered_date === salesDate && currentTotal <= Number(alert.last_triggered_amount)) {
        continue
      }

      // Send alert
      const branchLines = pmData.branches
        .sort((a, b) => b.amount - a.amount)
        .map(b => `• ${b.branch_name}: Rp ${b.amount.toLocaleString('id-ID')}`)
        .join('\n')

      const msg = [
        `🔔 *ALERT: ${pmData.name}*`,
        '',
        `Total hari ini: *Rp ${currentTotal.toLocaleString('id-ID')}*`,
        `Threshold: Rp ${Number(alert.threshold_amount).toLocaleString('id-ID')}`,
        '',
        '📍 Breakdown per cabang:',
        branchLines,
        '',
        `📅 ${salesDate}`,
      ].join('\n')

      try {
        await sendTelegramMessage(alert.telegram_chat_id, msg)
        await paymentMethodAlertsRepository.updateLastTriggered(alert.id, salesDate, currentTotal)
        
        // Log to history
        await paymentMethodAlertsRepository.createHistory({
          alert_id: alert.id,
          payment_method_id: alert.payment_method_id,
          payment_method_name: pmData.name,
          company_id: companyId,
          triggered_date: salesDate,
          triggered_amount: currentTotal,
          threshold_amount: Number(alert.threshold_amount),
          branch_breakdown: pmData.branches,
          telegram_chat_id: alert.telegram_chat_id
        })
      } catch (err) {
        logError('Failed to send payment method alert', { alert_id: alert.id, error: err })
      }
    }
  }
}

async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN) {
    logWarn('TELEGRAM_BOT_TOKEN not set, skipping alert')
    return
  }
  
  // Validate chatId format (must be numeric or start with - for group chats)
  if (!/^-?\d+$/.test(chatId)) {
    throw new Error('Invalid Telegram chat ID format')
  }
  
  // Use fixed Telegram API URL (not user-controlled)
  const TELEGRAM_API_BASE = 'https://api.telegram.org'
  const url = new URL(`/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, TELEGRAM_API_BASE)
  
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Telegram API error: ${res.status} ${body}`)
  }
}

export const paymentMethodAlertsService = new PaymentMethodAlertsService()
