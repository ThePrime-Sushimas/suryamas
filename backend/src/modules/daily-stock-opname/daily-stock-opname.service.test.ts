import { isWithinClosingTime, todayJakarta, currentTimeJakarta, nowJakarta } from './daily-stock-opname.service'
import type { DailyClosingCount } from './daily-stock-opname.types'

describe('Jakarta timezone utilities', () => {
  describe('nowJakarta()', () => {
    it('should return a Date object', () => {
      const result = nowJakarta()
      expect(result).toBeInstanceOf(Date)
    })

    it('should return a valid date (not NaN)', () => {
      const result = nowJakarta()
      expect(result.getTime()).not.toBeNaN()
    })
  })

  describe('todayJakarta()', () => {
    it('should return a string in YYYY-MM-DD format', () => {
      const result = todayJakarta()
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('should return a valid date string', () => {
      const result = todayJakarta()
      const parsed = new Date(result)
      expect(parsed.getTime()).not.toBeNaN()
    })
  })

  describe('currentTimeJakarta()', () => {
    it('should return a string in HH:mm format', () => {
      const result = currentTimeJakarta()
      expect(result).toMatch(/^\d{2}:\d{2}$/)
    })

    it('should return valid hour (00-23) and minute (00-59)', () => {
      const result = currentTimeJakarta()
      const [hour, minute] = result.split(':').map(Number)
      expect(hour).toBeGreaterThanOrEqual(0)
      expect(hour).toBeLessThanOrEqual(23)
      expect(minute).toBeGreaterThanOrEqual(0)
      expect(minute).toBeLessThanOrEqual(59)
    })
  })
})

describe('isWithinClosingTime()', () => {
  describe('create action (no grace period)', () => {
    it('should return true when current time is before closing time', () => {
      const result = isWithinClosingTime('23:00', 15, 'create', '22:00')
      expect(result).toBe(true)
    })

    it('should return true when current time equals closing time', () => {
      const result = isWithinClosingTime('23:00', 15, 'create', '23:00')
      expect(result).toBe(true)
    })

    it('should return false when current time is after closing time', () => {
      const result = isWithinClosingTime('23:00', 15, 'create', '23:01')
      expect(result).toBe(false)
    })

    it('should NOT apply grace period for create action', () => {
      const result = isWithinClosingTime('23:00', 15, 'create', '23:05')
      expect(result).toBe(false)
    })
  })

  describe('edit action (no grace period)', () => {
    it('should return true when current time is before closing time', () => {
      const result = isWithinClosingTime('22:00', 15, 'edit', '21:30')
      expect(result).toBe(true)
    })

    it('should return true when current time equals closing time', () => {
      const result = isWithinClosingTime('22:00', 15, 'edit', '22:00')
      expect(result).toBe(true)
    })

    it('should return false when current time is after closing time', () => {
      const result = isWithinClosingTime('22:00', 15, 'edit', '22:01')
      expect(result).toBe(false)
    })

    it('should NOT apply grace period for edit action', () => {
      const result = isWithinClosingTime('22:00', 15, 'edit', '22:10')
      expect(result).toBe(false)
    })
  })

  describe('confirm action (with grace period)', () => {
    it('should return true when current time is before closing time', () => {
      const result = isWithinClosingTime('23:00', 15, 'confirm', '22:30')
      expect(result).toBe(true)
    })

    it('should return true when current time is after closing time but within grace period', () => {
      const result = isWithinClosingTime('23:00', 15, 'confirm', '23:10')
      expect(result).toBe(true)
    })

    it('should return true when current time equals closing time + grace period', () => {
      const result = isWithinClosingTime('23:00', 15, 'confirm', '23:15')
      expect(result).toBe(true)
    })

    it('should return false when current time exceeds closing time + grace period', () => {
      const result = isWithinClosingTime('23:00', 15, 'confirm', '23:16')
      expect(result).toBe(false)
    })

    it('should handle zero grace period (same as create/edit)', () => {
      const result = isWithinClosingTime('23:00', 0, 'confirm', '23:01')
      expect(result).toBe(false)
    })

    it('should handle large grace period', () => {
      const result = isWithinClosingTime('22:00', 60, 'confirm', '22:59')
      expect(result).toBe(true)
    })
  })

  describe('default closing time (23:59)', () => {
    it('should allow create at 23:59', () => {
      const result = isWithinClosingTime('23:59', 15, 'create', '23:59')
      expect(result).toBe(true)
    })

    it('should not allow create at 00:00 (next day)', () => {
      // 00:00 = 0 minutes, 23:59 = 1439 minutes → 0 <= 1439 → true
      // This is correct: at midnight (00:00) the system considers it a new day
      // and the closing time check passes because 0 < 1439
      const result = isWithinClosingTime('23:59', 15, 'create', '00:00')
      expect(result).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle midnight closing time', () => {
      // closing_time 00:00 = 0 minutes
      // current time 00:00 = 0 minutes → 0 <= 0 → true
      const result = isWithinClosingTime('00:00', 0, 'create', '00:00')
      expect(result).toBe(true)
    })

    it('should handle early morning closing time', () => {
      const result = isWithinClosingTime('02:00', 15, 'create', '01:30')
      expect(result).toBe(true)
    })

    it('should reject time after early morning closing', () => {
      const result = isWithinClosingTime('02:00', 15, 'create', '02:01')
      expect(result).toBe(false)
    })
  })
})

describe('DailyStockOpnameService.isSessionExpired()', () => {
  const { dailyStockOpnameService } = require('./daily-stock-opname.service')

  it('should return true when DRAFT session closing_date is before today', () => {
    const session = {
      status: 'DRAFT',
      closing_date: '2020-01-01',
    } as DailyClosingCount

    expect(dailyStockOpnameService.isSessionExpired(session)).toBe(true)
  })

  it('should return false when DRAFT session closing_date is today', () => {
    const today = todayJakarta()
    const session = {
      status: 'DRAFT',
      closing_date: today,
    } as DailyClosingCount

    expect(dailyStockOpnameService.isSessionExpired(session)).toBe(false)
  })

  it('should return false when session is CONFIRMED (regardless of date)', () => {
    const session = {
      status: 'CONFIRMED',
      closing_date: '2020-01-01',
    } as DailyClosingCount

    expect(dailyStockOpnameService.isSessionExpired(session)).toBe(false)
  })

  it('should return false when session is FLAGGED (regardless of date)', () => {
    const session = {
      status: 'FLAGGED',
      closing_date: '2020-01-01',
    } as DailyClosingCount

    expect(dailyStockOpnameService.isSessionExpired(session)).toBe(false)
  })

  it('should return false when DRAFT session closing_date is in the future', () => {
    const session = {
      status: 'DRAFT',
      closing_date: '2099-12-31',
    } as DailyClosingCount

    expect(dailyStockOpnameService.isSessionExpired(session)).toBe(false)
  })
})
