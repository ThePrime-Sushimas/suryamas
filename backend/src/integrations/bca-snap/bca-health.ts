import { createBcaClient } from './bca.factory'
import { BcaError } from './errors/bca.errors'

export interface BcaHealthResult {
  status: 'UP' | 'DOWN'
  checkedAt: string
  oauth?: {
    responseCode?: string
    responseMessage?: string
    tokenPreview?: string
  }
  error?: {
    code: string
    message: string
    responseCode?: string
    responseMessage?: string
  }
}

function previewToken(token: string): string {
  if (token.length <= 10) return '[REDACTED]'
  return `${token.slice(0, 6)}...${token.slice(-4)}`
}

export async function checkBcaHealth(): Promise<BcaHealthResult> {
  const checkedAt = new Date().toISOString()

  try {
    const { auth } = createBcaClient({
      httpLogEnabled: process.env.BCA_HTTP_LOG === 'true',
    })
    const accessToken = await auth.getAccessToken(true)

    return {
      status: 'UP',
      checkedAt,
      oauth: {
        responseMessage: 'OAuth token acquired',
        tokenPreview: previewToken(accessToken),
      },
    }
  } catch (error: unknown) {
    if (error instanceof BcaError) {
      return {
        status: 'DOWN',
        checkedAt,
        error: {
          code: error.code,
          message: error.message,
          responseCode: error.responseCode,
          responseMessage: error.responseMessage,
        },
      }
    }

    return {
      status: 'DOWN',
      checkedAt,
      error: {
        code: 'BCA_HEALTH_CHECK_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }
  }
}
