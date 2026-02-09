# Settlement Group Feature - Design Document

## Overview

**Feature:** Bulk Settlement Reconciliation (Many Aggregates → 1 Bank Statement)

**Use Case:** Satu Bank Settlement dipetakan ke Multiple POS Aggregates dari berbagai cabang.

```
Bank Statement: QRIS BCA GALAXY Rp 30.000.000
├── Aggregate: Galaxy     Rp  3.000.000
├── Aggregate: Depok       Rp  5.000.000
├── Aggregate: Condet      Rp  2.000.000
├── Aggregate: Grandwis    Rp 10.000.000
└── Aggregate: Cibinong    Rp 10.000.000
TOTAL:                    Rp 30.000.000 ✓
```

---

## DDL - Database Schema

```sql
-- ============================================
-- 1. bank_settlement_groups table
-- ============================================
CREATE TABLE bank_settlement_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  bank_statement_id bigint NOT NULL REFERENCES bank_statements(id),
  settlement_number VARCHAR(50) UNIQUE NOT NULL,
  settlement_date DATE NOT NULL,
  payment_method VARCHAR(50),
  bank_name VARCHAR(100),
  total_statement_amount DECIMAL(18,2) NOT NULL CHECK (total_statement_amount > 0),
  total_allocated_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
  difference DECIMAL(18,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'PENDING' 
    CHECK (status IN ('PENDING', 'RECONCILED', 'DISCREPANCY')),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  
  CONSTRAINT chk_positive_statement_amount CHECK (total_statement_amount > 0)
);

-- Indexes
CREATE INDEX idx_bank_settlement_company ON bank_settlement_groups(company_id);
CREATE INDEX idx_bank_settlement_statement ON bank_settlement_groups(bank_statement_id);
CREATE INDEX idx_bank_settlement_status ON bank_settlement_groups(status);
CREATE INDEX idx_bank_settlement_date ON bank_settlement_groups(settlement_date);
CREATE INDEX idx_bank_settlement_number ON bank_settlement_groups(settlement_number);
CREATE INDEX idx_bank_settlement_created ON bank_settlement_groups(created_at DESC);

-- ============================================
-- 2. bank_settlement_aggregates table
-- ============================================
CREATE TABLE bank_settlement_aggregates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_group_id UUID NOT NULL REFERENCES bank_settlement_groups(id) ON DELETE CASCADE,
  aggregate_id UUID NOT NULL REFERENCES aggregated_transactions(id),
  branch_name VARCHAR(200),
  branch_code VARCHAR(50),
  allocated_amount DECIMAL(18,2) NOT NULL,
  original_amount DECIMAL(18,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(settlement_group_id, aggregate_id),
  CONSTRAINT chk_positive_amount CHECK (allocated_amount > 0),
  CONSTRAINT chk_positive_original CHECK (original_amount > 0)
);

-- Indexes
CREATE INDEX idx_bank_settlement_agg_group ON bank_settlement_aggregates(settlement_group_id);
CREATE INDEX idx_bank_settlement_agg_aggregate ON bank_settlement_aggregates(aggregate_id);
CREATE INDEX idx_bank_settlement_agg_branch ON bank_settlement_aggregates(branch_name);
CREATE INDEX idx_bank_settlement_agg_created ON bank_settlement_aggregates(created_at);

-- ============================================
-- 3. Auto-generate settlement number function
-- Format: SET-YYYYMMDD-XXX
-- ============================================
CREATE OR REPLACE FUNCTION generate_settlement_number(p_settlement_date DATE)
RETURNS VARCHAR(50) AS $$
DECLARE
  v_next_seq INTEGER;
  v_result VARCHAR(50);
BEGIN
  SELECT COALESCE(
    MAX(CAST(SUBSTRING(settlement_number FROM '([0-9]+)$') AS INTEGER)),
    0
  ) + 1 INTO v_next_seq
  FROM bank_settlement_groups
  WHERE settlement_date = p_settlement_date;
  
  v_result := 'SET-' || TO_CHAR(p_settlement_date, 'YYYYMMDD') || '-' || LPAD(v_next_seq::TEXT, 3, '0');
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. Auto-update timestamps function
-- ============================================
CREATE OR REPLACE FUNCTION update_bank_settlement_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_bank_settlement_groups_updated_at
BEFORE UPDATE ON bank_settlement_groups
FOR EACH ROW EXECUTE FUNCTION update_bank_settlement_groups_updated_at();

-- ============================================
-- 5. Auto-generate settlement number on INSERT
-- ============================================
CREATE OR REPLACE FUNCTION set_bank_settlement_number_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.settlement_number IS NULL THEN
    NEW.settlement_number := generate_settlement_number(NEW.settlement_date);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_bank_settlement_number
BEFORE INSERT ON bank_settlement_groups
FOR EACH ROW EXECUTE FUNCTION set_bank_settlement_number_on_insert();
```

