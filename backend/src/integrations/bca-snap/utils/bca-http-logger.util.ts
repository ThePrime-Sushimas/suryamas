import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { redactBody, redactHeaders } from './bca-redact.util'

export interface BcaHttpLogDebug {
  stringToSign?: string
  bodyHash?: string
  timestamp?: string
  relativeUrl?: string
}

export interface BcaHttpLogEntry {
  capturedAt: string
  operation: 'oauth' | 'bank-statement'
  request: {
    method: string
    url: string
    headers: Record<string, string>
    body: unknown
  }
  response?: {
    status: number
    headers?: Record<string, string>
    body: unknown
  }
  error?: {
    message: string
    responseCode?: string
    responseMessage?: string
  }
  debug?: BcaHttpLogDebug
}

export function getDefaultBcaLogDir(): string {
  return path.join(process.cwd(), 'logs', 'bca')
}

export async function ensureBcaLogDir(logDir = getDefaultBcaLogDir()): Promise<string> {
  await mkdir(logDir, { recursive: true })
  return logDir
}

export function buildRedactedHttpLogEntry(entry: BcaHttpLogEntry): BcaHttpLogEntry {
  return {
    ...entry,
    request: {
      ...entry.request,
      headers: redactHeaders(entry.request.headers),
      body: redactBody(entry.request.body),
    },
    response: entry.response
      ? {
          ...entry.response,
          body: redactBody(entry.response.body),
        }
      : undefined,
  }
}

export async function writeBcaHttpLog(
  filename: string,
  entry: BcaHttpLogEntry,
  logDir = getDefaultBcaLogDir(),
): Promise<string> {
  const dir = await ensureBcaLogDir(logDir)
  const filePath = path.join(dir, filename)
  const payload = buildRedactedHttpLogEntry(entry)
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  return filePath
}
