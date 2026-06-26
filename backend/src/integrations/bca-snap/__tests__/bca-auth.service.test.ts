import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import type { AxiosInstance } from 'axios'
import { generateKeyPairSync } from 'crypto'
import { BcaAuthService } from '../bca-auth.service'
import type { BcaConfig } from '../interfaces/bca-config.interface'
import { BcaOAuthError, BcaSignatureError } from '../errors/bca.errors'
import { buildAuthStringToSign, verifyRsaSha256Base64 } from '../bca-signature.util'

describe('BcaAuthService', () => {
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

  let authService: BcaAuthService
  let http: { post: ReturnType<typeof jest.fn> }

  beforeEach(() => {
    http = { post: jest.fn() }
    authService = new BcaAuthService(config, http as unknown as AxiosInstance)
  })

  describe('generateSignatureAuth()', () => {
    it('creates RSA SHA256 base64 signature for clientId|timestamp', () => {
      const timestamp = '2026-06-26T10:30:00+07:00'
      const signature = authService.generateSignatureAuth(timestamp)
      const stringToSign = buildAuthStringToSign(config.clientId, timestamp)

      expect(verifyRsaSha256Base64(config.publicKey, stringToSign, signature)).toBe(true)
    })
  })

  describe('generateSignatureService()', () => {
    it('creates HMAC SHA512 base64 signature for service request', () => {
      const body = {
        partnerReferenceNo: '2020102900000000000001',
        accountNo: '1234567890',
        fromDateTime: '2021-04-21T00:00:00+07:00',
        toDateTime: '2021-04-21T00:00:00+07:00',
      }

      const signature = authService.generateSignatureService(
        'POST',
        '/openapi/v1.0/bank-statement',
        'ACCESS_TOKEN',
        body,
        '2026-06-26T10:30:00+07:00',
      )

      expect(typeof signature).toBe('string')
      expect(signature.length).toBeGreaterThan(0)
    })
  })

  describe('getAccessToken()', () => {
    it('stores and reuses access token until forced refresh', async () => {
      http.post.mockResolvedValue({
        status: 200,
        data: {
          responseCode: '2007300',
          responseMessage: 'Successful',
          accessToken: 'cached-access-token',
          tokenType: 'bearer',
          expiresIn: '900',
        },
      })

      const first = await authService.getAccessToken()
      const second = await authService.getAccessToken()

      expect(first).toBe('cached-access-token')
      expect(second).toBe('cached-access-token')
      expect(http.post).toHaveBeenCalledTimes(1)
    })

    it('throws BcaOAuthError when OAuth response is unsuccessful', async () => {
      http.post.mockResolvedValue({
        status: 401,
        data: {
          responseCode: '4017300',
          responseMessage: 'Unauthorized. [Signature]',
          accessToken: '',
          tokenType: 'bearer',
          expiresIn: '0',
        },
      })

      await expect(authService.getAccessToken()).rejects.toBeInstanceOf(BcaSignatureError)
    })

    it('throws BcaOAuthError on HTTP failure', async () => {
      const axiosError = Object.assign(new Error('Request failed'), {
        isAxiosError: true,
        code: 'ERR_BAD_RESPONSE',
        response: {
          status: 500,
          data: {
            responseCode: '5007300',
            responseMessage: 'General Error',
          },
        },
      })
      http.post.mockRejectedValue(axiosError)

      await expect(authService.getAccessToken()).rejects.toBeInstanceOf(BcaOAuthError)
    })
  })
})