---

## What's Allowed / What's Not Allowed

### What's Allowed

| Action | Description |
|--------|-------------|
| 1 Bank Statement → Many Aggregates | Satu settlement group bisa berisi banyak aggregate |
| Duplicate branch names | Branch berbeda dengan nama sama boleh |
| Partial allocation | Boleh proceed dengan warning jika tidak match |
| Revert settlement | Bisa undo settlement group |
| Auto-suggest aggregates | Sistem bisa auto-suggest berdasarkan amount |

### What's Not Allowed

| Action | Reason |
|--------|--------|
| 1 Aggregate → Multiple Settlements | Aggregate hanya boleh di 1 settlement group |
| Aggregate sudah reconciled | is_reconciled = true tidak boleh dipakai |
| Statement sudah reconciled | Statement dengan existing reconciliation tidak boleh |
| Negative allocation | Amount allocation harus positif |

---

## Flow Integration with Existing System

### Data Flow

```
1. User selects statement dari BankMutationTable
2. Sistem detect "Bulk Settlement Candidate"
3. Fetch available aggregates (unreconciled, by payment method, date range)
4. Auto-suggest aggregates based on amount matching
5. User selects/toggles aggregates
6. Real-time calculation: total selected vs statement amount
7. Show difference with warning if not match
8. User confirms (with/without override)
9. Create settlement_group + settlement_aggregate_mappings
10. Mark aggregates as reconciled
11. Mark statement as reconciled
```

---

## UI/UX Components

### 1. Bulk Settlement Modal

