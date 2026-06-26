import { describe, it, expect } from '@jest/globals'
import { execSync } from 'child_process'
import { writeFileSync, readFileSync, mkdtempSync, rmSync } from 'fs'
import { generateKeyPairSync, createHash, createHmac } from 'crypto'
import {
  minifyJson,
  sha256Hex,
  hmacSha512Base64,
  rsaSha256Base64,
  buildServiceStringToSign,
  buildAuthStringToSign,
  generateServiceSignature,
  verifyRsaSha256Base64,
} from '../bca-signature.util'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  GOLDEN_BANK_STATEMENT_BODY,
  GOLDEN_BANK_STATEMENT_MINIFIED,
  GOLDEN_BANK_STATEMENT_BODY_HASH,
  GOLDEN_EMPTY_BODY_HASH,
  GOLDEN_LEGACY_API_SECRET,
  GOLDEN_LEGACY_HMAC_SHA256_HEX,
  GOLDEN_LEGACY_TRANSFER_STRING_TO_SIGN,
  GOLDEN_SNAP_HMAC_SHA512_BASE64,
  GOLDEN_SNAP_SERVICE_STRING_TO_SIGN,
  GOLDEN_OAUTH_STRING_TO_SIGN,
  BCA_ENDPOINTS_GOLDEN,
} from '../fixtures/bca-signature.golden'

function opensslHmacSha512Base64(secret: string, data: string): string {
  const digest = execSync(`openssl dgst -sha512 -hmac ${JSON.stringify(secret)} -binary`, {
    input: data,
  })
  return Buffer.from(digest).toString('base64')
}

