---
type: module
slug: purchase-orders
status: active
domain: "[[20-DOMAINS/Purchasing/_Index|Purchasing]]"
backend_path: backend/src/modules/purchase-orders
api_base: /api/v1/purchase-orders
permission_module: purchase_orders
depends_on:
  - "[[30-MODULES/M-suppliers]]"
  - "[[30-MODULES/M-products]]"
  - "[[30-MODULES/M-branches]]"
  - "[[30-MODULES/M-purchase-requests]]"
used_by:
  - "[[30-MODULES/M-goods-receipts]]"
  - "[[30-MODULES/M-purchase-invoices]]"
  - "[[30-MODULES/M-ap-payments]]"
related_tables:
  - purchase_orders
  - purchase_order_lines
  - purchase_order_attachments
last_updated: 2026-06-08
---

# M-Purchase Orders

## Purpose
Manages purchase orders to suppliers. Supports partial fulfillment, short close, and links to marketplace POs.

## Layer Map
```
Routes → Controller → Service → Repository
  ↑           ↑            ↑           ↑
Schema    handleError    Audit     SQL queries
```

## Key Business Rules
- Before confirm: check open fiscal period via `requireWriteAccess`
- Short close: marks PO as closed even with partial quantity (see [[70-FLOWS/PO-to-Payment]])
- GR pending tracking: tracks outstanding delivery per line
- `order_number` generated as formatted sequence per branch

## Known Gotchas / Pitfalls
- Static routes (`/search`, `/trash`) must be declared BEFORE `/:id`
- Merged invoice IDs: `merged_from_invoice_ids` for split AP invoice scenarios
- `purchase_order_lines.remaining_qty` must be recalculated on goods receipt

## Related
- **API:** [[_API-Reference]]
- **Data:** [[_Data-Model]]
- **Relations:** [[_Relations]]