import { paymentMethodAlertGroupsRepository } from './payment-method-alert-groups.repository'
import { paymentMethodAlertsRepository } from './payment-method-alerts.repository'
import { PaymentMethodAlertErrors } from './payment-method-alerts.errors'
import { AuditService } from '../monitoring/monitoring.service'
import { logInfo, logError } from '../../config/logger'
import type { PaymentMethodAlertGroup, CreateAlertGroupDto, UpdateAlertGroupDto } from './payment-method-alert-groups.types'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''

export class PaymentMethodAlertGroupsService {
  async list(companyIds: string[]): Promise<PaymentMethodAlertGroup[]> {
    return paymentMethodAlertGroupsRepository.findAll(companyIds)
  }

  async getById(id: string, companyIds: string[]): Promise<PaymentMethodAlertGroup> {
    const group = await paymentMethodAlertGroupsRepository.findByIdAccessible(id, companyIds)
    if (!group) throw PaymentMethodAlertErrors.NOT_FOUND(id)
    return group
  }

  async create(companyId: string, dto: CreateAlertGroupDto, userId: string): Promise<PaymentMethodAlertGroup> {
    const group = await paymentMethodAlertGroupsRepository.create(companyId, dto, userId)
    await AuditService.log('CREATE', 'payment_method_alert_group', group.id, userId, null, group)
    logInfo('Payment method alert group created', { id: group.id, name: dto.name, payment_method_ids: dto.payment_method_ids, threshold: dto.threshold_amount })
    return group
  }

  async update(id: string, companyId: string, dto: UpdateAlertGroupDto, userId: string, existing?: PaymentMethodAlertGroup): Promise<PaymentMethodAlertGroup> {
    const record = existing ?? await paymentMethodAlertGroupsRepository.findByIdAccessible(id, [companyId])
    if (!record) throw PaymentMethodAlertErrors.NOT_FOUND(id)
    const updated = await paymentMethodAlertGroupsRepository.update(id, companyId, dto, userId)
    if (!updated) throw PaymentMethodAlertErrors.NOT_FOUND(id)
    await AuditService.log('UPDATE', 'payment_method_alert_group', id, userId, record, updated)
    return updated
  }

  async delete(id: string, companyId: string, userId: string, existing?: PaymentMethodAlertGroup): Promise<void> {
    const record = existing ?? await paymentMethodAlertGroupsRepository.findByIdAccessible(id, [companyId])
    if (!record) throw PaymentMethodAlertErrors.NOT_FOUND(id)
    await paymentMethodAlertGroupsRepository.softDelete(id, companyId, userId)
    await AuditService.log('DELETE', 'payment_method_alert_group', id, userId, record, null)
  }

  async testAlert(id: string, companyId: string, existing?: PaymentMethodAlertGroup): Promise<void> {
    const group = existing ?? await paymentMethodAlertGroupsRepository.findByIdAccessible(id, [companyId])
    if (!group) throw PaymentMethodAlertErrors.NOT_FOUND(id)
    const names = group.payment_method_names?.join(' + ') || group.payment_method_ids.join(', ')
    const msg = `🔔 *TEST ALERT GROUP: ${group.name}*\n\nIni adalah test notifikasi untuk grup.\nPayment Methods: ${names}\nThreshold: Rp ${Number(group.threshold_amount).toLocaleString('id-ID')}\n\n✅ Koneksi Telegram berhasil!`
    await sendTelegramMessage(group.telegram_chat_id, msg)
  }

  /**
   * Check all active alert groups for a company after POS sync.
   * Called from pos-sync or alongside existing checkAlerts.
   * Reuses the daily totals data already fetched by the single-alert check.
   */
  async checkAlertGroups(companyId: string, salesDate: string): Promise<void> {
    const groups = await paymentMethodAlertGroupsRepository.findActiveByCompany(companyId)

    if (groups.length === 0) return

    // Reuse the same daily totals query from the existing repository
    const totals = await paymentMethodAlertsRepository.getDailyTotals(companyId, salesDate)

    if (totals.length === 0) return

    // Build a map: payment_method_id -> { name, branches[] }
    const pmMap = new Map<number, { name: string; total: number; branches: Array<{ branch_name: string; amount: number }> }>()
    for (const t of totals) {
      if (!pmMap.has(t.payment_method_id)) {
        pmMap.set(t.payment_method_id, { name: t.payment_method_name, total: 0, branches: [] })
      }
      const entry = pmMap.get(t.payment_method_id)!
      entry.total += t.daily_total
      entry.branches.push({ branch_name: t.branch_name, amount: t.daily_total })
    }

    for (const group of groups) {
      // Sum totals across all payment methods in the group
      let combinedTotal = 0
      const pmBreakdown: Array<{ name: string; total: number; branches: Array<{ branch_name: string; amount: number }> }> = []

      for (const pmId of group.payment_method_ids) {
        const pmData = pmMap.get(pmId)
        if (pmData) {
          combinedTotal += pmData.total
          pmBreakdown.push(pmData)
        }
      }

      if (combinedTotal < group.threshold_amount) continue

      // Skip if already alerted for this amount level today
      if (group.last_triggered_date === salesDate && combinedTotal <= Number(group.last_triggered_amount)) continue

      // Build message with per-PM breakdown
      const pmLines = pmBreakdown
        .sort((a, b) => b.total - a.total)
        .map(pm => {
          const branchDetail = pm.branches
            .sort((a, b) => b.amount - a.amount)
            .map(b => `  • ${b.branch_name}: Rp ${b.amount.toLocaleString('id-ID')}`)
            .join('\n')
          return `📌 *${pm.name}*: Rp ${pm.total.toLocaleString('id-ID')}\n${branchDetail}`
        })
        .join('\n\n')

      const now = new Date()
      const formattedDateTime = now.toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })

      const msg = [
        `🔔 *ALERT GROUP: ${group.name}*`,
        '',
        `Total gabungan: *Rp ${combinedTotal.toLocaleString('id-ID')}*`,
        `Threshold: Rp ${Number(group.threshold_amount).toLocaleString('id-ID')}`,
        '',
        '📊 Breakdown per payment method:',
        pmLines,
        '',
        `📅 ${formattedDateTime} WIB`,
      ].join('\n')

      try {
        await sendTelegramMessage(group.telegram_chat_id, msg)
        await paymentMethodAlertGroupsRepository.updateLastTriggered(group.id, salesDate, combinedTotal)

        // Log to history (same table as single alerts, with alert_group_id)
        const allBranches = pmBreakdown.flatMap(pm =>
          pm.branches.map(b => ({ branch_name: `[${pm.name}] ${b.branch_name}`, amount: b.amount }))
        )
        await paymentMethodAlertsRepository.createGroupHistory({
          alert_group_id: group.id,
          alert_group_name: group.name,
          company_id: companyId,
          triggered_date: salesDate,
          triggered_amount: combinedTotal,
          threshold_amount: Number(group.threshold_amount),
          branch_breakdown: allBranches,
          telegram_chat_id: group.telegram_chat_id
        })
      } catch (err) {
        logError('Failed to send payment method alert group', { group_id: group.id, error: err })
      }
    }
  }
}

async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN) return

  if (!/^-?\d+$/.test(chatId)) {
    throw new Error('Invalid Telegram chat ID format')
  }

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

export const paymentMethodAlertGroupsService = new PaymentMethodAlertGroupsService()
