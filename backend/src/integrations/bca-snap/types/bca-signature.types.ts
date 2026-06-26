export interface BcaAuthSignatureInput {
  clientId: string
  timestamp: string
}

export interface BcaServiceSignatureInput {
  method: string
  relativeUrl: string
  accessToken: string
  requestBody: unknown
  timestamp: string
  clientSecret: string
}
