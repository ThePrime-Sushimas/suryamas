# Journal Validation - Best Practices (FIXED)

## ✅ Issues Fixed

### 1️⃣ Separated Balance Validation from Line Validation

#### Before (❌ WRONG):
```typescript
export function validateJournalLines(lines: JournalLine[]): string[] {
  // ... validate lines
  
  // ❌ Balance validation mixed in
  if (!validateJournalBalance(lines)) {
    errors.push('Journal is not balanced')
  }
  
  return errors
}
```

**Problems:**
- Double responsibility (structure + balance)
- Can't validate partial updates
- Can't skip balance check for reversal
- Can't re-validate balance from DB separately

#### After (✅ CORRECT):
```typescript
// Util: Only structural validation
export function validateJournalLines(lines: JournalLine[]): string[] {
  // Only validate:
  // - line_number exists
  // - line_number unique
  // - account_id exists
  // - amounts valid
  // - debit XOR credit
}

// Util: Separate balance validation
export function validateJournalBalance(lines: JournalLine[]): boolean {
  const totalDebit = lines.reduce((sum, line) => sum + line.debit_amount, 0)
  const totalCredit = lines.reduce((sum, line) => sum + line.credit_amount, 0)
  return Math.abs(totalDebit - totalCredit) < 0.01
}

// Service: Call separately
const lineErrors = validateJournalLines(data.lines)
if (lineErrors.length > 0) throw JournalErrors.INVALID_LINES(lineErrors)

if (!validateJournalBalance(data.lines)) throw JournalErrors.NOT_BALANCED()
```

**Benefits:**
- ✅ Single responsibility
- ✅ Can validate structure without balance
- ✅ Can re-validate balance from DB
- ✅ Flexible for different scenarios

---

### 2️⃣ Fixed Error Messages to Use line_number

#### Before (❌ WRONG):
```typescript
lines.forEach((line, index) => {
  if (!line.account_id) {
    errors.push(`Line ${index + 1}: Account is required`)  // ❌ Array index
  }
})
```

**Problem:**
- If FE re-orders array, error message is misleading
- `index + 1` doesn't match accounting line_number
- Audit trail confusion

#### After (✅ CORRECT):
```typescript
lines.forEach((line) => {
  if (!line.line_number) {
    errors.push(`Line is missing line_number`)
    return
  }
  
  if (!line.account_id) {
    errors.push(`Line ${line.line_number}: Account is required`)  // ✅ Actual line_number
  }
})
```

**Benefits:**
- ✅ Error message matches accounting records
- ✅ Audit trail accurate
- ✅ FE can re-order without breaking error messages

---

### 3️⃣ Added line_number Uniqueness Validation

#### Before (❌ MISSING):
```typescript
// No check for duplicate line_number
// Could have 2 lines with line_number = 1
```

**Problem:**
- Duplicate line numbers break audit trail
- Reconciliation issues
- Database integrity issues

#### After (✅ CORRECT):
```typescript
const lineNumbers = new Set<number>()

lines.forEach((line) => {
  // Validate line_number exists
  if (!line.line_number) {
    errors.push(`Line is missing line_number`)
    return
  }
  
  // Validate line_number uniqueness
  if (lineNumbers.has(line.line_number)) {
    errors.push(`Line ${line.line_number}: Duplicate line number`)
  } else {
    lineNumbers.add(line.line_number)
  }
})
```

**Benefits:**
- ✅ Prevents duplicate line numbers
- ✅ Ensures audit trail integrity
- ✅ Database consistency

---

### 4️⃣ Removed Unused Import

#### Before (❌ WRONG):
```typescript
import { JournalType, JournalStatus } from './journal.types'
// JournalType not used in this file
```

#### After (✅ CORRECT):
```typescript
import { JournalStatus } from './journal.types'
// Only import what's used
```

---

## 🎯 Real-World Scenario: Restoran

