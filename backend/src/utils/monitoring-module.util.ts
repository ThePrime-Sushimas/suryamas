import type { Request } from 'express'

const API_MODULE_RE = /\/api\/v\d+\/([^/]+)/

/** Module label for error_logs + Telegram (e.g. purchase-requests, goods-processing). */
export function resolveMonitoringModule(req?: Request): string {
  const original = (req?.originalUrl ?? req?.url ?? '').split('?')[0]
  const fromUrl = original.match(API_MODULE_RE)?.[1]
  if (fromUrl) return fromUrl
  return (req?.path ?? '').split('/').filter(Boolean)[0] || 'api'
}

/** Optional action segment when not a UUID (e.g. approve-and-generate). */
export function resolveMonitoringSubmodule(req?: Request): string | undefined {
  const routePath = req?.route?.path
  if (typeof routePath === 'string' && routePath !== '/') {
    const cleaned = routePath.replace(/^\//, '').replace(/^:/, '')
    if (cleaned && !cleaned.startsWith(':')) {
      return cleaned.split('/').filter((s) => !s.startsWith(':')).join('/') || undefined
    }
  }
  const original = (req?.originalUrl ?? req?.url ?? '').split('?')[0]
  const tail = original.replace(API_MODULE_RE, '').split('/').filter(Boolean)
  const candidate = tail.find((s) => !/^[0-9a-f-]{36}$/i.test(s) && !/^\d+$/.test(s))
  return candidate
}
