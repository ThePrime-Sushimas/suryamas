import { type AxiosInstance, isAxiosError } from 'axios'
import { BcaAuthService } from './bca-auth.service'
import type { BankStatementRequestDto } from './dto/bank-statement-request.dto'
import type { BankStatementResponseDto } from './dto/bank-statement-response.dto'
import {
  formatBcaTimestamp,
  generatePartnerReferenceNo,
  maskStringToSign,
} from './bca.config'
import type { BcaConfig } from './interfaces/bca-config.interface'
import {
  BcaApiError,
  BcaSignatureError,
  BcaTimeoutError,
  BcaTokenExpiredError,
} from './errors/bca.errors'
import { generateServiceSignature } from './bca-signature.util'
import {
  BCA_ENDPOINTS,
  isBcaSignatureErrorResponse,
  isBcaSuccessResponse,
  isBcaTokenExpiredResponse,
} from './types/bca-response-code.type'
import { writeBcaHttpLog } from './utils/bca-http-logger.util'
import { logError, logInfo, logWarn } from '../../config/logger'
import path from 'path'

export class BcaStatementService {
  constructor(
    private readonly config: BcaConfig,
    private readonly http: AxiosInstance,
    private readonly authService: BcaAuthService,
  ) {}

  async getBankStatement(
    accountNo: string,
    fromDateTime: string,
    toDateTime: string,
  ): Promise<BankStatementResponseDto> {
    return this.executeWithTokenRetry(() =>
      this.requestBankStatement(accountNo, fromDateTime, toDateTime),
    )
  }

