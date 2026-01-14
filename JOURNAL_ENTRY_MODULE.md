# Journal Entry Module - Complete Implementation Guide
**Version:** 2.0 (Updated 2026)  
**Status:** Production-Ready Architecture

## 📋 Overview
Journal Entry adalah modul inti sistem akuntansi yang mencatat semua transaksi keuangan dalam bentuk debit dan credit. Setiap transaksi bisnis (purchase, sales, payment, dll) harus menghasilkan journal entry yang balanced.

**⚠️ CRITICAL:** Journal adalah financial contract, bukan simple table. Treat dengan sangat hati-hati.

---

## 🗄️ Database Schema (REVISED)

### 1. Table: `journal_headers`
```sql
-- Create ENUM types first
CREATE TYPE journal_type_enum AS ENUM (
  'MANUAL', 'PURCHASE', 'SALES', 'PAYMENT', 'RECEIPT', 
  'ADJUSTMENT', 'OPENING', 'CLOSING'
);

CREATE TYPE journal_status_enum AS ENUM (
  'DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'REVERSED'
);

CREATE TABLE journal_headers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id),
  branch_id UUID REFERENCES branches(id),
  
  -- Numbering (REVISED)
  journal_number VARCHAR(50) NOT NULL,
  sequence_number INT NOT NULL, -- For safe re-generation
  
  -- Date & Period (REVISED)
  journal_date DATE NOT NULL,
  period VARCHAR(7) NOT NULL GENERATED ALWAYS AS (TO_CHAR(journal_date, 'YYYY-MM')) STORED,
  
  -- Type & Source (REVISED)
  journal_type journal_type_enum NOT NULL,
  source_module VARCHAR(50), -- PURCHASE, SALES, INVENTORY, etc
  reference_type VARCHAR(50),
  reference_id UUID,
  reference_number VARCHAR(100),
  
  -- Content
  description TEXT NOT NULL,
  
  -- Amounts (REVISED - NO CONSTRAINT)
  total_debit DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_credit DECIMAL(15,2) NOT NULL DEFAULT 0,
  
  -- Currency
  currency VARCHAR(3) NOT NULL DEFAULT 'IDR',
  exchange_rate DECIMAL(15,6) NOT NULL DEFAULT 1,
  
  -- Status & Workflow (REVISED)
  status journal_status_enum NOT NULL DEFAULT 'DRAFT',
  
  -- Reversal
  is_reversed BOOLEAN DEFAULT FALSE,
  reversed_by UUID REFERENCES journal_headers(id),
  reversal_date DATE,
  reversal_reason TEXT,
  
  -- Approval & Posting
  submitted_at TIMESTAMP,
  submitted_by UUID REFERENCES employees(id),
  approved_at TIMESTAMP,
  approved_by UUID REFERENCES employees(id),
  rejected_at TIMESTAMP,
  rejected_by UUID REFERENCES employees(id),
  rejection_reason TEXT,
  posted_at TIMESTAMP,
  posted_by UUID REFERENCES employees(id),
  
  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES employees(id),
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by UUID REFERENCES employees(id),
  deleted_at TIMESTAMP,
  deleted_by UUID REFERENCES employees(id),
  
  -- Metadata (REVISED)
  tags JSONB,
  approval_flow_id UUID,
  
  -- Constraints (REVISED)
  CONSTRAINT unique_journal_number UNIQUE (company_id, journal_number),
  CONSTRAINT unique_sequence UNIQUE (company_id, journal_type, period, sequence_number)
  -- ❌ REMOVED: check_balanced (validated in service layer only)
);

-- Indexes
CREATE INDEX idx_journal_headers_company ON journal_headers(company_id);
CREATE INDEX idx_journal_headers_branch ON journal_headers(branch_id);
CREATE INDEX idx_journal_headers_date ON journal_headers(journal_date);
CREATE INDEX idx_journal_headers_period ON journal_headers(period);
CREATE INDEX idx_journal_headers_type ON journal_headers(journal_type);
CREATE INDEX idx_journal_headers_status ON journal_headers(status);
CREATE INDEX idx_journal_headers_reference ON journal_headers(reference_type, reference_id);
CREATE INDEX idx_journal_headers_deleted ON journal_headers(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_journal_headers_source ON journal_headers(source_module);
CREATE INDEX idx_journal_headers_tags ON journal_headers USING GIN(tags);
```

### 2. Table: `journal_lines`
```sql
CREATE TABLE journal_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  journal_header_id UUID NOT NULL REFERENCES journal_headers(id) ON DELETE CASCADE,
  line_number INT NOT NULL,
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  description TEXT,
  debit_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  credit_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'IDR',
  exchange_rate DECIMAL(15,6) DEFAULT 1,
  base_debit_amount DECIMAL(15,2) NOT NULL DEFAULT 0, -- Amount in base currency
  base_credit_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  cost_center_id UUID, -- For future cost center tracking
  project_id UUID, -- For future project tracking
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT check_debit_or_credit CHECK (
    (debit_amount > 0 AND credit_amount = 0) OR 
    (credit_amount > 0 AND debit_amount = 0)
  ),
  CONSTRAINT unique_line_number UNIQUE (journal_header_id, line_number)
);

-- Indexes
CREATE INDEX idx_journal_lines_header ON journal_lines(journal_header_id);
CREATE INDEX idx_journal_lines_account ON journal_lines(account_id);
```

