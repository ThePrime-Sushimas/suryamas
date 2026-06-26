import type { BcaConfig } from './interfaces/bca-config.interface'
import { BcaConfigError } from './errors/bca.errors'

const REQUIRED_ENV_KEYS = [
  'BCA_BASE_URL',
  'BCA_CLIENT_ID',
  'BCA_CLIENT_SECRET',
  'BCA_PRIVATE_KEY',
  'BCA_PUBLIC_KEY',
  'BCA_PARTNER_ID',
  'BCA_CHANNEL_ID',
] as const

function wrapBase64AsPem(base64: string, label: 'PRIVATE KEY' | 'PUBLIC KEY'): string {
  const cleaned = base64.replace(/\s+/g, '')
  const lines = cleaned.match(/.{1,64}/g) ?? [cleaned]
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`
}

function normalizePemKey(key: string, kind: 'private' | 'public'): string {
  let trimmed = key.trim()
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    trimmed = trimmed.slice(1, -1).trim()
  }
  if (trimmed.includes('\\n')) {
    trimmed = trimmed.replace(/\\n/g, '\n')
  }
  if (trimmed.includes('-----BEGIN')) {
    return trimmed
  }

  // BCA portal sometimes exports raw base64 without PEM headers
  const label = kind === 'private' ? 'PRIVATE KEY' : 'PUBLIC KEY'
  return wrapBase64AsPem(trimmed, label)
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new BcaConfigError(`Missing required environment variable: ${name}`)
  }
  return value
}

export function loadBcaConfigFromEnv(overrides?: Partial<BcaConfig>): BcaConfig {
  for (const key of REQUIRED_ENV_KEYS) {
    if (!overrides && !process.env[key]?.trim()) {
      throw new BcaConfigError(`Missing required environment variable: ${key}`)
    }
  }

  const timeoutRaw = process.env.BCA_TIMEOUT_MS
  const timeoutMs = timeoutRaw ? Number(timeoutRaw) : 30_000

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new BcaConfigError('BCA_TIMEOUT_MS must be a positive number')
  }

  return {
    baseUrl: overrides?.baseUrl ?? requireEnv('BCA_BASE_URL'),
    clientId: overrides?.clientId ?? requireEnv('BCA_CLIENT_ID'),
    clientSecret: overrides?.clientSecret ?? requireEnv('BCA_CLIENT_SECRET'),
    privateKey: normalizePemKey(overrides?.privateKey ?? requireEnv('BCA_PRIVATE_KEY'), 'private'),
    publicKey: normalizePemKey(overrides?.publicKey ?? requireEnv('BCA_PUBLIC_KEY'), 'public'),
    partnerId: overrides?.partnerId ?? requireEnv('BCA_PARTNER_ID'),
    channelId: overrides?.channelId ?? requireEnv('BCA_CHANNEL_ID'),
    timeoutMs: overrides?.timeoutMs ?? timeoutMs,
    httpLogEnabled:
      overrides?.httpLogEnabled ?? process.env.BCA_HTTP_LOG === 'true',
    httpLogDir: overrides?.httpLogDir ?? process.env.BCA_HTTP_LOG_DIR ?? 'logs/bca',
  }
}

export function formatBcaTimestamp(date = new Date()): string {
  const jakartaOffsetMs = 7 * 60 * 60 * 1000
  const jakarta = new Date(date.getTime() + jakartaOffsetMs)
  return jakarta.toISOString().replace(/\.\d{3}Z$/, '+07:00')
}

export function generatePartnerReferenceNo(): string {
  const now = new Date()
  const pad = (n: number, len = 2) => String(n).padStart(len, '0')
  const datePart =
    `${now.getFullYear()}` +
    `${pad(now.getMonth() + 1)}` +
    `${pad(now.getDate())}` +
    `${pad(now.getHours())}` +
    `${pad(now.getMinutes())}` +
    `${pad(now.getSeconds())}`

  const randomPart = String(Math.floor(Math.random() * 1_000_000_000_000)).padStart(12, '0')
  return `${datePart}${randomPart}`.slice(0, 64)
}

export function maskStringToSign(stringToSign: string): string {
  const parts = stringToSign.split(':')
  if (parts.length >= 3) {
    parts[2] = '[REDACTED]'
  }
  return parts.join(':')
}

export function maskAuthStringToSign(stringToSign: string): string {
  const [clientId] = stringToSign.split('|')
  return `${clientId ?? '[REDACTED]'}|[REDACTED]`
}