  private async executeWithTokenRetry<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation()
    } catch (error: unknown) {
      if (error instanceof BcaTokenExpiredError) {
        logWarn('bca.token.expired.retry', {
          responseCode: error.responseCode,
          responseMessage: error.responseMessage,
        })

        this.authService.clearTokenCache()
        return operation()
      }

      throw error
    }
  }

  private async requestBankStatement(
    accountNo: string,
    fromDateTime: string,
    toDateTime: string,
  ): Promise<BankStatementResponseDto> {
    const relativeUrl = BCA_ENDPOINTS.BANK_STATEMENT
    const timestamp = formatBcaTimestamp()
    const accessToken = await this.authService.getAccessToken()

    const body: BankStatementRequestDto = {
      partnerReferenceNo: generatePartnerReferenceNo(),
      accountNo,
      fromDateTime,
      toDateTime,
    }

    const signature = this.authService.generateSignatureService(
      'POST',
      relativeUrl,
      accessToken,
      body,
      timestamp,
    )

    const { stringToSign, bodyHash } = generateServiceSignature(
      this.config.clientSecret,
      'POST',
      relativeUrl,
      accessToken,
      body,
      timestamp,
    )
    const requestUrl = `${this.config.baseUrl}${relativeUrl}`
    const requestHeaders = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-TIMESTAMP': timestamp,
      'X-SIGNATURE': signature,
      'CHANNEL-ID': this.config.channelId,
      'X-PARTNER-ID': this.config.partnerId,
    }

    logInfo('bca.bank-statement.request', {
      timestamp,
      relativeUrl,
      bodyHash,
      stringToSign: maskStringToSign(stringToSign),
    })

    try {
      if (this.config.httpLogEnabled) {
        await writeBcaHttpLog(
          'statement-request.json',
          {
            capturedAt: new Date().toISOString(),
            operation: 'bank-statement',
            request: {
              method: 'POST',
              url: requestUrl,
              headers: requestHeaders,
              body,
            },
            debug: {
              stringToSign: maskStringToSign(stringToSign),
              bodyHash,
              timestamp,
              relativeUrl,
            },
          },
          path.resolve(process.cwd(), this.config.httpLogDir),
        )
      }

      const response = await this.http.post<BankStatementResponseDto>(relativeUrl, body, {
        headers: requestHeaders,
      })

      const data = response.data

      if (this.config.httpLogEnabled) {
        await writeBcaHttpLog(
          'statement-response.json',
          {
            capturedAt: new Date().toISOString(),
            operation: 'bank-statement',
            request: {
              method: 'POST',
              url: requestUrl,
              headers: requestHeaders,
              body,
            },
            response: {
              status: response.status,
              body: data,
            },
            debug: {
              stringToSign: maskStringToSign(stringToSign),
              bodyHash,
              timestamp,
              relativeUrl,
            },
          },
          path.resolve(process.cwd(), this.config.httpLogDir),
        )
      }

      logInfo('bca.bank-statement.response', {
        timestamp,
        relativeUrl,
        bodyHash,
        stringToSign: maskStringToSign(stringToSign),
        responseCode: data.responseCode,
        responseMessage: data.responseMessage,
      })

      return this.validateResponse(data)
    } catch (error: unknown) {
      if (this.config.httpLogEnabled && isAxiosError(error)) {
        const responseData = error.response?.data as BankStatementResponseDto | undefined
        await writeBcaHttpLog(
          'statement-response.json',
          {
            capturedAt: new Date().toISOString(),
            operation: 'bank-statement',
            request: {
              method: 'POST',
              url: requestUrl,
              headers: requestHeaders,
              body,
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
              stringToSign: maskStringToSign(stringToSign),
              bodyHash,
              timestamp,
              relativeUrl,
            },
          },
          path.resolve(process.cwd(), this.config.httpLogDir),
        ).catch(() => undefined)
      }

      throw this.mapHttpError(error, relativeUrl, timestamp, bodyHash, accessToken)
    }
  }

  private validateResponse(data: BankStatementResponseDto): BankStatementResponseDto {
    if (isBcaSuccessResponse(data.responseCode)) {
      return data
    }

    if (isBcaTokenExpiredResponse(data.responseCode)) {
      throw new BcaTokenExpiredError(
        `BCA access token expired: ${data.responseMessage}`,
        data.responseCode,
        data.responseMessage,
      )
    }

    if (isBcaSignatureErrorResponse(data.responseCode)) {
      throw new BcaSignatureError(
        `BCA service signature rejected: ${data.responseMessage}`,
        data.responseCode,
        data.responseMessage,
      )
    }

    throw new BcaApiError(
      `BCA bank statement failed: ${data.responseMessage}`,
      data.responseCode,
      data.responseMessage,
    )
  }

  private mapHttpError(
    error: unknown,
    relativeUrl: string,
    timestamp: string,
    bodyHash: string,
    accessToken: string,
  ): BcaApiError | BcaSignatureError | BcaTimeoutError | BcaTokenExpiredError {
    if (
      error instanceof BcaTokenExpiredError ||
      error instanceof BcaSignatureError ||
      error instanceof BcaApiError
    ) {
      return error
    }

    if (isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        return new BcaTimeoutError(`BCA bank statement request timed out for ${relativeUrl}`)
      }

      const responseData = error.response?.data as BankStatementResponseDto | undefined

      logError('bca.bank-statement.error', {
        timestamp,
        relativeUrl,
        bodyHash,
        stringToSign: maskStringToSign(
          `POST:${relativeUrl}:${accessToken}:${bodyHash}:${timestamp}`,
        ),
        responseCode: responseData?.responseCode,
        responseMessage: responseData?.responseMessage,
        status: error.response?.status,
      })

      if (responseData?.responseCode) {
        if (isBcaTokenExpiredResponse(responseData.responseCode)) {
          return new BcaTokenExpiredError(
            `BCA access token expired: ${responseData.responseMessage}`,
            responseData.responseCode,
            responseData.responseMessage,
          )
        }

        if (isBcaSignatureErrorResponse(responseData.responseCode)) {
          return new BcaSignatureError(
            `BCA service signature rejected: ${responseData.responseMessage}`,
            responseData.responseCode,
            responseData.responseMessage,
          )
        }

        return new BcaApiError(
          `BCA bank statement failed: ${responseData.responseMessage}`,
          responseData.responseCode,
          responseData.responseMessage,
        )
      }

      return new BcaApiError(`BCA bank statement HTTP error: ${error.message}`)
    }

    const message = error instanceof Error ? error.message : 'Unknown bank statement error'
    return new BcaApiError(`BCA bank statement failed: ${message}`)
  }
}