### 3. Table: `journal_templates` (REVISED)
```sql
CREATE TABLE journal_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id),
  template_code VARCHAR(50) NOT NULL,
  template_name VARCHAR(255) NOT NULL,
  journal_type journal_type_enum NOT NULL, -- ✅ FIXED: Use same ENUM
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES employees(id),
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by UUID REFERENCES employees(id),
  
  CONSTRAINT unique_template_code UNIQUE (company_id, template_code)
);

CREATE TABLE journal_template_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES journal_templates(id) ON DELETE CASCADE,
  line_number INT NOT NULL,
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  side VARCHAR(10) NOT NULL, -- DEBIT or CREDIT
  description TEXT,
  
  CONSTRAINT check_side CHECK (side IN ('DEBIT', 'CREDIT')),
  CONSTRAINT unique_template_line UNIQUE (template_id, line_number)
);
```

---

## 🔧 Backend Implementation

### 1. Types (`journal-headers.types.ts`)
```typescript
export type JournalType = 
  | 'MANUAL' 
  | 'PURCHASE' 
  | 'SALES' 
  | 'PAYMENT' 
  | 'RECEIPT' 
  | 'ADJUSTMENT' 
  | 'OPENING' 
  | 'CLOSING'

export type JournalStatus = 
  | 'DRAFT' 
  | 'SUBMITTED' 
  | 'APPROVED' 
  | 'POSTED' 
  | 'REVERSED'

export interface JournalHeader {
  id: string
  company_id: string
  branch_id?: string
  journal_number: string
  journal_date: string
  period: string
  journal_type: JournalType
  reference_type?: string
  reference_id?: string
  reference_number?: string
  description: string
  total_debit: number
  total_credit: number
  currency: string
  exchange_rate: number
  status: JournalStatus
  is_reversed: boolean
  reversed_by?: string
  reversal_date?: string
  reversal_reason?: string
  posted_at?: string
  posted_by?: string
  approved_at?: string
  approved_by?: string
  created_at: string
  created_by?: string
  updated_at: string
  updated_by?: string
  deleted_at?: string
  deleted_by?: string
}

export interface JournalLine {
  id: string
  journal_header_id: string
  line_number: number
  account_id: string
  description?: string
  debit_amount: number
  credit_amount: number
  currency: string
  exchange_rate: number
  base_debit_amount: number
  base_credit_amount: number
  cost_center_id?: string
  project_id?: string
  created_at: string
}

export interface CreateJournalDto {
  company_id: string
  branch_id?: string
  journal_date: string
  journal_type: JournalType
  reference_type?: string
  reference_id?: string
  reference_number?: string
  description: string
  currency?: string
  exchange_rate?: number
  lines: CreateJournalLineDto[]
}

export interface CreateJournalLineDto {
  line_number: number
  account_id: string
  description?: string
  debit_amount: number
  credit_amount: number
}

export interface UpdateJournalDto {
  journal_date?: string
  description?: string
  lines?: CreateJournalLineDto[]
}

export interface JournalWithLines extends JournalHeader {
  lines: JournalLine[]
  branch_name?: string
  created_by_name?: string
  approved_by_name?: string
  posted_by_name?: string
}

export interface JournalFilter {
  company_id: string
  branch_id?: string
  journal_type?: JournalType
  status?: JournalStatus
  date_from?: string
  date_to?: string
  period?: string
  search?: string
}
```

### 2. Constants (`journal.constants.ts`)
```typescript
export const JOURNAL_TYPES = {
  MANUAL: 'MANUAL',
  PURCHASE: 'PURCHASE',
  SALES: 'SALES',
  PAYMENT: 'PAYMENT',
  RECEIPT: 'RECEIPT',
  ADJUSTMENT: 'ADJUSTMENT',
  OPENING: 'OPENING',
  CLOSING: 'CLOSING'
} as const

export const JOURNAL_STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  POSTED: 'POSTED',
  REVERSED: 'REVERSED'
} as const

export const JOURNAL_TYPE_LABELS = {
  MANUAL: 'Manual Journal',
  PURCHASE: 'Purchase Journal',
  SALES: 'Sales Journal',
  PAYMENT: 'Payment Journal',
  RECEIPT: 'Receipt Journal',
  ADJUSTMENT: 'Adjustment Journal',
  OPENING: 'Opening Balance',
  CLOSING: 'Closing Entry'
}

export const JOURNAL_STATUS_LABELS = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  POSTED: 'Posted',
  REVERSED: 'Reversed'
}

export const JOURNAL_NUMBER_PREFIX = {
  MANUAL: 'JM',
  PURCHASE: 'JP',
  SALES: 'JS',
  PAYMENT: 'JY',
  RECEIPT: 'JR',
  ADJUSTMENT: 'JA',
  OPENING: 'JO',
  CLOSING: 'JC'
}
```

