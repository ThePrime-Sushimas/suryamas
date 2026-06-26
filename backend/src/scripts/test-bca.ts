#!/usr/bin/env tsx
/**
 * BCA SNAP end-to-end validation CLI.
 *
 * Usage:
 *   npm run bca:test
 *   npm run bca:test -- --oauth-only
 *   npm run bca:test -- --golden-only
 */
import 'dotenv/config'
import { generateKeyPairSync } from 'crypto'
import { createBcaClient } from '../integrations/bca-snap/bca.factory'
import { loadBcaConfigFromEnv } from '../integrations/bca-snap/bca.config'
import {
  buildAuthStringToSign,
  buildServiceStringToSign,
  generateServiceSignature,
  hmacSha512Base64,
  minifyJson,
  rsaSha256Base64,
  sha256Hex,
  verifyRsaSha256Base64,
} from '../integrations/bca-snap/bca-signature.util'
import {
  GOLDEN_BANK_STATEMENT_BODY,
  GOLDEN_BANK_STATEMENT_BODY_HASH,
  GOLDEN_BANK_STATEMENT_MINIFIED,
  GOLDEN_SNAP_HMAC_SHA512_BASE64,
  GOLDEN_SNAP_SERVICE_STRING_TO_SIGN,
  BCA_ENDPOINTS_GOLDEN,
} from '../integrations/bca-snap/fixtures/bca-signature.golden'
import { BcaError } from '../integrations/bca-snap/errors/bca.errors'
import { getDefaultBcaLogDir } from '../integrations/bca-snap/utils/bca-http-logger.util'
import { redactToken } from '../integrations/bca-snap/utils/bca-redact.util'

const args = new Set(process.argv.slice(2))
const oauthOnly = args.has('--oauth-only')
const goldenOnly = args.has('--golden-only')

function ok(message: string): void {
  console.log(`✓ ${message}`)
}

function fail(message: string): never {
  console.error(`✗ ${message}`)
  process.exit(1)
}

function section(title: string): void {
  console.log(`\n${title}`)
  console.log('─'.repeat(title.length))
}

function runGoldenChecks(): void {
  section('1/5 Golden signature checks (offline)')

  const minified = minifyJson(GOLDEN_BANK_STATEMENT_BODY)
  if (minified !== GOLDEN_BANK_STATEMENT_MINIFIED) {
    fail(`minifyJson mismatch\n  got:  ${minified}\n  want: ${GOLDEN_BANK_STATEMENT_MINIFIED}`)
  }
  ok('minifyJson() matches BCA bank-statement example')

  const bodyHash = sha256Hex(minified)
  if (bodyHash !== GOLDEN_BANK_STATEMENT_BODY_HASH) {
    fail(`SHA256 body hash mismatch\n  got:  ${bodyHash}\n  want: ${GOLDEN_BANK_STATEMENT_BODY_HASH}`)
  }
  ok(`SHA256 body hash OK (${bodyHash})`)

  const stringToSign = buildServiceStringToSign(
    'POST',
    BCA_ENDPOINTS_GOLDEN.BANK_STATEMENT,
    'ACCESS_TOKEN',
    GOLDEN_BANK_STATEMENT_BODY,
    '2026-06-26T10:30:00+07:00',
  )
  if (stringToSign !== GOLDEN_SNAP_SERVICE_STRING_TO_SIGN) {
    fail(`StringToSign mismatch\n  got:  ${stringToSign}\n  want: ${GOLDEN_SNAP_SERVICE_STRING_TO_SIGN}`)
  }
  ok('StringToSign format OK (relative URL, lowercase hex hash)')

  const hmac = hmacSha512Base64(
    '22a2d25e-765d-41e1-8d29-da68dcb5698b',
    GOLDEN_SNAP_SERVICE_STRING_TO_SIGN,
  )
  if (hmac !== GOLDEN_SNAP_HMAC_SHA512_BASE64) {
    fail(`HMAC SHA512 Base64 mismatch\n  got:  ${hmac}\n  want: ${GOLDEN_SNAP_HMAC_SHA512_BASE64}`)
  }
  ok('HMAC SHA512 Base64 matches OpenSSL-verified golden vector')

  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const privatePem = privateKey.export({ type: 'pkcs1', format: 'pem' }) as string
  const publicPem = publicKey.export({ type: 'spki', format: 'pem' }) as string
  const authString = buildAuthStringToSign('test-client', '2026-06-26T10:30:00+07:00')
  const authSig = rsaSha256Base64(privatePem, authString)
  if (!verifyRsaSha256Base64(publicPem, authString, authSig)) {
    fail('RSA SHA256 auth signature verification failed')
  }
  ok('RSA SHA256 auth signature OK (self-verify)')

  const serviceSig = generateServiceSignature(
    '22a2d25e-765d-41e1-8d29-da68dcb5698b',
    'POST',
    BCA_ENDPOINTS_GOLDEN.BANK_STATEMENT,
    'ACCESS_TOKEN',
    GOLDEN_BANK_STATEMENT_BODY,
    '2026-06-26T10:30:00+07:00',
  )
  ok(`Signature Service OK (bodyHash=${serviceSig.bodyHash})`)
}