function opensslRsaSha256Base64(privateKeyPem: string, data: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'bca-golden-'))
  try {
    const keyFile = join(dir, 'private.pem')
    const dataFile = join(dir, 'data.txt')
    const sigFile = join(dir, 'sig.bin')
    writeFileSync(keyFile, privateKeyPem)
    writeFileSync(dataFile, data)
    execSync(`openssl dgst -sha256 -sign "${keyFile}" -out "${sigFile}" "${dataFile}"`)
    return readFileSync(sigFile).toString('base64')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('BCA SNAP golden signature vectors', () => {
  describe('minifyJson()', () => {
    it('matches SNAP bank-statement documentation example', () => {
      expect(minifyJson(GOLDEN_BANK_STATEMENT_BODY)).toBe(GOLDEN_BANK_STATEMENT_MINIFIED)
    })

    it('does not uppercase or escape beyond JSON.stringify defaults', () => {
      const minified = minifyJson(GOLDEN_BANK_STATEMENT_BODY)
      expect(minified).not.toMatch(/\s/)
      expect(minified).not.toContain('HTTPS')
    })
  })

  describe('sha256Hex()', () => {
    it('returns lowercase hex for empty body (GET / no body)', () => {
      expect(sha256Hex('')).toBe(GOLDEN_EMPTY_BODY_HASH)
      expect(sha256Hex('')).toBe(sha256Hex('').toLowerCase())
    })

    it('matches golden hash for SNAP bank-statement minified body', () => {
      const hash = sha256Hex(minifyJson(GOLDEN_BANK_STATEMENT_BODY))
      expect(hash).toBe(GOLDEN_BANK_STATEMENT_BODY_HASH)
      expect(hash).toBe(hash.toLowerCase())
    })

    it('uses relative path in hash input only via body, not URL', () => {
      const hash = sha256Hex(minifyJson(GOLDEN_BANK_STATEMENT_BODY))
      expect(hash).not.toContain('sandbox.bca.co.id')
      expect(hash).not.toContain('https://')
    })
  })

  describe('buildServiceStringToSign()', () => {
    it('uses POST, relative URL, token, lowercase hex hash, timestamp', () => {
      const stringToSign = buildServiceStringToSign(
        'POST',
        BCA_ENDPOINTS_GOLDEN.BANK_STATEMENT,
        'ACCESS_TOKEN',
        GOLDEN_BANK_STATEMENT_BODY,
        '2026-06-26T10:30:00+07:00',
      )

      expect(stringToSign).toBe(GOLDEN_SNAP_SERVICE_STRING_TO_SIGN)
      expect(stringToSign.startsWith('POST:/openapi/v1.0/bank-statement:')).toBe(true)
      expect(stringToSign).not.toContain('https://')
    })
  })

  describe('HMAC SHA512 → Base64 (SNAP symmetric)', () => {
    it('matches golden vector from documentation-derived example', () => {
      const signature = hmacSha512Base64(
        GOLDEN_LEGACY_API_SECRET,
        GOLDEN_SNAP_SERVICE_STRING_TO_SIGN,
      )
      expect(signature).toBe(GOLDEN_SNAP_HMAC_SHA512_BASE64)
    })

    it('matches OpenSSL HMAC-SHA512 base64 output', () => {
      const nodeSig = hmacSha512Base64(
        GOLDEN_LEGACY_API_SECRET,
        GOLDEN_SNAP_SERVICE_STRING_TO_SIGN,
      )
      const opensslSig = opensslHmacSha512Base64(
        GOLDEN_LEGACY_API_SECRET,
        GOLDEN_SNAP_SERVICE_STRING_TO_SIGN,
      )
      expect(nodeSig).toBe(opensslSig)
    })

    it('produces Base64, not hex (unlike legacy HMAC-SHA256 API)', () => {
      const signature = hmacSha512Base64(
        GOLDEN_LEGACY_API_SECRET,
        GOLDEN_SNAP_SERVICE_STRING_TO_SIGN,
      )
      const legacyHex = createHmac('sha256', GOLDEN_LEGACY_API_SECRET)
        .update(GOLDEN_LEGACY_TRANSFER_STRING_TO_SIGN)
        .digest('hex')

      expect(signature).toBe(GOLDEN_SNAP_HMAC_SHA512_BASE64)
      expect(legacyHex).toBe(GOLDEN_LEGACY_HMAC_SHA256_HEX)
      expect(signature).not.toBe(legacyHex)
      expect(signature).toMatch(/^[A-Za-z0-9+/]+=*$/)
    })

    it('generateServiceSignature() is consistent with helpers', () => {
      const result = generateServiceSignature(
        GOLDEN_LEGACY_API_SECRET,
        'POST',
        BCA_ENDPOINTS_GOLDEN.BANK_STATEMENT,
        'ACCESS_TOKEN',
        GOLDEN_BANK_STATEMENT_BODY,
        '2026-06-26T10:30:00+07:00',
      )

      expect(result.bodyHash).toBe(GOLDEN_BANK_STATEMENT_BODY_HASH)
      expect(result.stringToSign).toBe(GOLDEN_SNAP_SERVICE_STRING_TO_SIGN)
      expect(result.signature).toBe(GOLDEN_SNAP_HMAC_SHA512_BASE64)
    })
  })

  describe('RSA SHA256 → Base64 (SNAP OAuth)', () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    })
    const privatePem = privateKey.export({ type: 'pkcs1', format: 'pem' }) as string
    const publicPem = publicKey.export({ type: 'spki', format: 'pem' }) as string

    it('matches OpenSSL dgst -sha256 -sign base64 output', () => {
      const stringToSign = GOLDEN_OAUTH_STRING_TO_SIGN
      const nodeSig = rsaSha256Base64(privatePem, stringToSign)
      const opensslSig = opensslRsaSha256Base64(privatePem, stringToSign)

      expect(nodeSig).toBe(opensslSig)
      expect(verifyRsaSha256Base64(publicPem, stringToSign, nodeSig)).toBe(true)
    })

    it('builds clientId|timestamp auth stringToSign', () => {
      expect(buildAuthStringToSign('sandbox-client', '2022-04-21T17:34:52+07:00')).toBe(
        GOLDEN_OAUTH_STRING_TO_SIGN,
      )
    })
  })

  describe('algorithm guardrails', () => {
    it('body hash is never uppercase hex', () => {
      const hash = sha256Hex(minifyJson(GOLDEN_BANK_STATEMENT_BODY))
      expect(hash).toBe(hash.toLowerCase())
      expect(hash).not.toMatch(/[A-F]/)
    })

    it('SHA256 of body matches Node crypto hex, not base64', () => {
      const minified = minifyJson(GOLDEN_BANK_STATEMENT_BODY)
      const hex = createHash('sha256').update(minified, 'utf8').digest('hex')
      const base64 = createHash('sha256').update(minified, 'utf8').digest('base64')
      expect(sha256Hex(minified)).toBe(hex)
      expect(sha256Hex(minified)).not.toBe(base64)
    })
  })
})
