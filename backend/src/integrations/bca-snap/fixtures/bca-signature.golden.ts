/**
 * Golden vectors derived from BCA Developer API documentation.
 * @see https://developer.bca.co.id/Dokumentasi
 */

/** SNAP Bank Statement request body (sandbox documentation example). */
export const GOLDEN_BANK_STATEMENT_BODY = {
  partnerReferenceNo: '2020102900000000000001',
  accountNo: '1234567890',
  fromDateTime: '2021-04-21T00:00:00+07:00',
  toDateTime: '2021-04-21T00:00:00+07:00',
} as const

/** Expected minifyJson() output — no spaces, stable key order from object literal. */
export const GOLDEN_BANK_STATEMENT_MINIFIED =
  '{"partnerReferenceNo":"2020102900000000000001","accountNo":"1234567890","fromDateTime":"2021-04-21T00:00:00+07:00","toDateTime":"2021-04-21T00:00:00+07:00"}'

/** Lowercase hex SHA-256 of minified bank statement body. */
export const GOLDEN_BANK_STATEMENT_BODY_HASH =
  'd1d260906070a80d0cbfee1e981c7fcbf4286357dca33a597e6573757643b205'

/** SHA-256 of empty string (GET / no body). */
export const GOLDEN_EMPTY_BODY_HASH =
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

/**
 * Legacy BCA API transfer example — documents the exact body hash used in
 * StringToSign before SNAP minify requirement. Kept to verify hash algorithm.
 */
export const GOLDEN_LEGACY_TRANSFER_BODY_HASH =
  'e3cf5797ac4ac02f7dad89ed2c5f5615c9884b2d802a504e4aebb76f45b8bdfb'

export const GOLDEN_LEGACY_API_SECRET = '22a2d25e-765d-41e1-8d29-da68dcb5698b'

export const GOLDEN_LEGACY_ACCESS_TOKEN =
  'lIWOt2p29grUo59bedBUrBY3pnzqQX544LzYPohcGHOuwn8AUEdUKS'

export const GOLDEN_LEGACY_TRANSFER_STRING_TO_SIGN =
  `POST:/banking/corporates/transfers:${GOLDEN_LEGACY_ACCESS_TOKEN}:${GOLDEN_LEGACY_TRANSFER_BODY_HASH}:2016-02-03T10:00:00.000+07:00`

/** Legacy API used HMAC-SHA256 → hex (not SNAP). Documents algorithm difference. */
export const GOLDEN_LEGACY_HMAC_SHA256_HEX =
  '69ad66589ade078a30922a0848725cf153aecfcca82eba94e3270285b4a9c604'

/** SNAP service signature — HMAC-SHA512 → Base64. */
export const GOLDEN_SNAP_SERVICE_STRING_TO_SIGN =
  `POST:/openapi/v1.0/bank-statement:ACCESS_TOKEN:${GOLDEN_BANK_STATEMENT_BODY_HASH}:2026-06-26T10:30:00+07:00`

export const GOLDEN_SNAP_HMAC_SHA512_BASE64 =
  'AmyL/ikSL3iUUesXB76Ds7qkmoOm/kJ87tO9X0BnyCrmrwdFon7seNU123qQnp0OE8EhqH4Y2xsh57ggUtvH5w=='

/** OAuth asymmetric signature string format. */
export const GOLDEN_OAUTH_CLIENT_ID = 'sandbox-client'
export const GOLDEN_OAUTH_TIMESTAMP = '2022-04-21T17:34:52+07:00'
export const GOLDEN_OAUTH_STRING_TO_SIGN = `${GOLDEN_OAUTH_CLIENT_ID}|${GOLDEN_OAUTH_TIMESTAMP}`

export const BCA_ENDPOINTS_GOLDEN = {
  ACCESS_TOKEN: '/openapi/v1.0/access-token/b2b',
  BANK_STATEMENT: '/openapi/v1.0/bank-statement',
} as const
