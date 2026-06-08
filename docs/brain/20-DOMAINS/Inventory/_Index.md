---
type: domain
name: Inventory
last_updated: 2026-06-08
---

# Inventory Domain

> Product master → Stock → Warehouse → Adjustments → Opname → Transfer

## Modules

```dataview
TABLE slug, status, api_base, last_updated
FROM "30-MODULES"
WHERE domain = link([[20-DOMAINS/Inventory/_Index]])
SORT slug ASC
```

## Flow Diagram

```mermaid
flowchart LR
  GR[Goods Receipts] --> ST[Stock]
  PR[Production Output] --> ST
  ST --> SA[Stock Adjustments]
  ST --> STRF[Stock Transfers]
  ST --> DSO[Daily Stock Opname]
```

## Related Domains

- [[20-DOMAINS/Purchasing/_Index|Purchasing]] — GR updates stock
- [[20-DOMAINS/Production/_Index|Production]] — Output updates stock