# 🧩 FRONTEND PROMPT — Fiscal Periods Management

## 📌 Context

You are building a **Fiscal Period Management UI** for an accounting ERP system.

This module controls which accounting periods are **open or closed**, and directly affects **journal posting availability**.

**Critical**: This is an accounting governance module. UI must be serious, clear, and safe.

---

## 🎯 Core Requirements

### 1️⃣ List View (Main Screen)

Display a **table of fiscal periods** scoped by company.

#### Columns:
| Column | Type | Display |
|--------|------|---------|
| Period | string | `YYYY-MM` (e.g., 2024-01) |
| Fiscal Year | number | `2024` |
| Period Start | date | `2024-01-01` |
| Period End | date | `2024-01-31` |
| Status | badge | 🟢 **Open** / 🔴 **Closed** |
| Year End | badge | ✓ (if `is_year_end = true`) |
| Adjustment | badge | ✓ (if `is_adjustment_allowed = true`) |
| Created At | datetime | `2024-01-15 10:30` |
| Actions | buttons | View, Edit, Close, Delete, Restore |

#### Status Badge Colors:
- 🟢 **Open**: Green (`bg-green-100 text-green-800`)
- 🔴 **Closed**: Red (`bg-red-100 text-red-800`)

---

### 2️⃣ Actions Per Row

| Action | Condition | Permission |
|--------|-----------|------------|
| **View** | Always | `view` |
| **Edit** | Only if `is_open = true` | `update` |
| **Close Period** | Only if `is_open = true` | `update` |
| **Delete** | Only if `is_open = true` AND no journals | `delete` |
| **Restore** | Only if `deleted_at != null` | `update` |

⚠️ **CRITICAL**: 
- Closing a period is **irreversible** from UI
- Closed periods **cannot be edited**
- Closed periods **cannot be deleted**

---

### 3️⃣ Create Fiscal Period

#### Form Fields:
```typescript
{
  period: string              // Input: YYYY-MM (e.g., 2024-01)
  period_start: string        // DatePicker: YYYY-MM-DD
  period_end: string          // DatePicker: YYYY-MM-DD
  is_year_end: boolean        // Checkbox (default: false)
  is_adjustment_allowed: boolean  // Checkbox (default: true)
}
```

#### Validation Rules:
- ✅ Period format: `YYYY-MM` (regex: `/^\d{4}-(0[1-9]|1[0-2])$/`)
- ✅ Period start ≤ Period end
- ✅ No overlapping periods (backend validation)
- ✅ Year-end must be December (backend validation)
- ✅ One year-end per fiscal year (backend validation)

#### Error Messages (from backend):
- `"Period 2024-01 already exists for this company"`
- `"Period dates overlap with existing period 2024-02 (2024-02-01 to 2024-02-29)"`
- `"Year-end period must be December (month 12)"`
- `"Year-end period already exists for fiscal year 2024: 2024-12"`

---

### 4️⃣ Close Period Flow (CRITICAL)

When user clicks **Close Period**:

1. **Show confirmation modal** with:
   ```
   ⚠️ Close Fiscal Period?
   
   Period: 2024-01
   
   Warning: Closing this period will:
   • Prevent new journal entries
   • Make this period read-only
   • Cannot be reopened
   
   Close Reason (optional):
   [Text area - max 500 chars]
   
   [Cancel] [Close Period]
   ```

2. **Require explicit confirmation**
   - User must click "Close Period" button
   - Optional: Require typing "CLOSE" to confirm

3. **API Call**:
   ```typescript
   POST /api/accounting/fiscal-periods/:id/close
   Body: { close_reason?: string }
   ```

4. **Success**:
   - Show toast: "Period 2024-01 closed successfully"
   - Refresh list
   - Update status badge to 🔴 Closed

---

### 5️⃣ Filters & Search

#### Available Filters:
```typescript
{
  fiscal_year?: number        // Dropdown: 2024, 2023, 2022...
  is_open?: boolean          // Dropdown: All, Open, Closed
  show_deleted?: boolean     // Checkbox: Show deleted periods
  q?: string                 // Search input: Period text search
}
```

#### Filter UI:
```
[Fiscal Year ▼] [Status ▼] [☐ Show Deleted] [Search: 🔍]
```

#### Sorting:
- Period (default: descending)
- Fiscal Year
- Status (Open first)
- Created At
- Updated At

---

### 6️⃣ Permissions

UI must **hide/disable actions** based on permissions:

```typescript
const permissions = {
  canView: hasPermission('fiscal-periods', 'view'),
  canCreate: hasPermission('fiscal-periods', 'insert'),
  canUpdate: hasPermission('fiscal-periods', 'update'),
  canDelete: hasPermission('fiscal-periods', 'delete'),
}
```

**Never rely on frontend-only enforcement** - backend validates all actions.

---

### 7️⃣ UX Rules (Accounting Safe)

#### Global Warning:
If **no open period exists** for current company:
```
⚠️ No Open Fiscal Period
Journal posting is currently disabled. Please open a fiscal period.
```

#### Detail View (Modal/Drawer):
Show audit information:
```
Period Information:
• Period: 2024-01
• Fiscal Year: 2024
• Period Start: 2024-01-01
• Period End: 2024-01-31
• Status: 🔴 Closed

Audit Trail:
• Created: 2024-01-15 10:30 by John Doe
• Opened: 2024-01-15 10:30 by John Doe
• Closed: 2024-02-01 09:15 by Jane Smith
• Close Reason: "Month-end closing completed"
```