### 3. Validation Utils (`journal.utils.ts`)
```typescript
export function validateJournalBalance(lines: CreateJournalLineDto[]): boolean {
  const totalDebit = lines.reduce((sum, line) => sum + line.debit_amount, 0)
  const totalCredit = lines.reduce((sum, line) => sum + line.credit_amount, 0)
  
  // Allow small rounding differences (0.01)
  return Math.abs(totalDebit - totalCredit) < 0.01
}

export function calculateTotals(lines: CreateJournalLineDto[]) {
  return {
    total_debit: lines.reduce((sum, line) => sum + line.debit_amount, 0),
    total_credit: lines.reduce((sum, line) => sum + line.credit_amount, 0)
  }
}

export function generateJournalNumber(type: JournalType, date: string, sequence: number): string {
  const prefix = JOURNAL_NUMBER_PREFIX[type]
  const year = date.substring(0, 4)
  const month = date.substring(5, 7)
  const seq = sequence.toString().padStart(5, '0')
  
  return `${prefix}/${year}${month}/${seq}`
}

export function getPeriodFromDate(date: string): string {
  return date.substring(0, 7) // YYYY-MM
}

export function validateJournalLines(lines: CreateJournalLineDto[]): string[] {
  const errors: string[] = []
  
  if (!lines || lines.length < 2) {
    errors.push('Journal must have at least 2 lines')
  }
  
  lines.forEach((line, index) => {
    if (!line.account_id) {
      errors.push(`Line ${index + 1}: Account is required`)
    }
    
    if (line.debit_amount === 0 && line.credit_amount === 0) {
      errors.push(`Line ${index + 1}: Amount cannot be zero`)
    }
    
    if (line.debit_amount > 0 && line.credit_amount > 0) {
      errors.push(`Line ${index + 1}: Cannot have both debit and credit`)
    }
    
    if (line.debit_amount < 0 || line.credit_amount < 0) {
      errors.push(`Line ${index + 1}: Amount cannot be negative`)
    }
  })
  
  if (!validateJournalBalance(lines)) {
    errors.push('Journal is not balanced (total debit must equal total credit)')
  }
  
  return errors
}
```

### 4. Errors (`journal-headers.errors.ts`)
```typescript
export class JournalError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'JournalError'
  }
}

export const JournalErrors = {
  NOT_FOUND: () => new JournalError('Journal not found', 'JOURNAL_NOT_FOUND', 404),
  
  NOT_BALANCED: () => new JournalError(
    'Journal is not balanced. Total debit must equal total credit',
    'JOURNAL_NOT_BALANCED'
  ),
  
  INVALID_LINES: (errors: string[]) => new JournalError(
    `Invalid journal lines: ${errors.join(', ')}`,
    'INVALID_JOURNAL_LINES'
  ),
  
  CANNOT_EDIT_POSTED: () => new JournalError(
    'Cannot edit posted journal. Please reverse it first',
    'CANNOT_EDIT_POSTED'
  ),
  
  CANNOT_DELETE_POSTED: () => new JournalError(
    'Cannot delete posted journal. Please reverse it first',
    'CANNOT_DELETE_POSTED'
  ),
  
  ALREADY_POSTED: () => new JournalError(
    'Journal is already posted',
    'ALREADY_POSTED'
  ),
  
  ALREADY_REVERSED: () => new JournalError(
    'Journal is already reversed',
    'ALREADY_REVERSED'
  ),
  
  INVALID_STATUS_TRANSITION: (from: string, to: string) => new JournalError(
    `Cannot change status from ${from} to ${to}`,
    'INVALID_STATUS_TRANSITION'
  ),
  
  ACCOUNT_NOT_POSTABLE: (accountCode: string) => new JournalError(
    `Account ${accountCode} is not postable (header accounts cannot be used)`,
    'ACCOUNT_NOT_POSTABLE'
  ),
  
  PERIOD_CLOSED: (period: string) => new JournalError(
    `Period ${period} is closed. Cannot post journal`,
    'PERIOD_CLOSED'
  )
}
```

---

## 📊 Business Rules

### Journal Entry Rules:
1. **Balance Rule**: Total Debit MUST equal Total Credit
2. **Minimum Lines**: At least 2 lines (1 debit, 1 credit minimum)
3. **Account Validation**: Only postable accounts (is_postable = true)
4. **Status Flow**: DRAFT → SUBMITTED → APPROVED → POSTED
5. **Edit Restriction**: Cannot edit POSTED journals
6. **Reversal**: POSTED journals can only be reversed, not deleted
7. **Period Validation**: Cannot post to closed periods
8. **Currency**: Support multi-currency with exchange rate

### Status Transitions:
```
DRAFT → SUBMITTED → APPROVED → POSTED
  ↓         ↓          ↓          ↓
DELETE   DELETE    DELETE    REVERSE
```

---

## 🎯 API Endpoints

