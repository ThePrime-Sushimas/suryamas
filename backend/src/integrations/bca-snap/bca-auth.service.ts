import { type AxiosError, type AxiosInstance, isAxiosError } from 'axios'
import type { AccessTokenResponseDto } from './dto/access-token-response.dto'
import type { BcaConfig } from './interfaces/bca-config.interface'
import type { BcaTokenCache } from './interfaces/bca-token-cache.interface'
import {
  BcaApiError,
  BcaOAuthError,
  BcaSignatureError,
  BcaTimeoutError,
} from './errors/bca.errors'
import {
  formatBcaTimestamp,
  maskAuthStringToSign,
  maskStringToSign,
} from './bca.config'
import {
  buildAuthStringToSign,
  generateAuthSignature,
  generateServiceSignature,
} from './bca-signature.util'
import {
  BCA_ENDPOINTS,
  isBcaSignatureErrorResponse,
  isBcaSuccessResponse,
} from './types/bca-response-code.type'
import { writeBcaHttpLog } from './utils/bca-http-logger.util'
import { logError, logInfo } from '../../config/logger'
import path from 'path'

const TOKEN_EXPIRY_BUFFER_MS = 30_000

export class BcaAuthService {
  private tokenCache: BcaTokenCache | null = null

  constructor(
    private readonly config: BcaConfig,
    private readonly http: AxiosInstance,
  ) {}

  generateSignatureAuth(timestamp: string): string {
    const stringToSign = buildAuthStringToSign(this.config.clientId, timestamp)
    return generateAuthSignature(this.config.privateKey, this.config.clientId, timestamp)
  }

  generateSignatureService(
    method: string,
    relativeUrl: string,
    accessToken: string,
    body: unknown,
    timestamp: string,
  ): string {
    const { signature, stringToSign, bodyHash } = generateServiceSignature(
      this.config.clientSecret,
      method,
      relativeUrl,
      accessToken,
      body,
      timestamp,
    )

    logInfo('bca.service.signature.generated', {
      timestamp,
      relativeUrl,
      bodyHash,
      stringToSign: maskStringToSign(stringToSign),
    })

    return signature
  }

