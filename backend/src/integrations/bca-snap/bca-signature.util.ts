import { createHash, createHmac, createSign, createVerify } from 'crypto'

export function minifyJson(value: unknown): string {
  if (value === undefined || value === null) {
    return ''
  }
  return JSON.stringify(value)
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex').toLowerCase()
}

export function hmacSha512Base64(secret: string, data: string): string {
  return createHmac('sha512', secret).update(data, 'utf8').digest('base64')
}

export function rsaSha256Base64(privateKeyPem: string, data: string): string {
  const signer = createSign('RSA-SHA256')
  signer.update(data, 'utf8')
  signer.end()
  return signer.sign(privateKeyPem, 'base64')
}

export function verifyRsaSha256Base64(
  publicKeyPem: string,
  data: string,
  signatureBase64: string,
): boolean {
  const verifier = createVerify('RSA-SHA256')
  verifier.update(data, 'utf8')
  verifier.end()
  return verifier.verify(publicKeyPem, signatureBase64, 'base64')
}

export function buildAuthStringToSign(clientId: string, timestamp: string): string {
  return `${clientId}|${timestamp}`
}

export function buildServiceStringToSign(
  method: string,
  relativeUrl: string,
  accessToken: string,
  requestBody: unknown,
  timestamp: string,
): string {
  const bodyHash = sha256Hex(minifyJson(requestBody))
  return `${method.toUpperCase()}:${relativeUrl}:${accessToken}:${bodyHash}:${timestamp}`
}

export function generateAuthSignature(privateKeyPem: string, clientId: string, timestamp: string): string {
  const stringToSign = buildAuthStringToSign(clientId, timestamp)
  return rsaSha256Base64(privateKeyPem, stringToSign)
}

export function generateServiceSignature(
  clientSecret: string,
  method: string,
  relativeUrl: string,
  accessToken: string,
  requestBody: unknown,
  timestamp: string,
): { signature: string; stringToSign: string; bodyHash: string } {
  const bodyHash = sha256Hex(minifyJson(requestBody))
  const stringToSign = `${method.toUpperCase()}:${relativeUrl}:${accessToken}:${bodyHash}:${timestamp}`
  const signature = hmacSha512Base64(clientSecret, stringToSign)
  return { signature, stringToSign, bodyHash }
}
