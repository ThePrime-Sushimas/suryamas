---
type: module
slug: goods-receipts
status: active
domain: "[[20-DOMAINS/Purchasing/_Index|Purchasing]]"
backend_path: backend/src/modules/goods-receipts
api_base: /api/v1/goods-receipts
permission_module: goods_receipts
depends_on:
  - "[[30-MODULES/M-purchase-orders]]"
  - "[[30-MODULES/M-products]]"
  - "[[30-MODULES/M-branches]]"
  - "[[30-MODULES/M-warehouses]]"
used_by:
  - "[[30-MODULES/M-purchase-invoices]]"
  - "[[30-MODULES/M-stock]]"
  - "[[30-MODULES/M-ap-payments]]"
related_tables:
  - goods_receipts
  - goods_receipt_lines
last_updated: 2026-06-08
---

# M-Goods Receipts

## Purpose
Records receipt of goods from suppliers against purchase orders. Each receipt updates stock and triggers the "goods received" status on PO lines.

## Layer Map
```
Routes → Controller → Service → Repository
```

## Key Business Rules
- GR can only be created against active (non-closed) POs
- `remaining_qty` on PO line decrements on GR confirm
- GR lines can be partially confirmed via per-line status (see `20260513_goods_processing_per_line_status.sql`)
- GR → Stock update happens at confirm, not at create

## Known Gotchas / Pitfalls
- GR unconfirm resets confirmed inputs — careful sequencing
- Index `gp_outputs_index_pi_list_post_ready` on GP outputs for PI readiness

## Related
- [[70-FLOWS/PO-to-Payment]]
- [[_Data-Model]]