### Journal Headers
```
GET    /api/v1/journals              - List journals (with filters)
GET    /api/v1/journals/:id          - Get journal detail
POST   /api/v1/journals              - Create journal (DRAFT)
PUT    /api/v1/journals/:id          - Update journal (DRAFT only)
DELETE /api/v1/journals/:id          - Delete journal (DRAFT only)

POST   /api/v1/journals/:id/submit   - Submit for approval
POST   /api/v1/journals/:id/approve  - Approve journal
POST   /api/v1/journals/:id/reject   - Reject journal
POST   /api/v1/journals/:id/post     - Post to ledger
POST   /api/v1/journals/:id/reverse  - Reverse posted journal

GET    /api/v1/journals/templates    - List templates
POST   /api/v1/journals/from-template/:templateId - Create from template
```

---

## 🎨 Frontend Features

### Pages:
1. **Journal List Page** - Table with filters
2. **Journal Create Page** - Form with line items
3. **Journal Edit Page** - Edit draft journals
4. **Journal Detail Page** - View with approval buttons
5. **Journal Template Page** - Manage templates

### Key Components:
1. **JournalForm** - Header + Lines entry
2. **JournalLineTable** - Editable line items with auto-balance
3. **JournalStatusBadge** - Color-coded status
4. **JournalApprovalButtons** - Submit/Approve/Reject/Post
5. **AccountSelector** - Dropdown with search
6. **BalanceIndicator** - Real-time debit/credit balance

---

## 🔄 Integration Points

### Auto-Generate Journal from:
1. **Purchase Order** → Journal (Inventory + Payable)
2. **Sales Invoice** → Journal (Receivable + Revenue)
3. **Payment** → Journal (Cash + Payable)
4. **Receipt** → Journal (Cash + Receivable)
5. **Inventory Adjustment** → Journal (Inventory + COGS)
6. **Production** → Journal (WIP + Raw Material)

---

## 📝 Implementation Checklist

### Phase 1: Database & Backend Core
- [ ] Create database tables (migration)
- [ ] Create types & interfaces
- [ ] Create constants & utils
- [ ] Create error classes
- [ ] Create repository layer
- [ ] Create service layer
- [ ] Create controller layer
- [ ] Create routes
- [ ] Add to app.ts

### Phase 2: Business Logic
- [ ] Journal number generation
- [ ] Balance validation
- [ ] Status workflow
- [ ] Approval flow
- [ ] Posting to ledger
- [ ] Reversal logic
- [ ] Template management

### Phase 3: Frontend
- [ ] Create API client
- [ ] Create Zustand store
- [ ] Create types
- [ ] Create List page
- [ ] Create Form page
- [ ] Create Detail page
- [ ] Create components
- [ ] Add routes

### Phase 4: Testing & Integration
- [ ] Unit tests
- [ ] Integration tests
- [ ] Test with Chart of Accounts
- [ ] Test approval workflow
- [ ] Test reversal
- [ ] Performance testing

---

## 💡 Best Practices

1. **Always validate balance** before saving
2. **Use transactions** for journal + lines creation
3. **Audit trail** - track all status changes
4. **Soft delete** - never hard delete posted journals
5. **Period locking** - prevent posting to closed periods
6. **Approval workflow** - enforce 4-eyes principle
7. **Auto-numbering** - sequential by type and period
8. **Currency handling** - store both original and base amounts

---

## 🚀 Next Steps After Journal Module

1. **General Ledger** - Posting & balance calculation
2. **Trial Balance** - Period-end reporting
3. **Financial Statements** - P&L, Balance Sheet, Cash Flow
4. **Period Closing** - Month/Year end process
5. **Budget vs Actual** - Variance analysis

---

**Created by:** Sushimas ERP Development Team  
**Last Updated:** 2024  
**Version:** 1.0


### 4. Table: `journal_audits` (\u2757 WAJIB untuk ERP)
```sql
CREATE TABLE journal_audits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  journal_id UUID NOT NULL REFERENCES journal_headers(id),
  action VARCHAR(50) NOT NULL, -- CREATED, UPDATED, SUBMITTED, APPROVED, REJECTED, POSTED, REVERSED
  from_status journal_status_enum,
  to_status journal_status_enum,
  actor_id UUID REFERENCES employees(id),
  actor_name VARCHAR(255),
  timestamp TIMESTAMP DEFAULT NOW(),
  metadata JSONB, -- Additional context
  ip_address INET,
  user_agent TEXT,
  
  CONSTRAINT check_action CHECK (action IN (
    'CREATED', 'UPDATED', 'SUBMITTED', 'APPROVED', 'REJECTED', 
    'POSTED', 'REVERSED', 'DELETED', 'RESTORED'
  ))
);

CREATE INDEX idx_journal_audits_journal ON journal_audits(journal_id);
CREATE INDEX idx_journal_audits_actor ON journal_audits(actor_id);
CREATE INDEX idx_journal_audits_timestamp ON journal_audits(timestamp);
CREATE INDEX idx_journal_audits_action ON journal_audits(action);
```

---

## \ud83d\udd12 Business Rules (REVISED)

### \u2705 Status Transition Matrix (State Machine)
```typescript
const JOURNAL_STATUS_TRANSITIONS = {
  DRAFT: ['SUBMITTED', 'DELETED'],
  SUBMITTED: ['APPROVED', 'REJECTED', 'DRAFT'],
  APPROVED: ['POSTED', 'REJECTED'],
  REJECTED: ['DRAFT', 'DELETED'],
  POSTED: ['REVERSED'],
  REVERSED: [] // Terminal state
} as const

// Validation function
function canTransition(from: JournalStatus, to: JournalStatus): boolean {
  return JOURNAL_STATUS_TRANSITIONS[from]?.includes(to) ?? false
}
```

