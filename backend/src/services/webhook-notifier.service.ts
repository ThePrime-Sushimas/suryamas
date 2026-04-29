import { logInfo, logWarn } from '@/config/logger'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || ''
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || ''

const RATE_LIMIT_MS = 10_000
let lastSent = 0

export interface ErrorAlert {
  severity: string
  module: string
  route: string
  url: string
  message: string
  timestamp: string
  userId?: string
  userName?: string
  userAgent?: string
  statusCode?: number
  errorType?: string
}

function shouldSend(): boolean {
  if (!TELEGRAM_BOT_TOKEN && !DISCORD_WEBHOOK_URL) return false
  if (Date.now() - lastSent < RATE_LIMIT_MS) return false
  return true
}

function formatMessage(alert: ErrorAlert): string {
  const icons: Record<string, string> = { CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🔵' }
  const icon = icons[alert.severity] || '⚪'

  const lines = [
    `${icon} *${alert.severity}*${alert.statusCode ? ` (${alert.statusCode})` : ''} — ${alert.module}`,
    '',
    `📍 \`${alert.route || 'N/A'}\``,
    alert.url ? `🔗 \`${alert.url}\`` : '',
    '',
    `💬 ${alert.message}`,
    '',
    `👤 ${alert.userName || alert.userId || 'Anonymous'}`,
    `🕐 ${alert.timestamp}`,
  ]

  return lines.filter(Boolean).join('\n')
}

async function sendTelegram(text: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'Markdown' }),
    })
  } catch (e) {
    logWarn('Telegram notification failed', { error: e instanceof Error ? e.message : String(e) })
  }
}

async function sendDiscord(text: string): Promise<void> {
  if (!DISCORD_WEBHOOK_URL) return
  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text }),
    })
  } catch (e) {
    logWarn('Discord notification failed', { error: e instanceof Error ? e.message : String(e) })
  }
}

export function notifyError(alert: ErrorAlert): void {
  if (!shouldSend()) return
  lastSent = Date.now()
  const msg = formatMessage(alert)
  sendTelegram(msg).catch(() => {})
  sendDiscord(msg).catch(() => {})
  logInfo('Error notification sent', { severity: alert.severity, module: alert.module })
}
