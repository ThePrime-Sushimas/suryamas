import rateLimit from 'express-rate-limit'

export const exportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many export requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
})

// FIX #8: Rate limiters for banks and bank accounts
export const createRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many create requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
})

export const updateRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: 'Too many update requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
})
