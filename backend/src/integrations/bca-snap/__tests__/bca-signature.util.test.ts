import { describe, it, expect } from '@jest/globals'
import { generateKeyPairSync } from 'crypto'
import {
  minifyJson,
  sha256Hex,
  hmacSha512Base64,
  rsaSha256Base64,
  buildAuthStringToSign,
  buildServiceStringToSign,
  generateAuthSignature,
  generateServiceSignature,
  verifyRsaSha256Base64,
} from '../bca-signature.util'

describe('bca-signature.util', () => {
  describe('minifyJson()', () => {
    it('removes whitespace from JSON objects', () => {
      const input = {
        partnerReferenceNo: '2020102900000000000001',
        accountNo: '1234567890',
        fromDateTime: '2021-04-21T00:00:00+07:00',
        toDateTime: '2021-04-21T00:00:00+07:00',
      }

      expect(minifyJson(input)).toBe(
        '{"partnerReferenceNo":"2020102900000000000001","accountNo":"1234567890","fromDateTime":"2021-04-21T00:00:00+07:00","toDateTime":"2021-04-21T00:00:00+07:00"}',
      )
    })

    it('returns empty string for null and undefined', () => {
      expect(minifyJson(null)).toBe('')
      expect(minifyJson(undefined)).toBe('')
    })

    it('minifies nested arrays', () => {
      expect(minifyJson({ a: 1, b: [2, 3] })).toBe('{"a":1,"b":[2,3]}')
    })
  })

  describe('sha256Hex()', () => {
    it('returns lowercase hex digest for empty string', () => {
      expect(sha256Hex('')).toBe(
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      )
    })

    it('hashes minified bank statement body', () => {
      const body = {
        partnerReferenceNo: '2020102900000000000001',
        accountNo: '1234567890',
        fromDateTime: '2021-04-21T00:00:00+07:00',
        toDateTime: '2021-04-21T00:00:00+07:00',
      }

      const digest = sha256Hex(minifyJson(body))
      expect(digest).toMatch(/^[0-9a-f]{64}$/)
      expect(digest).toBe(sha256Hex(minifyJson(body)))
    })
  })

  describe('hmacSha512Base64()', () => {
    it('produces stable base64 HMAC for known input', () => {
      const secret = 'test-client-secret'
      const data =
        'POST:/openapi/v1.0/bank-statement:ACCESS_TOKEN:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890:2026-06-26T10:30:00+07:00'

      const signature = hmacSha512Base64(secret, data)

      expect(signature).toBe(hmacSha512Base64(secret, data))
      expect(Buffer.from(signature, 'base64').length).toBe(64)
    })
  })

  describe('rsaSha256Base64()', () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    })

    it('generates verifiable RSA-SHA256 signature in base64', () => {
      const clientId = 'BCA_CLIENT_ID'
      const timestamp = '2026-06-26T10:30:00+07:00'
      const stringToSign = buildAuthStringToSign(clientId, timestamp)
      const signature = rsaSha256Base64(privateKey.export({ type: 'pkcs1', format: 'pem' }) as string, stringToSign)

      expect(verifyRsaSha256Base64(publicKey.export({ type: 'spki', format: 'pem' }) as string, stringToSign, signature)).toBe(true)
    })
  })

  describe('generateAuthSignature()', () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    })

    it('builds clientId|timestamp string and signs with RSA SHA256', () => {
      const clientId = 'sandbox-client'
      const timestamp = '2022-04-21T17:34:52+07:00'
      const privatePem = privateKey.export({ type: 'pkcs1', format: 'pem' }) as string
      const publicPem = publicKey.export({ type: 'spki', format: 'pem' }) as string

      const signature = generateAuthSignature(privatePem, clientId, timestamp)
      const stringToSign = buildAuthStringToSign(clientId, timestamp)

      expect(stringToSign).toBe('sandbox-client|2022-04-21T17:34:52+07:00')
      expect(verifyRsaSha256Base64(publicPem, stringToSign, signature)).toBe(true)
    })
  })

  describe('generateServiceSignature()', () => {
    it('builds SNAP service stringToSign and HMAC SHA512 signature', () => {
      const body = {
        partnerReferenceNo: '2020102900000000000001',
        accountNo: '1234567890',
        fromDateTime: '2021-04-21T00:00:00+07:00',
        toDateTime: '2021-04-21T00:00:00+07:00',
      }

      const { signature, stringToSign, bodyHash } = generateServiceSignature(
        'client-secret',
        'POST',
        '/openapi/v1.0/bank-statement',
        'ACCESS_TOKEN',
        body,
        '2026-06-26T10:30:00+07:00',
      )

      const expectedStringToSign = buildServiceStringToSign(
        'POST',
        '/openapi/v1.0/bank-statement',
        'ACCESS_TOKEN',
        body,
        '2026-06-26T10:30:00+07:00',
      )

      expect(bodyHash).toBe(sha256Hex(minifyJson(body)))
      expect(stringToSign).toBe(expectedStringToSign)
      expect(stringToSign).toBe(
        `POST:/openapi/v1.0/bank-statement:ACCESS_TOKEN:${bodyHash}:2026-06-26T10:30:00+07:00`,
      )
      expect(signature).toBe(hmacSha512Base64('client-secret', stringToSign))
    })
  })
})