async function runLiveChecks(): Promise<void> {
  section('2/5 Environment')
  const config = loadBcaConfigFromEnv({
    httpLogEnabled: true,
    httpLogDir: getDefaultBcaLogDir(),
  })
  ok(`BCA_BASE_URL = ${config.baseUrl}`)
  ok(`BCA_CLIENT_ID = ${config.clientId}`)
  ok(`BCA_PARTNER_ID = ${config.partnerId}`)
  ok(`HTTP logs → ${config.httpLogDir}/`)

  // Validate RSA key can sign before hitting sandbox
  try {
    const { rsaSha256Base64, buildAuthStringToSign } = await import('../integrations/bca-snap/bca-signature.util')
    rsaSha256Base64(config.privateKey, buildAuthStringToSign(config.clientId, '2026-01-01T00:00:00+07:00'))
    ok('RSA private key loads OK')
  } catch (keyError: unknown) {
    const msg = keyError instanceof Error ? keyError.message : String(keyError)
    fail(
      `RSA private key invalid — check BCA_PRIVATE_KEY in .env\n` +
      `  Use full PEM with -----BEGIN PRIVATE KEY----- or raw base64 from BCA portal\n` +
      `  Error: ${msg}`,
    )
  }

  const { auth, statement } = createBcaClient({ httpLogEnabled: true })

  try {
    section('3/5 OAuth (POST /openapi/v1.0/access-token/b2b)')
    const accessToken = await auth.getAccessToken(true)
    ok('OAuth OK')
    console.log(`✓ Access Token: ${redactToken(accessToken, 8, 6)}`)

    if (oauthOnly) {
      section('Done (--oauth-only)')
      return
    }

    section('4/5 Signature Service (pre-flight)')
    const probeBody = {
      partnerReferenceNo: '2020102900000000000001',
      accountNo: process.env.BCA_TEST_ACCOUNT_NO ?? '1234567890',
      fromDateTime: process.env.BCA_TEST_FROM_DATETIME ?? '2021-04-21T00:00:00+07:00',
      toDateTime: process.env.BCA_TEST_TO_DATETIME ?? '2021-04-21T00:00:00+07:00',
    }
    const timestamp = '2026-06-26T10:30:00+07:00'
    const probe = generateServiceSignature(
      config.clientSecret,
      'POST',
      BCA_ENDPOINTS_GOLDEN.BANK_STATEMENT,
      accessToken,
      probeBody,
      timestamp,
    )
    auth.generateSignatureService(
      'POST',
      BCA_ENDPOINTS_GOLDEN.BANK_STATEMENT,
      accessToken,
      probeBody,
      timestamp,
    )
    ok('Signature Service OK')
    console.log(`  bodyHash:     ${probe.bodyHash}`)
    console.log(`  stringToSign: POST:${BCA_ENDPOINTS_GOLDEN.BANK_STATEMENT}:[REDACTED]:${probe.bodyHash}:${timestamp}`)

    section('5/5 Bank Statement (POST /openapi/v1.0/bank-statement)')
    const result = await statement.getBankStatement(
      probeBody.accountNo,
      probeBody.fromDateTime,
      probeBody.toDateTime,
    )

    const txCount = result.detailData?.length ?? 0
    console.log(`\nResponse Code: ${result.responseCode}`)
    console.log(`Response Message: ${result.responseMessage}`)
    console.log(`Transaction Count: ${txCount}`)

    if (result.responseCode === '2001400') {
      ok('Bank Statement OK')
    } else {
      fail(`Unexpected responseCode: ${result.responseCode} — check logs/bca/statement-*.json`)
    }
  } catch (error: unknown) {
    if (error instanceof BcaError) {
      console.error('\nBCA Error')
      console.error(`  code:            ${error.code}`)
      console.error(`  message:         ${error.message}`)
      if (error.responseCode) console.error(`  responseCode:    ${error.responseCode}`)
      if (error.responseMessage) console.error(`  responseMessage: ${error.responseMessage}`)
      console.error(`\nInspect logs in ${getDefaultBcaLogDir()}/`)
      process.exit(1)
    }

    console.error('\nUnexpected error during live BCA checks')
    console.error(error)
    process.exit(1)
  }
}

async function main(): Promise<void> {
  console.log('BCA SNAP Sandbox Validation')
  console.log('===========================')

  runGoldenChecks()

  if (goldenOnly) {
    section('Done (--golden-only)')
    return
  }

  await runLiveChecks()
  console.log('\nAll checks passed.')
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