### \u26a0\ufe0f Critical Rules:

1. **Balance Validation** - Service layer only, NOT database constraint
   - Reason: Rounding, multi-currency, deadlock prevention
   - Validate before POST, not on every save

2. **Account Validation** (Enhanced)
   ```typescript
   - is_postable = true
   - is_active = true
   - company_id matches
   - currency compatible (or exchange rate provided)
   ```

3. **Period Locking**
   ```typescript
   - Cannot post to closed periods
   - Check fiscal_periods table
   ```

4. **Posting is Atomic Transaction**
   ```sql
   BEGIN;
     -- 1. Validate period open
     -- 2. Validate balance
     -- 3. Insert to general_ledger
     -- 4. Update status = POSTED
     -- 5. Update posted_at/by
     -- 6. Insert audit log
   COMMIT;
   ```

5. **Reversal Creates New Journal**
   ```typescript
   - Same lines, inverted debit/credit
   - Reference to original
   - Auto-post if original was posted
   ```

6. **Exchange Rate Frozen**
   ```typescript
   - Rate saved at journal creation
   - Never recalculated
   - base_amount = amount * exchange_rate (at creation)
   ```

---

## \ud83d\udd27 Backend Implementation (REVISED)

### 1. Enhanced Types
```typescript
export type JournalType = 
  | 'MANUAL' | 'PURCHASE' | 'SALES' | 'PAYMENT' 
  | 'RECEIPT' | 'ADJUSTMENT' | 'OPENING' | 'CLOSING'

export type JournalStatus = 
  | 'DRAFT' | 'SUBMITTED' | 'APPROVED' 
  | 'POSTED' | 'REVERSED' | 'REJECTED'

export type JournalAction =
  | 'CREATED' | 'UPDATED' | 'SUBMITTED' | 'APPROVED' 
  | 'REJECTED' | 'POSTED' | 'REVERSED' | 'DELETED' | 'RESTORED'

// Enhanced interfaces with all new fields
export interface JournalHeader {
  id: string
  company_id: string
  branch_id?: string
  journal_number: string
  sequence_number: number
  journal_date: string
  period: string // Auto-generated
  journal_type: JournalType
  source_module?: string
  reference_type?: string
  reference_id?: string
  reference_number?: string
  description: string
  total_debit: number
  total_credit: number
  currency: string
  exchange_rate: number
  status: JournalStatus
  is_reversed: boolean
  reversed_by?: string
  reversal_date?: string
  reversal_reason?: string
  submitted_at?: string
  submitted_by?: string
  approved_at?: string
  approved_by?: string
  rejected_at?: string
  rejected_by?: string
  rejection_reason?: string
  posted_at?: string
  posted_by?: string
  created_at: string
  created_by?: string
  updated_at: string
  updated_by?: string
  deleted_at?: string
  deleted_by?: string
  tags?: Record<string, any>
  approval_flow_id?: string
}

export interface JournalAudit {
  id: string
  journal_id: string
  action: JournalAction
  from_status?: JournalStatus
  to_status?: JournalStatus
  actor_id?: string
  actor_name?: string
  timestamp: string
  metadata?: Record<string, any>
  ip_address?: string
  user_agent?: string
}
```

### 2. Service Layer - Critical Methods

