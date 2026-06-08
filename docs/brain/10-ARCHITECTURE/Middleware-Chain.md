---
type: architecture
topic: middleware
last_updated: 2026-06-08
---

# Middleware Chain

## Fixed Order (Wajib)

```
authenticate → resolveBranchContext → requireWriteAccess → permission → validateSchema
```

## Middleware Details

| Middleware | File | Purpose |
|------------|------|---------|
| `authenticate` | `auth.middleware.ts` | Verifies JWT, populates `req.user` |
| `resolveBranchContext` | `branch-context.middleware.ts` | Injects `req.context.company_id` and `req.context.branch_id` |
| `requireWriteAccess` | `write-guard.middleware.ts` | Blocks writes to closed fiscal periods or locked branches |
| `permission` | `permission.middleware.ts` | `canView`, `canInsert`, `canUpdate`, `canDelete`, `canApprove`, `canRelease` |
| `validateSchema` | `validation.middleware.ts` | Zod schema validation via `validateSchema(schema)` |

## Route Definition Pattern

```typescript
router.get(
  '/',
  canView(MODULE),
  validateSchema(schema),
  (req, res) => controller.method(req, res)
)
```

## Static Routes Priority

Static routes (`/search`, `/trash`, `/bulk/delete`) MUST be declared **before** `/:id`.

## Related

- [[10-ARCHITECTURE/Auth-Flow]]
- [[10-ARCHITECTURE/Error-Handling]]