/**
 * Pricelist Validation Utilities
 * Client-side validation rules with memoization
 * 
 * @module pricelists/utils/validation
 */

import { VALIDATION_RULES } from '../constants/pricelist.constants'
import type { CreatePricelistDto, UpdatePricelistDto, PricelistFormErrors } from '../types/pricelist.types'

// Memoized validation cache
const validationCache = new Map<string, PricelistFormErrors>()

// Generate cache key for validation data
function getCacheKey(data: CreatePricelistDto | UpdatePricelistDto): string {
  return JSON.stringify(data)
}

/**
 * Validate create pricelist form (with memoization)
 */
export function validateCreatePricelist(data: CreatePricelistDto): PricelistFormErrors {
  const cacheKey = getCacheKey(data)
  const cached = validationCache.get(cacheKey)
  if (cached) return cached

  const errors: PricelistFormErrors = {}

  // Required fields
  if (!data.supplier_id) {
    errors.supplier_id = 'Supplier is required'
  }

  if (!data.product_id) {
    errors.product_id = 'Product is required'
  }

  if (!data.uom_id) {
    errors.uom_id = 'UOM is required'
  }

  // Price validation
  if (data.price === undefined || data.price === null) {
    errors.price = 'Price is required'
  } else if (data.price < VALIDATION_RULES.PRICE.MIN) {
    errors.price = `Price must be at least ${VALIDATION_RULES.PRICE.MIN}`
  } else if (data.price > VALIDATION_RULES.PRICE.MAX) {
    errors.price = `Price must not exceed ${VALIDATION_RULES.PRICE.MAX}`
  }

  // Valid from validation
  if (!data.valid_from) {
    errors.valid_from = 'Valid from date is required'
  } else {
    const validFrom = new Date(data.valid_from)
    const minDate = new Date(VALIDATION_RULES.VALID_FROM.MIN_DATE)
    const maxDate = new Date()
    maxDate.setFullYear(maxDate.getFullYear() + VALIDATION_RULES.VALID_FROM.MAX_YEARS_AHEAD)

    if (validFrom < minDate) {
      errors.valid_from = `Date must be after ${VALIDATION_RULES.VALID_FROM.MIN_DATE}`
    } else if (validFrom > maxDate) {
      errors.valid_from = `Date must not be more than ${VALIDATION_RULES.VALID_FROM.MAX_YEARS_AHEAD} years ahead`
    }
  }

  // Valid to validation
  if (data.valid_to) {
    const validFrom = new Date(data.valid_from)
    const validTo = new Date(data.valid_to)
    const minValidTo = new Date(validFrom)
    minValidTo.setDate(minValidTo.getDate() + VALIDATION_RULES.VALID_TO.MIN_DAYS_FROM_START)

    if (validTo < minValidTo) {
      errors.valid_to = `End date must be at least ${VALIDATION_RULES.VALID_TO.MIN_DAYS_FROM_START} day after start date`
    }

    const maxDate = new Date()
    maxDate.setFullYear(maxDate.getFullYear() + VALIDATION_RULES.VALID_TO.MAX_YEARS_AHEAD)
    if (validTo > maxDate) {
      errors.valid_to = `Date must not be more than ${VALIDATION_RULES.VALID_TO.MAX_YEARS_AHEAD} years ahead`
    }
  }

  // Cache result
  validationCache.set(cacheKey, errors)
  return errors
}

/**
 * Validate update pricelist form (with memoization)
 */
export function validateUpdatePricelist(data: UpdatePricelistDto): PricelistFormErrors {
  const cacheKey = getCacheKey(data)
  const cached = validationCache.get(cacheKey)
  if (cached) return cached

  const errors: PricelistFormErrors = {}

  // Price validation (if provided)
  if (data.price !== undefined && data.price !== null) {
    if (data.price < VALIDATION_RULES.PRICE.MIN) {
      errors.price = `Price must be at least ${VALIDATION_RULES.PRICE.MIN}`
    } else if (data.price > VALIDATION_RULES.PRICE.MAX) {
      errors.price = `Price must not exceed ${VALIDATION_RULES.PRICE.MAX}`
    }
  }

  // Valid from validation (if provided)
  if (data.valid_from) {
    const validFrom = new Date(data.valid_from)
    const minDate = new Date(VALIDATION_RULES.VALID_FROM.MIN_DATE)
    const maxDate = new Date()
    maxDate.setFullYear(maxDate.getFullYear() + VALIDATION_RULES.VALID_FROM.MAX_YEARS_AHEAD)

    if (validFrom < minDate) {
      errors.valid_from = `Date must be after ${VALIDATION_RULES.VALID_FROM.MIN_DATE}`
    } else if (validFrom > maxDate) {
      errors.valid_from = `Date must not be more than ${VALIDATION_RULES.VALID_FROM.MAX_YEARS_AHEAD} years ahead`
    }
  }

  // Valid to validation (if provided)
  if (data.valid_to && data.valid_from) {
    const validFrom = new Date(data.valid_from)
    const validTo = new Date(data.valid_to)
    const minValidTo = new Date(validFrom)
    minValidTo.setDate(minValidTo.getDate() + VALIDATION_RULES.VALID_TO.MIN_DAYS_FROM_START)

    if (validTo < minValidTo) {
      errors.valid_to = `End date must be at least ${VALIDATION_RULES.VALID_TO.MIN_DAYS_FROM_START} day after start date`
    }
  }

  // Cache result
  validationCache.set(cacheKey, errors)
  return errors
}

/**
 * Check if form has errors
 */
export function hasErrors(errors: PricelistFormErrors): boolean {
  return Object.keys(errors).length > 0
}