### Scenario 1: Kasir Input Manual Journal
```typescript
// Kasir input:
{
  lines: [
    { line_number: 1, account_id: 'cash', debit_amount: 100000, credit_amount: 0 },
    { line_number: 1, account_id: 'sales', debit_amount: 0, credit_amount: 100000 }  // ❌ Duplicate line_number!
  ]
}

// Old validation: Would pass (only checks array index)
// New validation: ✅ Catches duplicate line_number
// Error: "Line 1: Duplicate line number"
```

### Scenario 2: FE Re-orders Lines
```typescript
// FE sorts by account_code, array order changes:
{
  lines: [
    { line_number: 2, account_id: 'sales', ... },    // Array index 0
    { line_number: 1, account_id: 'cash', ... }      // Array index 1
  ]
}

// Old validation: "Line 1: ..." refers to array[0] = line_number 2 ❌ WRONG!
// New validation: "Line 2: ..." refers to actual line_number 2 ✅ CORRECT!
```

### Scenario 3: Partial Update
```typescript
// Update only description, don't re-validate balance
const lineErrors = validateJournalLines(data.lines)  // ✅ Structure only
if (lineErrors.length > 0) throw error

// Skip balance validation for partial update
```

### Scenario 4: POST - Validate from DB
```typescript
// Fetch from DB (never trust client)
const journal = await repository.findById(id)

// Validate structure
const lineErrors = validateJournalLines(journal.lines)
if (lineErrors.length > 0) throw error

// Validate balance separately (critical for POST)
if (!validateJournalBalance(journal.lines)) throw error

// Post to GL
await generalLedger.post(journal)
```

---

## 📊 Validation Flow

```
Client Request
    ↓
Service: validateJournalLines(data.lines)
    ↓ Check structure:
    ↓ - line_number exists?
    ↓ - line_number unique?
    ↓ - account_id exists?
    ↓ - amounts valid?
    ↓
Service: validateJournalBalance(data.lines)
    ↓ Check balance:
    ↓ - total_debit = total_credit?
    ↓
Service: validateAccount(account_id)
    ↓ Check account:
    ↓ - is_postable?
    ↓ - is_active?
    ↓ - company_id match?
    ↓
Repository: Insert
```

---

## ✅ Checklist

- [x] Balance validation separated from line validation
- [x] Error messages use line_number (not array index)
- [x] line_number uniqueness validated
- [x] Unused imports removed
- [x] Service calls both validations separately
- [x] POST validates from DB, not client payload

---

## 🧪 Test Cases

```typescript
// Test: Duplicate line_number
it('should reject duplicate line_number', () => {
  const lines = [
    { line_number: 1, account_id: 'a', debit_amount: 100, credit_amount: 0 },
    { line_number: 1, account_id: 'b', debit_amount: 0, credit_amount: 100 }
  ]
  
  const errors = validateJournalLines(lines)
  expect(errors).toContain('Line 1: Duplicate line number')
})

// Test: Missing line_number
it('should reject missing line_number', () => {
  const lines = [
    { account_id: 'a', debit_amount: 100, credit_amount: 0 }
  ]
  
  const errors = validateJournalLines(lines)
  expect(errors).toContain('Line is missing line_number')
})

// Test: Balance validation separate
it('should validate balance separately', () => {
  const lines = [
    { line_number: 1, account_id: 'a', debit_amount: 100, credit_amount: 0 },
    { line_number: 2, account_id: 'b', debit_amount: 0, credit_amount: 90 }
  ]
  
  const lineErrors = validateJournalLines(lines)
  expect(lineErrors).toHaveLength(0)  // Structure OK
  
  const isBalanced = validateJournalBalance(lines)
  expect(isBalanced).toBe(false)  // Balance NOT OK
})
```

---

**Status:** ✅ **FIXED - PRODUCTION READY**  
**ERP Best Practice:** ✅ **FOLLOWED**  
**Accounting Accuracy:** ✅ **ENSURED**

**Last Updated:** January 2026
