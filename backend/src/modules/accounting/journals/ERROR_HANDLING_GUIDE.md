# Journal Error Handling - Best Practices

## ✅ Type Safety: FIXED

### Before (❌ WRONG):
```typescript
INVALID_STATUS_TRANSITION: (from: string, to: string) => ...
```

### After (✅ CORRECT):
```typescript
INVALID_STATUS_TRANSITION: (from: JournalStatus, to: JournalStatus) => ...
```

**Why?**
- Status adalah kontrak hukum data di ERP
- Type safety mencegah typo dan invalid status
- Compiler akan catch error sebelum runtime

---

## 🎯 Error Usage in Service Layer

### ✅ All Errors Used Correctly:

#### 1. **NOT_FOUND**
```typescript
// Used in: getById()
if (!journal) {
  throw JournalErrors.NOT_FOUND(id)
}
```

#### 2. **NOT_BALANCED**
```typescript
// Used in: validateJournalLines() utility
// Thrown automatically when debit ≠ credit
```

#### 3. **INVALID_LINES**
```typescript
// Used in: create(), update(), post()
const lineErrors = validateJournalLines(data.lines)
if (lineErrors.length > 0) {
  throw JournalErrors.INVALID_LINES(lineErrors)
}
```
**✅ Safe:** Errors come from internal validation, not raw DB

#### 4. **CANNOT_EDIT_POSTED**
```typescript
// Used in: update()
if (existing.status !== 'DRAFT') {
  throw JournalErrors.CANNOT_EDIT_POSTED()
}
```

#### 5. **CANNOT_DELETE_POSTED**
```typescript
// Used in: delete()
if (journal.status !== 'DRAFT' && journal.status !== 'REJECTED') {
  throw JournalErrors.CANNOT_DELETE_POSTED()
}
```

#### 6. **ALREADY_POSTED**
```typescript
// Reserved for future use (e.g., prevent double posting)
```

#### 7. **ALREADY_REVERSED**
```typescript
// Used in: reverse()
if (original.is_reversed) {
  throw JournalErrors.ALREADY_REVERSED()
}
```

#### 8. **INVALID_STATUS_TRANSITION** ✅ NOW TYPE-SAFE
```typescript
// Used in: submit(), approve(), reject(), post(), reverse()
if (!canTransition(journal.status, 'SUBMITTED')) {
  throw JournalErrors.INVALID_STATUS_TRANSITION(journal.status, 'SUBMITTED')
}
```

#### 9. **ACCOUNT_NOT_POSTABLE**
```typescript
// Used in: validateAccount()
if (!account.is_postable) {
  throw JournalErrors.ACCOUNT_NOT_POSTABLE(account.account_code)
}
```

#### 10. **PERIOD_CLOSED**
```typescript
// Used in: post()
if (!period || !period.is_open) {
  throw JournalErrors.PERIOD_CLOSED(journal.period)
}
```

#### 11. **VALIDATION_ERROR**
```typescript
// Used in: validateAccount()
if (!account) {
  throw JournalErrors.VALIDATION_ERROR('account', 'Account not found')
}
```

---

## 🔒 Security: No Raw DB Errors Exposed

### ✅ Repository Layer Throws Generic Errors:
```typescript
// repository.ts
if (error) throw new Error(error.message)
```

### ✅ Service Layer Catches and Wraps:
```typescript
// service.ts
try {
  await repository.create(...)
} catch (error) {
  // Log internal error
  logError('Failed to create journal', { error })
  
  // Throw domain error (not raw DB error)
  throw JournalErrors.VALIDATION_ERROR('journal', 'Failed to create journal')
}
```

### ✅ Controller Layer Handles All:
```typescript
// controller.ts
try {
  await service.create(...)
} catch (error) {
  handleError(res, error) // Sanitizes error before sending to client
}
```

---

## 📊 Error Flow Diagram

```
Client Request
    ↓
Controller (try/catch)
    ↓
Service (domain validation)
    ↓ throws JournalError
    ↓
Repository (DB operations)
    ↓ throws generic Error
    ↓
Service (catches & wraps)
    ↓ throws JournalError
    ↓
Controller (catches)
    ↓
handleError() (sanitizes)
    ↓
Client Response (safe error message)
```

---

## ⚠️ Critical Rules

### ✅ DO:
1. ✅ Use `JournalErrors` for all domain errors
2. ✅ Use type-safe parameters (`JournalStatus`, not `string`)
3. ✅ Validate in service layer, not controller
4. ✅ Log internal errors, throw domain errors
5. ✅ Catch and wrap repository errors

### ❌ DON'T:
1. ❌ Throw generic `Error` in service layer
2. ❌ Expose raw database errors to client
3. ❌ Use `string` for status parameters
4. ❌ Skip validation before state transitions
5. ❌ Trust client payload for critical operations

---

## 🧪 Testing Error Scenarios

```typescript
// Test: Invalid status transition
it('should throw INVALID_STATUS_TRANSITION', async () => {
  const journal = await createJournal({ status: 'DRAFT' })
  
  await expect(
    service.post(journal.id, userId, companyId)
  ).rejects.toThrow(JournalErrors.INVALID_STATUS_TRANSITION('DRAFT', 'POSTED'))
})

// Test: Period closed
it('should throw PERIOD_CLOSED', async () => {
  await closePeriod('2026-01')
  
  await expect(
    service.post(journalId, userId, companyId)
  ).rejects.toThrow(JournalErrors.PERIOD_CLOSED('2026-01'))
})

// Test: Account not postable
it('should throw ACCOUNT_NOT_POSTABLE', async () => {
  const headerAccount = await createAccount({ is_postable: false })
  
  await expect(
    service.create({ lines: [{ account_id: headerAccount.id, ... }] })
  ).rejects.toThrow(JournalErrors.ACCOUNT_NOT_POSTABLE(headerAccount.account_code))
})
```

---

## ✅ Checklist

- [x] All errors use `JournalError` class
- [x] `INVALID_STATUS_TRANSITION` uses `JournalStatus` type
- [x] No raw DB errors exposed to client
- [x] All domain errors properly thrown in service
- [x] Controller catches and sanitizes all errors
- [x] Errors are logged for debugging
- [x] Error messages are user-friendly

---

**Status:** ✅ **PRODUCTION READY**  
**Type Safety:** ✅ **ENFORCED**  
**Security:** ✅ **NO RAW DB ERRORS EXPOSED**

**Last Updated:** January 2026