```tsx
// features/bank-reconciliation/components/settlement/BulkSettlementModal.tsx

interface BulkSettlementModalProps {
  statement: BankStatementWithMatch;
  isOpen: boolean;
  onClose: () => void;
  onComplete: (settlementGroupId: string) => void;
}

export function BulkSettlementModal({ statement, isOpen, onClose, onComplete }: BulkSettlementModalProps) {
  const [selectedAggregates, setSelectedAggregates] = useState<AggregatedTransaction[]>([]);
  const [overrideDifference, setOverrideDifference] = useState(false);
  
  const statementAmount = (statement.credit_amount || 0) - (statement.debit_amount || 0);
  const totalSelected = selectedAggregates.reduce((sum, agg) => sum + agg.nett_amount, 0);
  const difference = statementAmount - totalSelected;
  const differencePercent = statementAmount !== 0 ? Math.abs(difference) / statementAmount * 100 : 0;
  
  const isExactMatch = difference === 0;
  const isWithinTolerance = differencePercent <= 5;
  const canProceed = isExactMatch || (isWithinTolerance && overrideDifference);
  
  const toggleAggregate = (aggregate: AggregatedTransaction) => {
    setSelectedAggregates(prev => {
      const exists = prev.find(a => a.id === aggregate.id);
      if (exists) return prev.filter(a => a.id !== aggregate.id);
      return [...prev, aggregate];
    });
  };
  
  const handleConfirm = async () => {
    const result = await createSettlement({
      bankStatementId: statement.id,
      aggregateIds: selectedAggregates.map(a => a.id),
      overrideDifference,
    });
    onComplete(result.settlementGroupId);
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Bulk Settlement" size="xl">
      {/* Statement Info */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <h4 className="font-medium mb-2">Bank Statement</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Tanggal</p>
            <p className="font-medium">{statement.transaction_date}</p>
          </div>
          <div>
            <p className="text-gray-500">Amount</p>
            <p className="font-bold text-lg">{formatCurrency(statementAmount)}</p>
          </div>
        </div>
      </div>
      
      {/* Aggregate List */}
      <div className="max-h-64 overflow-y-auto border rounded-lg mb-4">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Branch</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Tanggal</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {availableAggregates.map(aggregate => (
              <tr 
                key={aggregate.id}
                onClick={() => toggleAggregate(aggregate)}
                className={`cursor-pointer ${selectedAggregates.some(s => s.id === aggregate.id) ? 'bg-indigo-50' : ''}`}
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selectedAggregates.some(s => s.id === aggregate.id)}
                    onChange={() => toggleAggregate(aggregate)}
                  />
                  <span className="ml-2">{aggregate.branch_name || '-'}</span>
                </td>
                <td className="px-3 py-2 text-sm text-gray-500">{aggregate.transaction_date}</td>
                <td className="px-3 py-2 text-right font-medium">{formatCurrency(aggregate.nett_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Summary */}
      <div className="bg-indigo-50 rounded-lg p-4 mb-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-indigo-700">Statement Amount</p>
            <p className="text-xl font-bold">{formatCurrency(statementAmount)}</p>
          </div>
          <div>
            <p className="text-sm text-indigo-700">Selected Amount</p>
            <p className="text-xl font-bold">{formatCurrency(totalSelected)}</p>
          </div>
          <div>
            <p className="text-sm text-indigo-700">Difference</p>
            <p className={`text-xl font-bold ${isExactMatch ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(difference)} ({differencePercent.toFixed(2)}%)
            </p>
          </div>
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Batal</Button>
        <Button onClick={handleConfirm} disabled={!canProceed}>
          Confirm Settlement
        </Button>
      </div>
    </Modal>
  );
}
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /settlement/create | Create settlement group |
| GET | /settlement/list | List settlement groups |
| GET | /settlement/:id | Get settlement details |
| DELETE | /settlement/:id/undo | Undo settlement |
| GET | /settlement/aggregates/available | Get available aggregates |

---

## Changes to Existing Code

### Backend Changes

| File | Change | Impact |
|------|--------|--------|
| bank-reconciliation.repository.ts | Tambah method getAvailableAggregates, createSettlement | Medium |
| bank-reconciliation.service.ts | Tambah logic settlement creation | Medium |
| bank-reconciliation.controller.ts | Tambah endpoint handlers | Low |
| bank-reconciliation.routes.ts | Tambah routes | Low |

### Frontend Changes

| File | Change | Impact |
|------|--------|--------|
| types/bank-reconciliation.types.ts | Tambah settlement types | Low |
| api/bank-reconciliation.api.ts | Tambah settlement API methods | Low |
| hooks/useSettlement.ts | NEW FILE | N/A |
| components/settlement/BulkSettlementModal.tsx | NEW FILE | N/A |
| components/settlement/SettlementGroupList.tsx | NEW FILE | N/A |

---

## Implementation Phases

### Phase 1: Backend Foundation
- Create migration script
- Add repository methods
- Add service logic
- Add controller endpoints
- Add API routes

### Phase 2: Frontend Foundation
- Add types definitions
- Create API methods
- Create settlement hook
- Create BulkSettlementModal component
- Create SettlementGroupList component

### Phase 3: Integration
- Add "Bulk Settlement" button ke BankMutationTable
- Integrate modal dengan existing page
- Add undo functionality
- Testing dan bug fixes

---

## Important Notes

1. Migration harus dijalankan SEBELUM deploy frontend
2. Settlement number auto-generated via SQL function (format: SET-YYYYMMDD-XXX)
3. Branch name diambil dari aggregate (denormalized, bukan FK)
4. Status DISCREPANCY jika total allocation ≠ statement amount
5. Warning saja, tidak block proceed (dengan override flag)
6. Parallel dengan existing Multi-Match - tidak interfere
7. Table naming: `bank_settlement_groups` dan `bank_settlement_aggregates`

