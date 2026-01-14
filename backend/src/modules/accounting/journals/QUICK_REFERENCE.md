# Journal Headers - Quick Reference

## 🚀 Quick Start

### 1. Import in your code
```typescript
import { journalHeadersService } from './modules/accounting/journals/journal-headers'
import { JournalErrors } from './modules/accounting/journals/shared/journal.errors'
```

### 2. Create a journal
```typescript
const journal = await journalHeadersService.create({
  company_id: 'uuid',
  journal_date: '2026-01-15',
  journal_type: 'MANUAL',
  description: 'Test entry',
  lines: [
    { line_number: 1, account_id: 'uuid', debit_amount: 1000, credit_amount: 0 },
    { line_number: 2, account_id: 'uuid', debit_amount: 0, credit_amount: 1000 }
  ]
}, userId)
```

### 3. Workflow
```typescript
// Submit
await journalHeadersService.submit(journalId, userId, companyId)

// Approve
await journalHeadersService.approve(journalId, userId, companyId)

// Post
await journalHeadersService.post(journalId, userId, companyId)

// Reverse
await journalHeadersService.reverse(journalId, reason, userId, companyId)
```

---

## 📋 Status Flow

```
CREATE → DRAFT
DRAFT → submit() → SUBMITTED
SUBMITTED → approve() → APPROVED
APPROVED → post() → POSTED
POSTED → reverse() → REVERSED (creates new journal)

SUBMITTED/APPROVED → reject() → REJECTED
REJECTED → (can edit and resubmit)
```

---

## ⚠️ Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `JOURNAL_NOT_BALANCED` | Debit ≠ Credit | Fix line amounts |
| `CANNOT_EDIT_POSTED` | Trying to edit POSTED | Reverse instead |
| `INVALID_STATUS_TRANSITION` | Invalid state change | Check state machine |
| `PERIOD_CLOSED` | Period is closed | Open period or change date |
| `ACCOUNT_NOT_POSTABLE` | Using header account | Use detail account |

---

## 🔍 Query Examples

### List journals
```typescript
const result = await journalHeadersService.list(
  companyId,
  { page: 1, limit: 20, offset: 0 },
  { field: 'journal_date', order: 'desc' },
  { status: 'DRAFT', period: '2026-01' }
)
```

### Get by ID
```typescript
const journal = await journalHeadersService.getById(id, companyId)
console.log(journal.lines) // Array of journal lines
```

---

## 🛠️ Validation Helpers

```typescript
import { 
  validateJournalBalance,
  validateJournalLines,
  canTransition 
} from './shared/journal.utils'

// Check balance
const isBalanced = validateJournalBalance(lines)

// Validate all lines
const errors = validateJournalLines(lines)

// Check state transition
const canSubmit = canTransition('DRAFT', 'SUBMITTED') // true
const canPost = canTransition('DRAFT', 'POSTED') // false
```

---

## 🎨 Constants

```typescript
import { 
  JOURNAL_TYPES,
  JOURNAL_STATUS,
  JOURNAL_TYPE_LABELS,
  JOURNAL_STATUS_LABELS,
  JOURNAL_STATUS_TRANSITIONS
} from './shared/journal.constants'

// Use in UI
<select>
  {Object.entries(JOURNAL_TYPE_LABELS).map(([key, label]) => (
    <option value={key}>{label}</option>
  ))}
</select>
```

---

## 🔐 Security Checklist

- ✅ Always use `requireEmployee(req)` in controller
- ✅ Always fetch from DB before validation
- ✅ Always check `company_id` matches
- ✅ Always validate status before state change
- ✅ Always check period is open before POST
- ✅ Never trust client payload for critical ops

---

## 📞 Support

For issues or questions:
1. Check `IMPLEMENTATION_SUMMARY.md`
2. Check `JOURNAL_ENTRY_MODULE.md`
3. Check error logs in `backend/logs/`
4. Contact: Sushimas ERP Dev Team