```typescript
class JournalService {
  
  // \u2705 Validate before any status change
  private validateStatusTransition(from: JournalStatus, to: JournalStatus): void {
    if (!JOURNAL_STATUS_TRANSITIONS[from]?.includes(to)) {
      throw JournalErrors.INVALID_STATUS_TRANSITION(from, to)
    }
  }
  
  // \u2705 Enhanced account validation
  private async validateAccount(accountId: string, companyId: string): Promise<void> {
    const account = await chartOfAccountsRepo.findById(accountId)
    
    if (!account) throw new Error('Account not found')
    if (!account.is_postable) throw JournalErrors.ACCOUNT_NOT_POSTABLE(account.account_code)
    if (!account.is_active) throw new Error('Account is not active')
    if (account.company_id !== companyId) throw new Error('Account does not belong to this company')
  }
  
  // \u2705 Balance validation (service layer only)
  private validateBalance(lines: JournalLine[]): void {
    const totalDebit = lines.reduce((sum, l) => sum + l.debit_amount, 0)
    const totalCredit = lines.reduce((sum, l) => sum + l.credit_amount, 0)
    
    // Allow 0.01 rounding difference
    if (Math.abs(totalDebit - totalCredit) >= 0.01) {
      throw JournalErrors.NOT_BALANCED()
    }
  }
  
  // \u2705 Atomic posting with transaction
  async post(journalId: string, userId: string): Promise<void> {
    return await db.transaction(async (trx) => {
      const journal = await this.findById(journalId, trx)
      
      // 1. Validate status
      this.validateStatusTransition(journal.status, 'POSTED')
      
      // 2. Validate period open
      const periodClosed = await fiscalPeriodRepo.isClosed(journal.period, trx)
      if (periodClosed) throw JournalErrors.PERIOD_CLOSED(journal.period)
      
      // 3. Validate balance
      this.validateBalance(journal.lines)
      
      // 4. Post to general ledger
      await generalLedgerService.postFromJournal(journal, trx)
      
      // 5. Update status
      await journalRepo.updateStatus(journalId, 'POSTED', userId, trx)
      
      // 6. Audit log
      await this.logAudit({
        journal_id: journalId,
        action: 'POSTED',
        from_status: journal.status,
        to_status: 'POSTED',
        actor_id: userId
      }, trx)
    })
  }
  
  // \u2705 Reversal creates new journal
  async reverse(journalId: string, reason: string, userId: string): Promise<JournalHeader> {
    return await db.transaction(async (trx) => {
      const original = await this.findById(journalId, trx)
      
      if (original.status !== 'POSTED') {
        throw new Error('Only posted journals can be reversed')
      }
      
      if (original.is_reversed) {
        throw JournalErrors.ALREADY_REVERSED()
      }
      
      // Create reversal journal
      const reversalLines = original.lines.map(line => ({
        ...line,
        debit_amount: line.credit_amount, // Swap
        credit_amount: line.debit_amount
      }))
      
      const reversal = await this.create({
        ...original,
        description: `REVERSAL: ${original.description}`,
        reference_type: 'journal_reversal',
        reference_id: journalId,
        lines: reversalLines
      }, userId, trx)
      
      // Auto-post reversal
      await this.post(reversal.id, userId)
      
      // Mark original as reversed
      await journalRepo.markReversed(journalId, reversal.id, reason, trx)
      
      return reversal
    })
  }
}
```

---

## \ud83d\udea8 Common Pitfalls & Solutions

### \u274c DON'T:
1. \u274c Enforce balance in DB constraint
2. \u274c Allow edit after POSTED
3. \u274c Delete posted journals
4. \u274c Recalculate exchange rates
5. \u274c Query journal_lines directly for reports

### \u2705 DO:
1. \u2705 Validate balance in service layer before POST
2. \u2705 Use state machine for status transitions
3. \u2705 Reverse instead of delete
4. \u2705 Freeze exchange rate at creation
5. \u2705 Query general_ledger for reports

---

## \ud83d\udcca Performance Considerations

### For Reporting:
```sql
-- \u274c BAD: Query journal_lines directly
SELECT * FROM journal_lines WHERE account_id = '...'

-- \u2705 GOOD: Query general_ledger (after posting)
SELECT * FROM general_ledger WHERE account_id = '...'
```

### Indexes:
- All foreign keys indexed
- Composite index on (company_id, period, status)
- GIN index on JSONB tags
- Partial index on deleted_at IS NULL

---

## \ud83c\udfaf Implementation Priority

### Phase 1: Core (Week 1-2)
- [ ] Database tables + ENUMs
- [ ] Audit trail table
- [ ] Repository layer
- [ ] Service layer with state machine
- [ ] Basic CRUD

### Phase 2: Workflow (Week 3)
- [ ] Submit/Approve/Reject flow
- [ ] Posting to GL (atomic)
- [ ] Reversal logic
- [ ] Period locking check

### Phase 3: Frontend (Week 4)
- [ ] List page with filters
- [ ] Create/Edit form
- [ ] Real-time balance indicator
- [ ] Approval buttons
- [ ] Audit trail view

### Phase 4: Integration (Week 5)
- [ ] Auto-generate from Purchase
- [ ] Auto-generate from Sales
- [ ] Auto-generate from Payment
- [ ] Template system

---

## \ud83d\udcdd Checklist Before Go-Live

- [ ] State machine tested for all transitions
- [ ] Posting is atomic (rollback on error)
- [ ] Reversal creates new journal (not update)
- [ ] Exchange rate frozen at creation
- [ ] Period locking enforced
- [ ] Audit trail captures all actions
- [ ] Balance validated before POST only
- [ ] Account validation includes company check
- [ ] Performance tested with 100k+ journals
- [ ] Backup & restore tested

---

**\u26a0\ufe0f CRITICAL SUCCESS FACTORS:**
1. Treat journal as financial contract
2. Never compromise on audit trail
3. State machine is non-negotiable
4. Posting must be atomic
5. Balance validation at right layer

---

**Created by:** Sushimas ERP Development Team  
**Last Updated:** January 2026  
**Version:** 2.0 (Production-Ready)  
**Reviewed by:** Enterprise Architect


---

## 🎯 Single Source of Truth (CRITICAL)

### ⚠️ Problem: Type Drift
```
TypeScript union ≠ DB ENUM ≠ UI labels
```

### ✅ Solution: Generate from One Source

#### 1. Database ENUM as Source of Truth
```sql
-- database/enums.sql
CREATE TYPE journal_type_enum AS ENUM (
  'MANUAL', 'PURCHASE', 'SALES', 'PAYMENT', 'RECEIPT', 
  'ADJUSTMENT', 'OPENING', 'CLOSING'
);

CREATE TYPE journal_status_enum AS ENUM (
  'DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'REVERSED', 'REJECTED'
);
```

