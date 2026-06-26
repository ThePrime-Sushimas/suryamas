const SENSITIVE_HEADER_KEYS = new Set([
  'authorization',
  'x-signature',
  'x-client-key',
])

const SENSITIVE_BODY_KEYS = new Set([
  'accessToken',
  'client_secret',
  'clientSecret',
])

export function redactToken(value: string, visiblePrefix = 4, visibleSuffix = 4): string {
  if (!value || value.length <= visiblePrefix + visibleSuffix + 3) {
    return '[REDACTED]'
  }
  return `${value.slice(0, visiblePrefix)}...${value.slice(-visibleSuffix)}`
}

export function redactHeaders(
  headers: Record<string, string | undefined>,
): Record<string, string> {
  const result: Record<string, string> = {}

  for (const [key, value] of Object.entries(headers)) {
    if (!value) continue

    const lower = key.toLowerCase()
    if (lower === 'authorization' && value.toLowerCase().startsWith('bearer ')) {
      const token = value.slice(7)
      result[key] = `Bearer ${redactToken(token)}`
      continue
    }

    if (SENSITIVE_HEADER_KEYS.has(lower)) {
      result[key] = '[REDACTED]'
      continue
    }

    result[key] = value
  }

  return result
}

export function redactBody<T>(body: T): T {
  if (!body || typeof body !== 'object') {
    return body
  }

  if (Array.isArray(body)) {
    return body.map((item) => redactBody(item)) as T
  }

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (SENSITIVE_BODY_KEYS.has(key)) {
      result[key] = typeof value === 'string' ? redactToken(value) : '[REDACTED]'
      continue
    }
    result[key] = value
  }

  return result as T
}
