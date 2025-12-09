import rateLimit from 'express-rate-limit';

export const exportLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute
  message: 'Too many export requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