#### 2. Generate TypeScript Types
```typescript
// scripts/generate-types.ts
// Run after DB migration to sync types

import { supabase } from './config/supabase'

async function generateEnumTypes() {
  const { data: journalTypes } = await supabase
    .rpc('get_enum_values', { enum_name: 'journal_type_enum' })
  
  const tsTypes = `
// Auto-generated from database ENUMs - DO NOT EDIT MANUALLY
export type JournalType = ${journalTypes.map(t => `'${t}'`).join(' | ')}
export type JournalStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'POSTED' | 'REVERSED' | 'REJECTED'
  `
  
  fs.writeFileSync('./src/types/generated.ts', tsTypes)
}
```

#### 3. Constants Derived from Types
```typescript
// journal.constants.ts
import { JournalType, JournalStatus } from './generated'

// ✅ Type-safe constants
export const JOURNAL_TYPES: Record<JournalType, JournalType> = {
  MANUAL: 'MANUAL',
  PURCHASE: 'PURCHASE',
  SALES: 'SALES',
  PAYMENT: 'PAYMENT',
  RECEIPT: 'RECEIPT',
  ADJUSTMENT: 'ADJUSTMENT',
  OPENING: 'OPENING',
  CLOSING: 'CLOSING'
} as const

export const JOURNAL_STATUS: Record<JournalStatus, JournalStatus> = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  POSTED: 'POSTED',
  REVERSED: 'REVERSED',
  REJECTED: 'REJECTED'
} as const

// Labels for UI
export const JOURNAL_TYPE_LABELS: Record<JournalType, string> = {
  MANUAL: 'Manual Journal',
  PURCHASE: 'Purchase Journal',
  SALES: 'Sales Journal',
  PAYMENT: 'Payment Journal',
  RECEIPT: 'Receipt Journal',
  ADJUSTMENT: 'Adjustment Journal',
  OPENING: 'Opening Balance',
  CLOSING: 'Closing Entry'
}

export const JOURNAL_STATUS_LABELS: Record<JournalStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  POSTED: 'Posted',
  REVERSED: 'Reversed',
  REJECTED: 'Rejected'
}
```

---

## 🔒 Validation Best Practices

### ❌ NEVER Trust Client Payload for Critical Operations

```typescript
// ❌ BAD: Validate from request payload
async post(journalId: string, userId: string) {
  const journal = req.body // ⚠️ DANGEROUS!
  this.validateBalance(journal.lines) // Client can manipulate
}

// ✅ GOOD: Always fetch from DB
async post(journalId: string, userId: string) {
  // Fetch fresh from database
  const journal = await journalRepo.findById(journalId)
  
  if (!journal) throw new Error('Journal not found')
  
  // Validate from DB data, not client payload
  this.validateBalance(journal.lines)
  
  // ... proceed with posting
}
```

### ✅ Validation Layers

```typescript
class JournalService {
  
  // Layer 1: Input validation (from client)
  private validateCreateInput(dto: CreateJournalDto): void {
    if (!dto.company_id) throw new Error('Company ID required')
    if (!dto.journal_date) throw new Error('Journal date required')
    if (!dto.lines || dto.lines.length < 2) {
      throw new Error('At least 2 lines required')
    }
    // Basic structure validation only
  }
  
  // Layer 2: Business rule validation (from DB)
  private async validateBusinessRules(journal: JournalHeader): Promise<void> {
    // Fetch fresh data from DB
    const dbJournal = await journalRepo.findById(journal.id)
    
    // Validate balance from DB data
    this.validateBalance(dbJournal.lines)
    
    // Validate accounts from DB
    for (const line of dbJournal.lines) {
      await this.validateAccount(line.account_id, journal.company_id)
    }
    
    // Validate period
    const periodClosed = await fiscalPeriodRepo.isClosed(dbJournal.period)
    if (periodClosed) throw JournalErrors.PERIOD_CLOSED(dbJournal.period)
  }
  
  // Layer 3: State validation (from DB)
  private async validateStateTransition(
    journalId: string, 
    toStatus: JournalStatus
  ): Promise<void> {
    // Always fetch current state from DB
    const current = await journalRepo.findById(journalId)
    
    if (!current) throw new Error('Journal not found')
    
    // Validate transition
    if (!this.canTransition(current.status, toStatus)) {
      throw JournalErrors.INVALID_STATUS_TRANSITION(current.status, toStatus)
    }
  }
}
```

### 🔐 Security Checklist

```typescript
// ✅ Always validate:
1. Fetch from DB before critical operations
2. Check company_id matches user's company
3. Check user permissions for action
4. Validate status allows the operation
5. Re-validate balance before POST
6. Check period is not closed
7. Verify accounts belong to same company
8. Audit log every state change

// ❌ Never:
1. Trust client payload for POST/APPROVE
2. Skip validation because "UI already validated"
3. Allow status change without state machine check
4. Post without checking period lock
5. Update posted journals (reverse instead)
```

---

## 📝 Code Generation Script

