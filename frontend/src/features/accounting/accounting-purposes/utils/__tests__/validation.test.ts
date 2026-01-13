import { validatePurposeCode } from '../validation'

describe('validatePurposeCode', () => {
  it('should validate correct purpose codes', () => {
    expect(validatePurposeCode('SALES_INVOICE')).toBe(true)
    expect(validatePurposeCode('TEST123')).toBe(true)
    expect(validatePurposeCode('PURCHASE_ORDER')).toBe(true)
  })

  it('should handle spaces by converting to underscores', () => {
    expect(validatePurposeCode('SALES INVOICE')).toBe(true)
    expect(validatePurposeCode('test code')).toBe(true)
  })

  it('should reject invalid codes', () => {
    expect(validatePurposeCode('')).toBe(false)
    expect(validatePurposeCode('a'.repeat(51))).toBe(false)
    expect(validatePurposeCode('invalid-code')).toBe(false)
    expect(validatePurposeCode('code@test')).toBe(false)
  })

  it('should handle edge cases', () => {
    expect(validatePurposeCode('A')).toBe(true)
    expect(validatePurposeCode('1')).toBe(true)
    expect(validatePurposeCode('_')).toBe(true)
  })
})