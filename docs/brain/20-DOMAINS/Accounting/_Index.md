---
type: domain
name: Accounting
last_updated: 2026-06-08
---

# Accounting Domain

> Chart of Accounts → Journal → General Ledger → Reports (TB, P&L, Balance Sheet)

## Modules

```dataview
TABLE slug, status, api_base, last_updated
FROM "30-MODULES"
WHERE domain = link([[20-DOMAINS/Accounting/_Index]])
SORT slug ASC
```

## Flow Diagram

```mermaid
flowchart LR
  SUB[Sub-ledgers] --> JRNL[Journals]
  JRNL --> GL[General Ledger]
  GL --> TB[Trial Balance]
  TB --> PL[P&L]
  TB --> BS[Balance Sheet]
  FP[Fiscal Periods] --> JRNL
  COA[Chart of Accounts] --> JRNL
```

## Related Domains

- [[20-DOMAINS/Purchasing/_Index|Purchasing]] — PI and AP post journals
- [[20-DOMAINS/Inventory/_Index|Inventory]] — Stock adjustments post journals