### Generate Types from Database
```typescript
// scripts/sync-journal-types.ts
import { supabase } from '../src/config/supabase'
import fs from 'fs'

async function syncJournalTypes() {
  console.log('🔄 Syncing journal types from database...')
  
  // Get ENUM values from database
  const { data: types } = await supabase
    .from('pg_enum')
    .select('enumlabel')
    .eq('enumtypid', 'journal_type_enum')
  
  const { data: statuses } = await supabase
    .from('pg_enum')
    .select('enumlabel')
    .eq('enumtypid', 'journal_status_enum')
  
  // Generate TypeScript
  const content = `
/**
 * Auto-generated from database ENUMs
 * DO NOT EDIT MANUALLY
 * Run: npm run sync-types
 * Last sync: ${new Date().toISOString()}
 */

export type JournalType = ${types.map(t => `'${t.enumlabel}'`).join(' | ')}

export type JournalStatus = ${statuses.map(s => `'${s.enumlabel}'`).join(' | ')}

// Validation arrays
export const VALID_JOURNAL_TYPES: JournalType[] = [
  ${types.map(t => `'${t.enumlabel}'`).join(',\n  ')}
]

export const VALID_JOURNAL_STATUSES: JournalStatus[] = [
  ${statuses.map(s => `'${s.enumlabel}'`).join(',\n  ')}
]
  `
  
  fs.writeFileSync('./src/types/journal-generated.ts', content)
  console.log('✅ Types synced successfully!')
}

syncJournalTypes()
```

### Add to package.json
```json
{
  "scripts": {
    "sync-types": "ts-node scripts/sync-journal-types.ts",
    "postmigrate": "npm run sync-types"
  }
}
```

---

## 🧪 Testing Strategy

### Unit Tests
```typescript
describe('JournalService', () => {
  describe('validateBalance', () => {
    it('should accept balanced journal', () => {
      const lines = [
        { debit_amount: 100, credit_amount: 0 },
        { debit_amount: 0, credit_amount: 100 }
      ]
      expect(() => service.validateBalance(lines)).not.toThrow()
    })
    
    it('should reject unbalanced journal', () => {
      const lines = [
        { debit_amount: 100, credit_amount: 0 },
        { debit_amount: 0, credit_amount: 90 }
      ]
      expect(() => service.validateBalance(lines)).toThrow('not balanced')
    })
    
    it('should allow 0.01 rounding difference', () => {
      const lines = [
        { debit_amount: 100.00, credit_amount: 0 },
        { debit_amount: 0, credit_amount: 99.99 }
      ]
      expect(() => service.validateBalance(lines)).not.toThrow()
    })
  })
  
  describe('status transitions', () => {
    it('should allow DRAFT → SUBMITTED', () => {
      expect(service.canTransition('DRAFT', 'SUBMITTED')).toBe(true)
    })
    
    it('should reject DRAFT → POSTED', () => {
      expect(service.canTransition('DRAFT', 'POSTED')).toBe(false)
    })
    
    it('should reject POSTED → DRAFT', () => {
      expect(service.canTransition('POSTED', 'DRAFT')).toBe(false)
    })
  })
})
```

### Integration Tests
```typescript
describe('Journal Posting', () => {
  it('should post journal atomically', async () => {
    const journal = await createTestJournal()
    
    await service.post(journal.id, testUserId)
    
    // Verify journal status
    const posted = await journalRepo.findById(journal.id)
    expect(posted.status).toBe('POSTED')
    expect(posted.posted_at).toBeDefined()
    
    // Verify GL entries created
    const glEntries = await glRepo.findByJournal(journal.id)
    expect(glEntries.length).toBe(journal.lines.length)
    
    // Verify audit log
    const audits = await auditRepo.findByJournal(journal.id)
    expect(audits).toContainEqual(
      expect.objectContaining({ action: 'POSTED' })
    )
  })
  
  it('should rollback on GL insert failure', async () => {
    const journal = await createTestJournal()
    
    // Mock GL insert failure
    jest.spyOn(glRepo, 'insert').mockRejectedValue(new Error('GL error'))
    
    await expect(service.post(journal.id, testUserId)).rejects.toThrow()
    
    // Verify journal status unchanged
    const unchanged = await journalRepo.findById(journal.id)
    expect(unchanged.status).toBe('APPROVED')
  })
})
```

---

## 🚨 Final Checklist

### Before Implementation:
- [ ] DB ENUMs created
- [ ] Type generation script ready
- [ ] State machine matrix defined
- [ ] Audit trail table created

### During Implementation:
- [ ] Always fetch from DB for validation
- [ ] Never trust client payload for POST
- [ ] Use transactions for atomic operations
- [ ] Log every state change

### Before Deployment:
- [ ] Run type sync script
- [ ] Verify ENUM consistency (TS ↔ DB ↔ UI)
- [ ] Test all status transitions
- [ ] Test rollback scenarios
- [ ] Load test with 10k+ journals

---

**🎯 Key Takeaways:**
1. **Single Source of Truth** - Generate types from DB ENUMs
2. **Never Trust Client** - Always validate from DB data
3. **Type Safety** - Use ENUMs everywhere (DB + TS)
4. **Consistency** - Sync types after every migration

---

**Last Updated:** January 2026  
**Version:** 2.1 (Production-Ready + Best Practices)