  async getAccessToken(forceRefresh = false): Promise<string> {
    if (!forceRefresh && this.isTokenValid()) {
      return this.tokenCache!.accessToken
    }

    const timestamp = formatBcaTimestamp()
    const signature = this.generateSignatureAuth(timestamp)
    const relativeUrl = BCA_ENDPOINTS.ACCESS_TOKEN
    const stringToSign = buildAuthStringToSign(this.config.clientId, timestamp)
    const requestBody = { grantType: 'client_credentials' as const }
    const requestUrl = `${this.config.baseUrl}${relativeUrl}`

    logInfo('bca.oauth.request', { timestamp, relativeUrl })

    try {
      if (this.config.httpLogEnabled) {
        await writeBcaHttpLog(
          'oauth-request.json',
          {
            capturedAt: new Date().toISOString(),
            operation: 'oauth',
            request: {
              method: 'POST',
              url: requestUrl,
              headers: {
                'X-TIMESTAMP': timestamp,
                'X-CLIENT-KEY': this.config.clientId,
                'X-SIGNATURE': signature,
                'Content-Type': 'application/json',
              },
              body: requestBody,
            },
            debug: {
              stringToSign: maskAuthStringToSign(stringToSign),
              timestamp,
              relativeUrl,
            },
          },
          path.resolve(process.cwd(), this.config.httpLogDir),
        )
      }

      const response = await this.http.post<AccessTokenResponseDto>(
        relativeUrl,
        requestBody,
        {
          headers: {
            'X-TIMESTAMP': timestamp,
            'X-CLIENT-KEY': this.config.clientId,
            'X-SIGNATURE': signature,
            'Content-Type': 'application/json',
          },
        },
      )

      const data = response.data

      if (this.config.httpLogEnabled) {
        await writeBcaHttpLog(
          'oauth-response.json',
          {
            capturedAt: new Date().toISOString(),
            operation: 'oauth',
            request: {
              method: 'POST',
              url: requestUrl,
              headers: {
                'X-TIMESTAMP': timestamp,
                'X-CLIENT-KEY': this.config.clientId,
                'X-SIGNATURE': signature,
                'Content-Type': 'application/json',
              },
              body: requestBody,
            },
            response: {
              status: response.status,
              body: data,
            },
            debug: {
              stringToSign: maskAuthStringToSign(stringToSign),
              timestamp,
              relativeUrl,
            },
          },
          path.resolve(process.cwd(), this.config.httpLogDir),
        )
      }

      logInfo('bca.oauth.response', {
        timestamp,
        relativeUrl,
        responseCode: data.responseCode,
        responseMessage: data.responseMessage,
      })

      if (!isBcaSuccessResponse(data.responseCode)) {
        if (isBcaSignatureErrorResponse(data.responseCode)) {
          throw new BcaSignatureError(
            `BCA OAuth signature rejected: ${data.responseMessage}`,
            data.responseCode,
            data.responseMessage,
          )
        }

        throw new BcaOAuthError(
          `BCA OAuth failed: ${data.responseMessage}`,
          data.responseCode,
          data.responseMessage,
        )
      }

      const expiresInSeconds = Number(data.expiresIn)
      const ttlMs = Number.isFinite(expiresInSeconds) ? expiresInSeconds * 1000 : 900_000

      this.tokenCache = {
        accessToken: data.accessToken,
        expiresAt: Date.now() + ttlMs - TOKEN_EXPIRY_BUFFER_MS,
      }

      return data.accessToken
    } catch (error: unknown) {
      if (this.config.httpLogEnabled && isAxiosError(error)) {
        const responseData = error.response?.data as AccessTokenResponseDto | undefined
        await writeBcaHttpLog(
          'oauth-response.json',
          {
            capturedAt: new Date().toISOString(),
            operation: 'oauth',
            request: {
              method: 'POST',
              url: requestUrl,
              headers: {
                'X-TIMESTAMP': timestamp,
                'X-CLIENT-KEY': this.config.clientId,
                'X-SIGNATURE': signature,
                'Content-Type': 'application/json',
              },
              body: requestBody,
            },
            response: error.response
              ? {
                  status: error.response.status,
                  body: responseData ?? error.response.data,
                }
              : undefined,
            error: {
              message: error.message,
              responseCode: responseData?.responseCode,
              responseMessage: responseData?.responseMessage,
            },
            debug: {
              stringToSign: maskAuthStringToSign(stringToSign),
              timestamp,
              relativeUrl,
            },
          },
          path.resolve(process.cwd(), this.config.httpLogDir),
        ).catch(() => undefined)
      }

      throw this.mapHttpError(error, relativeUrl, timestamp)
    }
  }

  clearTokenCache(): void {
    this.tokenCache = null
  }

  private isTokenValid(): boolean {
    if (!this.tokenCache) {
      return false
    }
    return Date.now() < this.tokenCache.expiresAt
  }

  private mapHttpError(
    error: unknown,
    relativeUrl: string,
    timestamp: string,
  ): BcaApiError | BcaOAuthError | BcaSignatureError | BcaTimeoutError {
    if (error instanceof BcaOAuthError || error instanceof BcaSignatureError) {
      return error
    }

    if (isAxiosError(error)) {
      const axiosError = error as AxiosError<AccessTokenResponseDto>

      if (axiosError.code === 'ECONNABORTED') {
        return new BcaTimeoutError(`BCA OAuth request timed out for ${relativeUrl}`)
      }

      const responseData = axiosError.response?.data

      logError('bca.oauth.error', {
        timestamp,
        relativeUrl,
        responseCode: responseData?.responseCode,
        responseMessage: responseData?.responseMessage,
        status: axiosError.response?.status,
      })

      if (responseData?.responseCode && isBcaSignatureErrorResponse(responseData.responseCode)) {
        return new BcaSignatureError(
          `BCA OAuth signature rejected: ${responseData.responseMessage}`,
          responseData.responseCode,
          responseData.responseMessage,
        )
      }

      if (responseData?.responseCode) {
        return new BcaOAuthError(
          `BCA OAuth failed: ${responseData.responseMessage}`,
          responseData.responseCode,
          responseData.responseMessage,
        )
      }

      return new BcaOAuthError(`BCA OAuth HTTP error: ${axiosError.message}`)
    }

    const message = error instanceof Error ? error.message : 'Unknown OAuth error'
    return new BcaOAuthError(`BCA OAuth failed: ${message}`)
  }
}
