import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import type { AxiosInstance } from 'axios'
import { generateKeyPairSync } from 'crypto'
import { BcaStatementService } from '../bca-statement.service'
import { BcaAuthService } from '../bca-auth.service'
import type { BcaConfig } from '../interfaces/bca-config.interface'
import { BcaTokenExpiredError } from '../errors/bca.errors'

describe('BcaStatementService', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  })

  const config: BcaConfig = {
    baseUrl: 'https://sandbox.bca.co.id',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    privateKey: privateKey.export({ type: 'pkcs1', format: 'pem' }) as string,
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }) as string,
    partnerId: 'KBBABCINDO',
    channelId: '95051',
    timeoutMs: 30_000,
    httpLogEnabled: false,
    httpLogDir: 'logs/bca',
  }

  let statementService: BcaStatementService
  let authService: {
    getAccessToken: ReturnType<typeof jest.fn>
    generateSignatureService: ReturnType<typeof jest.fn>
    clearTokenCache: ReturnType<typeof jest.fn>
  }
  let http: { post: ReturnType<typeof jest.fn> }

  beforeEach(() => {
    authService = {
      getAccessToken: jest.fn(),
      generateSignatureService: jest.fn().mockReturnValue('mock-signature'),
      clearTokenCache: jest.fn(),
    }

    http = { post: jest.fn() }
    statementService = new BcaStatementService(
      config,
      http as unknown as AxiosInstance,
      authService as unknown as BcaAuthService,
    )
  })

  it('retries once when access token is expired', async () => {
    authService.getAccessToken
      .mockResolvedValueOnce('expired-token')
      .mockResolvedValueOnce('fresh-token')

    http.post
      .mockResolvedValueOnce({
        status: 401,
        data: {
          responseCode: '4011401',
          responseMessage: 'Invalid token (B2B)',
        },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: {
          responseCode: '2001400',
          responseMessage: 'Successful',
          referenceNo: '2020102977770000000009',
          partnerReferenceNo: '2020102900000000000001',
          detailData: [],
        },
      })

    const result = await statementService.getBankStatement(
      '1234567890',
      '2021-04-21T00:00:00+07:00',
      '2021-04-21T00:00:00+07:00',
    )

    expect(authService.clearTokenCache).toHaveBeenCalledTimes(1)
    expect(authService.getAccessToken).toHaveBeenCalledTimes(2)
    expect(http.post).toHaveBeenCalledTimes(2)
    expect(result.responseCode).toBe('2001400')
  })

  it('does not retry more than once for repeated token expiry', async () => {
    authService.getAccessToken.mockResolvedValue('expired-token')

    http.post.mockResolvedValue({
      status: 401,
      data: {
        responseCode: '4011401',
        responseMessage: 'Invalid token (B2B)',
      },
    })

    await expect(
      statementService.getBankStatement(
        '1234567890',
        '2021-04-21T00:00:00+07:00',
        '2021-04-21T00:00:00+07:00',
      ),
    ).rejects.toBeInstanceOf(BcaTokenExpiredError)

    expect(authService.clearTokenCache).toHaveBeenCalledTimes(1)
    expect(http.post).toHaveBeenCalledTimes(2)
  })
})
