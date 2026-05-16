export class MarketplacePoError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MarketplacePoError'
  }
}

export class MarketplaceSessionNotFoundError extends MarketplacePoError {
  constructor(id: string) {
    super(`Marketplace session not found: ${id}`)
    this.name = 'MarketplaceSessionNotFoundError'
  }
}

export class MarketplaceInvalidStatusTransitionError extends MarketplacePoError {
  constructor(from: string, to: string) {
    super(`Invalid marketplace session status transition: ${from} -> ${to}`)
    this.name = 'MarketplaceInvalidStatusTransitionError'
  }
}

export class MarketplaceBusinessRuleError extends MarketplacePoError {
  constructor(message: string) {
    super(message)
    this.name = 'MarketplaceBusinessRuleError'
  }
}