#### Disabled States:
- **Edit button**: Disabled if `is_open = false`
- **Close button**: Disabled if `is_open = false`
- **Delete button**: Disabled if `is_open = false`

---

### 8️⃣ Export

#### Export Flow:
1. User clicks "Export" button
2. **Generate export token**:
   ```typescript
   GET /api/accounting/fiscal-periods/export/token
   Response: { token: string }
   ```
3. **Download file**:
   ```typescript
   GET /api/accounting/fiscal-periods/export?token={token}&fiscal_year=2024
   ```
4. **Filename format**:
   ```
   fiscal-periods_CompanyName_2024-01-15_103045.xlsx
   ```

#### Export Limits:
- Respect backend limit (10,000 records)
- Show progress indicator
- Handle errors gracefully

---

## 🎨 Design Tone

### ✅ DO:
- **Serious** and professional
- **Clear** labels and messages
- **Explicit** confirmations for destructive actions
- **Audit trail** visibility
- **Status indicators** (badges, colors)

### ❌ DON'T:
- Playful UI elements
- Ambiguous button labels
- Hidden critical information
- Auto-save without confirmation
- Casual language

**Remember**: Accounting ≠ Social Media

---

## 📋 API Endpoints Reference

```typescript
// List
GET /api/accounting/fiscal-periods
Query: { page, limit, fiscal_year?, is_open?, show_deleted?, q? }

// Get by ID
GET /api/accounting/fiscal-periods/:id

// Create
POST /api/accounting/fiscal-periods
Body: CreateFiscalPeriodDto

// Update (adjustment flag only)
PUT /api/accounting/fiscal-periods/:id
Body: { is_adjustment_allowed?: boolean }

// Close Period (CRITICAL)
POST /api/accounting/fiscal-periods/:id/close
Body: { close_reason?: string }

// Delete
DELETE /api/accounting/fiscal-periods/:id

// Bulk Delete
POST /api/accounting/fiscal-periods/bulk/delete
Body: { ids: string[] }

// Restore
POST /api/accounting/fiscal-periods/:id/restore

// Bulk Restore
POST /api/accounting/fiscal-periods/bulk/restore
Body: { ids: string[] }

// Export Token
GET /api/accounting/fiscal-periods/export/token

// Export
GET /api/accounting/fiscal-periods/export?token={token}
```

---

## 🔧 TypeScript Types

```typescript
export interface FiscalPeriod {
  id: string
  company_id: string
  fiscal_year: number
  period: string // YYYY-MM
  period_start: string // DATE
  period_end: string // DATE
  is_open: boolean
  is_adjustment_allowed: boolean
  is_year_end: boolean
  opened_at?: string
  opened_by?: string
  closed_at?: string
  closed_by?: string
  close_reason?: string
  created_at: string
  created_by?: string
  updated_at: string
  updated_by?: string
  deleted_at?: string
  deleted_by?: string
}

export interface CreateFiscalPeriodDto {
  period: string // YYYY-MM
  period_start: string
  period_end: string
  is_adjustment_allowed?: boolean
  is_year_end?: boolean
}

export interface UpdateFiscalPeriodDto {
  is_adjustment_allowed?: boolean
}

export interface ClosePeriodDto {
  close_reason?: string
}

export interface FiscalPeriodFilter {
  fiscal_year?: number
  is_open?: boolean
  period?: string
  show_deleted?: boolean
  q?: string
}
```

---

## 🚨 Critical Reminders

1. **Closed periods are immutable** - UI must enforce this
2. **Close action is irreversible** - Require strong confirmation
3. **No open period = No journal posting** - Show global warning
4. **Audit trail is mandatory** - Always display who/when
5. **Permissions are enforced** - Backend validates everything
6. **Date overlaps are prevented** - Backend validation
7. **Year-end rules are strict** - Backend validation

---

## 📦 Suggested File Structure

frontend/src/features/accounting/fiscal-periods/
├── api/
│   └── fiscalPeriods.api.ts
├── components/
│   ├── FiscalPeriodFilters.tsx
│   ├── FiscalPeriodForm.tsx
│   ├── FiscalPeriodTable.tsx
│   ├── ClosePeriodModal.tsx
│   └── StatusBadge.tsx
├── constants/
│   └── fiscal-period.constants.ts
├── pages/
│   ├── FiscalPeriodFormPage.tsx
│   ├── FiscalPeriodsDeletedPage.tsx
│   ├── FiscalPeriodsListPage.tsx
│   └── FiscalPeriodsPage.tsx
├── store/
│   └── fiscalPeriods.store.ts
├── types/
│   └── fiscal-period.types.ts
├── utils/
│   └── validation.ts
└── index.ts


---

## ✅ Acceptance Criteria

- [ ] List view displays all fiscal periods with correct status
- [ ] Create form validates period format and date range
- [ ] Close period requires confirmation with warning
- [ ] Closed periods cannot be edited or deleted
- [ ] Filters work correctly (fiscal year, status, search)
- [ ] Permissions hide/disable actions appropriately
- [ ] Export generates correct filename and downloads
- [ ] Audit trail is visible in detail view
- [ ] Global warning shows when no open period exists
- [ ] Error messages from backend are displayed clearly

---

**Module**: Fiscal Periods Management  
**Priority**: HIGH (Required before Journal Entry module)  
**Status**: Ready for Frontend Implementation  
**Backend API**: ✅ Complete and Production-Ready
