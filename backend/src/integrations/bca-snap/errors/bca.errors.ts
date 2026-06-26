export class BcaError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly responseCode?: string,
    public readonly responseMessage?: string,
    public readonly retryable = false,
  ) {
    super(message)
    this.name = 'BcaError'
  }
}

export class BcaOAuthError extends BcaError {
  constructor(message: string, responseCode?: string, responseMessage?: string) {
    super(message, 'BCA_OAUTH_FAILED', responseCode, responseMessage, false)
    this.name = 'BcaOAuthError'
  }
}

export class BcaSignatureError extends BcaError {
  constructor(message: string, responseCode?: string, responseMessage?: string) {
    super(message, 'BCA_SIGNATURE_INVALID', responseCode, responseMessage, false)
    this.name = 'BcaSignatureError'
  }
}

export class BcaTokenExpiredError extends BcaError {
  constructor(message: string, responseCode?: string, responseMessage?: string) {
    super(message, 'BCA_TOKEN_EXPIRED', responseCode, responseMessage, true)
    this.name = 'BcaTokenExpiredError'
  }
}

export class BcaTimeoutError extends BcaError {
  constructor(message: string) {
    super(message, 'BCA_TIMEOUT', undefined, undefined, true)
    this.name = 'BcaTimeoutError'
  }
}

export class BcaApiError extends BcaError {
  constructor(
    message: string,
    responseCode?: string,
    responseMessage?: string,
    retryable = false,
  ) {
    super(message, 'BCA_API_ERROR', responseCode, responseMessage, retryable)
    this.name = 'BcaApiError'
  }
}

export class BcaConfigError extends BcaError {
  constructor(message: string) {
    super(message, 'BCA_CONFIG_INVALID', undefined, undefined, false)
    this.name = 'BcaConfigError'
  }
}
