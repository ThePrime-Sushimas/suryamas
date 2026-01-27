
```
suryamas
├─ 

│  └─ Users
│     └─ sushimas
│        └─ suryamas
│           ├─ backend
│           │  └─ src
│           │     └─ modules
│           │        └─ pos-imports
│           │           └─ pos-aggregates
│           └─ frontend
│              └─ src
│                 └─ features
│                    └─ pos-aggregates
│                       ├─ api
│                       └─ components
├─ .claude
│  ├─ agents
│  │  └─ kfc
│  │     ├─ spec-design.md
│  │     ├─ spec-impl.md
│  │     ├─ spec-judge.md
│  │     ├─ spec-requirements.md
│  │     ├─ spec-system-prompt-loader.md
│  │     ├─ spec-tasks.md
│  │     └─ spec-test.md
│  ├─ settings
│  │  └─ kfc-settings.json
│  └─ system-prompts
│     └─ spec-workflow-starter.md
├─ .kiro
│  └─ specs
│     ├─ pos-aggregates-api-integration
│     └─ pos-aggregates-route-integration
├─ .qodo
│  ├─ agents
│  └─ workflows
├─ ARCHITECTURE.md
├─ PROJECT_RECOMMENDATIONS.md
├─ backend
│  ├─ .eslintrc.json
│  ├─ .node-version
│  ├─ package-lock.json
│  ├─ package.json
│  ├─ render.yaml
│  ├─ src
│  │  ├─ app.ts
│  │  ├─ config
│  │  │  ├─ banks.config.ts
│  │  │  ├─ logger.ts
│  │  │  ├─ openapi.ts
│  │  │  └─ supabase.ts
│  │  ├─ lib
│  │  │  └─ openapi.ts
│  │  ├─ middleware
│  │  │  ├─ auth.middleware.ts
│  │  │  ├─ branch-context.middleware.ts
│  │  │  ├─ error.middleware.ts
│  │  │  ├─ permission.middleware.ts
│  │  │  ├─ query.middleware.ts
│  │  │  ├─ rateLimiter.middleware.ts
│  │  │  ├─ request-logger.middleware.ts
│  │  │  ├─ upload.middleware.ts
│  │  │  └─ validation.middleware.ts
│  │  ├─ modules
│  │  │  ├─ accounting
│  │  │  │  ├─ accounting-purpose-accounts
│  │  │  │  │  ├─ accounting-purpose-accounts.constants.ts
│  │  │  │  │  ├─ accounting-purpose-accounts.controller.ts
│  │  │  │  │  ├─ accounting-purpose-accounts.errors.ts
│  │  │  │  │  ├─ accounting-purpose-accounts.repository.ts
│  │  │  │  │  ├─ accounting-purpose-accounts.routes.ts
│  │  │  │  │  ├─ accounting-purpose-accounts.schema.ts
│  │  │  │  │  ├─ accounting-purpose-accounts.service.ts
│  │  │  │  │  ├─ accounting-purpose-accounts.types.ts
│  │  │  │  │  └─ index.ts
│  │  │  │  ├─ accounting-purposes
│  │  │  │  │  ├─ accounting-purposes.config.ts
│  │  │  │  │  ├─ accounting-purposes.constants.ts
│  │  │  │  │  ├─ accounting-purposes.controller.ts
│  │  │  │  │  ├─ accounting-purposes.errors.ts
│  │  │  │  │  ├─ accounting-purposes.repository.ts
│  │  │  │  │  ├─ accounting-purposes.routes.ts
│  │  │  │  │  ├─ accounting-purposes.schema.ts
│  │  │  │  │  ├─ accounting-purposes.service.ts
│  │  │  │  │  ├─ accounting-purposes.types.ts
│  │  │  │  │  └─ index.ts
│  │  │  │  ├─ chart-of-accounts
│  │  │  │  │  ├─ chart-of-accounts.constants.ts
│  │  │  │  │  ├─ chart-of-accounts.controller.ts
│  │  │  │  │  ├─ chart-of-accounts.errors.ts
│  │  │  │  │  ├─ chart-of-accounts.repository.ts
│  │  │  │  │  ├─ chart-of-accounts.routes.ts
│  │  │  │  │  ├─ chart-of-accounts.schema.ts
│  │  │  │  │  ├─ chart-of-accounts.service.ts
│  │  │  │  │  ├─ chart-of-accounts.types.ts
│  │  │  │  │  └─ index.ts
│  │  │  │  ├─ fiscal-periods
│  │  │  │  │  ├─ fiscal-periods.config.ts
│  │  │  │  │  ├─ fiscal-periods.constants.ts
│  │  │  │  │  ├─ fiscal-periods.controller.ts
│  │  │  │  │  ├─ fiscal-periods.errors.ts
│  │  │  │  │  ├─ fiscal-periods.repository.ts
│  │  │  │  │  ├─ fiscal-periods.routes.ts
│  │  │  │  │  ├─ fiscal-periods.schema.ts
│  │  │  │  │  ├─ fiscal-periods.service.ts
│  │  │  │  │  ├─ fiscal-periods.types.ts
│  │  │  │  │  └─ index.ts
│  │  │  │  ├─ index.ts
│  │  │  │  ├─ journals
│  │  │  │  │  ├─ journal-headers
│  │  │  │  │  │  ├─ index.ts
│  │  │  │  │  │  ├─ journal-headers.controller.ts
│  │  │  │  │  │  ├─ journal-headers.permissions.ts
│  │  │  │  │  │  ├─ journal-headers.repository.ts
│  │  │  │  │  │  ├─ journal-headers.routes.ts
│  │  │  │  │  │  ├─ journal-headers.schema.ts
│  │  │  │  │  │  ├─ journal-headers.service.ts
│  │  │  │  │  │  └─ journal-headers.types.ts
│  │  │  │  │  ├─ journal-lines
│  │  │  │  │  │  ├─ index.ts
│  │  │  │  │  │  ├─ journal-lines.controller.ts
│  │  │  │  │  │  ├─ journal-lines.repository.ts
│  │  │  │  │  │  ├─ journal-lines.routes.ts
│  │  │  │  │  │  ├─ journal-lines.schema.ts
│  │  │  │  │  │  ├─ journal-lines.service.ts
│  │  │  │  │  │  └─ journal-lines.types.ts
│  │  │  │  │  └─ shared
│  │  │  │  │     ├─ journal.constants.ts
│  │  │  │  │     ├─ journal.errors.ts
│  │  │  │  │     ├─ journal.types.ts
│  │  │  │  │     └─ journal.utils.ts
│  │  │  │  └─ shared
│  │  │  │     ├─ accounting.constants.ts
│  │  │  │     ├─ accounting.errors.ts
│  │  │  │     └─ accounting.types.ts
│  │  │  ├─ auth
│  │  │  │  ├─ README.md
│  │  │  │  ├─ auth.controller.ts
│  │  │  │  ├─ auth.openapi.ts
│  │  │  │  ├─ auth.routes.ts
│  │  │  │  └─ auth.schema.ts
│  │  │  ├─ bank-accounts
│  │  │  │  ├─ bankAccounts.controller.ts
│  │  │  │  ├─ bankAccounts.errors.ts
│  │  │  │  ├─ bankAccounts.openapi.ts
│  │  │  │  ├─ bankAccounts.repository.ts
│  │  │  │  ├─ bankAccounts.routes.ts
│  │  │  │  ├─ bankAccounts.schema.ts
│  │  │  │  ├─ bankAccounts.service.ts
│  │  │  │  └─ bankAccounts.types.ts
│  │  │  ├─ banks
│  │  │  │  ├─ banks.controller.ts
│  │  │  │  ├─ banks.errors.ts
│  │  │  │  ├─ banks.openapi.ts
│  │  │  │  ├─ banks.repository.ts
│  │  │  │  ├─ banks.routes.ts
│  │  │  │  ├─ banks.schema.ts
│  │  │  │  ├─ banks.service.ts
│  │  │  │  └─ banks.types.ts
│  │  │  ├─ branches
│  │  │  │  ├─ branches.controller.ts
│  │  │  │  ├─ branches.errors.ts
│  │  │  │  ├─ branches.openapi.ts
│  │  │  │  ├─ branches.repository.ts
│  │  │  │  ├─ branches.routes.ts
│  │  │  │  ├─ branches.schema.ts
│  │  │  │  ├─ branches.service.ts
│  │  │  │  └─ branches.types.ts
│  │  │  ├─ categories
│  │  │  │  ├─ categories.controller.ts
│  │  │  │  ├─ categories.errors.ts
│  │  │  │  ├─ categories.mapper.ts
│  │  │  │  ├─ categories.openapi.ts
│  │  │  │  ├─ categories.repository.ts
│  │  │  │  ├─ categories.routes.ts
│  │  │  │  ├─ categories.schema.ts
│  │  │  │  ├─ categories.service.ts
│  │  │  │  └─ categories.types.ts
│  │  │  ├─ companies
│  │  │  │  ├─ companies.config.ts
│  │  │  │  ├─ companies.controller.ts
│  │  │  │  ├─ companies.errors.ts
│  │  │  │  ├─ companies.openapi.ts
│  │  │  │  ├─ companies.repository.ts
│  │  │  │  ├─ companies.routes.ts
│  │  │  │  ├─ companies.schema.ts
│  │  │  │  ├─ companies.service.ts
│  │  │  │  └─ companies.types.ts
│  │  │  ├─ employee_branches
│  │  │  │  ├─ employee_branches.controller.ts
│  │  │  │  ├─ employee_branches.errors.ts
│  │  │  │  ├─ employee_branches.mapper.ts
│  │  │  │  ├─ employee_branches.openapi.ts
│  │  │  │  ├─ employee_branches.repository.ts
│  │  │  │  ├─ employee_branches.routes.ts
│  │  │  │  ├─ employee_branches.schema.ts
│  │  │  │  ├─ employee_branches.service.ts
│  │  │  │  └─ employee_branches.types.ts
│  │  │  ├─ employees
│  │  │  │  ├─ employees.controller.ts
│  │  │  │  ├─ employees.openapi.ts
│  │  │  │  ├─ employees.repository.ts
│  │  │  │  ├─ employees.routes.ts
│  │  │  │  ├─ employees.schema.ts
│  │  │  │  ├─ employees.service.ts
│  │  │  │  └─ employees.types.ts
│  │  │  ├─ jobs
│  │  │  │  ├─ index.ts
│  │  │  │  ├─ jobs.cleanup.ts
│  │  │  │  ├─ jobs.constants.ts
│  │  │  │  ├─ jobs.controller.ts
│  │  │  │  ├─ jobs.errors.ts
│  │  │  │  ├─ jobs.repository.ts
│  │  │  │  ├─ jobs.routes.ts
│  │  │  │  ├─ jobs.schema.ts
│  │  │  │  ├─ jobs.service.ts
│  │  │  │  ├─ jobs.types.ts
│  │  │  │  ├─ jobs.util.ts
│  │  │  │  ├─ jobs.worker.ts
│  │  │  │  └─ processors
│  │  │  │     ├─ employees.export.ts
│  │  │  │     ├─ employees.import.ts
│  │  │  │     ├─ fiscal-periods.export.ts
│  │  │  │     ├─ index.ts
│  │  │  │     ├─ pos-aggregates.job-processor.ts
│  │  │  │     ├─ pos-aggregates.processor.ts
│  │  │  │     ├─ pos-journals.job-processor.ts
│  │  │  │     ├─ pos-journals.processor.ts
│  │  │  │     ├─ pos-transactions.export.ts
│  │  │  │     └─ pos-transactions.import.ts
│  │  │  ├─ metric-units
│  │  │  │  ├─ metricUnits.constants.ts
│  │  │  │  ├─ metricUnits.controller.ts
│  │  │  │  ├─ metricUnits.errors.ts
│  │  │  │  ├─ metricUnits.openapi.ts
│  │  │  │  ├─ metricUnits.repository.ts
│  │  │  │  ├─ metricUnits.routes.ts
│  │  │  │  ├─ metricUnits.schema.ts
│  │  │  │  ├─ metricUnits.service.ts
│  │  │  │  └─ metricUnits.types.ts
│  │  │  ├─ monitoring
│  │  │  │  ├─ index.ts
│  │  │  │  ├─ monitoring.controller.ts
│  │  │  │  ├─ monitoring.routes.ts
│  │  │  │  └─ monitoring.types.ts
│  │  │  ├─ payment-methods
│  │  │  │  ├─ index.ts
│  │  │  │  ├─ payment-methods.controller.ts
│  │  │  │  ├─ payment-methods.errors.ts
│  │  │  │  ├─ payment-methods.openapi.ts
│  │  │  │  ├─ payment-methods.repository.ts
│  │  │  │  ├─ payment-methods.routes.ts
│  │  │  │  ├─ payment-methods.schema.ts
│  │  │  │  ├─ payment-methods.service.ts
│  │  │  │  └─ payment-methods.types.ts
│  │  │  ├─ payment-terms
│  │  │  │  ├─ payment-terms.constants.ts
│  │  │  │  ├─ payment-terms.controller.ts
│  │  │  │  ├─ payment-terms.errors.ts
│  │  │  │  ├─ payment-terms.mapper.ts
│  │  │  │  ├─ payment-terms.openapi.ts
│  │  │  │  ├─ payment-terms.repository.ts
│  │  │  │  ├─ payment-terms.routes.ts
│  │  │  │  ├─ payment-terms.schema.ts
│  │  │  │  ├─ payment-terms.service.ts
│  │  │  │  └─ payment-terms.types.ts
│  │  │  ├─ permissions
│  │  │  │  ├─ index.ts
│  │  │  │  ├─ modules.controller.ts
│  │  │  │  ├─ modules.repository.ts
│  │  │  │  ├─ modules.service.ts
│  │  │  │  ├─ permissions.cache.ts
│  │  │  │  ├─ permissions.errors.ts
│  │  │  │  ├─ permissions.openapi.ts
│  │  │  │  ├─ permissions.routes.ts
│  │  │  │  ├─ permissions.schema.ts
│  │  │  │  ├─ permissions.types.ts
│  │  │  │  ├─ role-permissions.controller.ts
│  │  │  │  ├─ role-permissions.repository.ts
│  │  │  │  ├─ role-permissions.service.ts
│  │  │  │  ├─ roles.controller.ts
│  │  │  │  ├─ roles.repository.ts
│  │  │  │  ├─ roles.service.ts
│  │  │  │  └─ seed.controller.ts
│  │  │  ├─ pos-imports
│  │  │  │  ├─ index.ts
│  │  │  │  ├─ pos-aggregates
│  │  │  │  │  ├─ Postman_Environment_Aggregated_Transactions.json
│  │  │  │  │  ├─ api aggregated pos.json
│  │  │  │  │  ├─ pos-aggregates.controller.ts
│  │  │  │  │  ├─ pos-aggregates.errors.ts
│  │  │  │  │  ├─ pos-aggregates.repository.ts
│  │  │  │  │  ├─ pos-aggregates.routes.ts
│  │  │  │  │  ├─ pos-aggregates.schema.ts
│  │  │  │  │  ├─ pos-aggregates.service.ts
│  │  │  │  │  ├─ pos-aggregates.service.ts<
│  │  │  │  │  │  └─ parameter>
<old_str">    
│  │  │  │  │  └─ pos-aggregates.types.ts
│  │  │  │  ├─ pos-import-lines
│  │  │  │  │  ├─ index.ts
│  │  │  │  │  ├─ pos-import-lines.repository.ts
│  │  │  │  │  └─ pos-import-lines.types.ts
│  │  │  │  ├─ pos-imports
│  │  │  │  │  ├─ index.ts
│  │  │  │  │  ├─ pos-imports.controller.ts
│  │  │  │  │  ├─ pos-imports.repository.ts
│  │  │  │  │  ├─ pos-imports.routes.ts
│  │  │  │  │  ├─ pos-imports.schema.ts
│  │  │  │  │  ├─ pos-imports.service.ts
│  │  │  │  │  └─ pos-imports.types.ts
│  │  │  │  ├─ pos-transactions
│  │  │  │  │  ├─ index.ts
│  │  │  │  │  ├─ pos-transactions.controller.ts
│  │  │  │  │  ├─ pos-transactions.processor.ts
│  │  │  │  │  ├─ pos-transactions.routes.ts
│  │  │  │  │  └─ pos-transactions.service.ts
│  │  │  │  └─ shared
│  │  │  │     ├─ excel-date.util.ts
│  │  │  │     ├─ pos-import.constants.ts
│  │  │  │     ├─ pos-import.errors.ts
│  │  │  │     ├─ pos-import.types.ts
│  │  │  │     └─ pos-import.utils.ts
│  │  │  ├─ pricelists
│  │  │  │  ├─ index.ts
│  │  │  │  ├─ pricelists.controller.ts
│  │  │  │  ├─ pricelists.errors.ts
│  │  │  │  ├─ pricelists.openapi.ts
│  │  │  │  ├─ pricelists.repository.ts
│  │  │  │  ├─ pricelists.routes.ts
│  │  │  │  ├─ pricelists.schema.ts
│  │  │  │  ├─ pricelists.service.ts
│  │  │  │  └─ pricelists.types.ts
│  │  │  ├─ product-uoms
│  │  │  │  ├─ product-uoms.constants.ts
│  │  │  │  ├─ product-uoms.controller.ts
│  │  │  │  ├─ product-uoms.errors.ts
│  │  │  │  ├─ product-uoms.openapi.ts
│  │  │  │  ├─ product-uoms.repository.ts
│  │  │  │  ├─ product-uoms.routes.ts
│  │  │  │  ├─ product-uoms.schema.ts
│  │  │  │  └─ product-uoms.service.ts
│  │  │  ├─ products
│  │  │  │  ├─ products.constants.ts
│  │  │  │  ├─ products.controller.ts
│  │  │  │  ├─ products.errors.ts
│  │  │  │  ├─ products.mapper.ts
│  │  │  │  ├─ products.openapi.ts
│  │  │  │  ├─ products.repository.ts
│  │  │  │  ├─ products.routes.ts
│  │  │  │  ├─ products.schema.ts
│  │  │  │  ├─ products.service.ts
│  │  │  │  └─ products.types.ts
│  │  │  ├─ reconciliation
│  │  │  │  ├─ bank-reconciliation
│  │  │  │  │  ├─ bank-reconciliation.controller.ts
│  │  │  │  │  ├─ bank-reconciliation.repository.ts
│  │  │  │  │  ├─ bank-reconciliation.service.ts
│  │  │  │  │  └─ index.ts
│  │  │  │  ├─ bank-statement-import
│  │  │  │  │  ├─ bank-statement-import.controller.ts
│  │  │  │  │  ├─ bank-statement-import.service.ts
│  │  │  │  │  └─ index.ts
│  │  │  │  ├─ fee-reconciliation
│  │  │  │  │  ├─ fee-calculation.service.ts
│  │  │  │  │  ├─ fee-reconciliation.controller.ts
│  │  │  │  │  ├─ fee-reconciliation.repository.ts
│  │  │  │  │  ├─ fee-reconciliation.service.ts
│  │  │  │  │  ├─ index.ts
│  │  │  │  │  └─ marketing-fee.service.ts
│  │  │  │  ├─ index.ts
│  │  │  │  ├─ orchestrator
│  │  │  │  │  └─ reconciliation-orchestrator.service.ts
│  │  │  │  ├─ pos-reconciliation
│  │  │  │  │  ├─ index.ts
│  │  │  │  │  ├─ pos-reconciliation.controller.ts
│  │  │  │  │  ├─ pos-reconciliation.repository.ts
│  │  │  │  │  └─ pos-reconciliation.service.ts
│  │  │  │  ├─ reconsiliation.md
│  │  │  │  ├─ reports
│  │  │  │  │  ├─ index.ts
│  │  │  │  │  ├─ reports.controller.ts
│  │  │  │  │  └─ reports.service.ts
│  │  │  │  ├─ review-approval
│  │  │  │  │  ├─ index.ts
│  │  │  │  │  ├─ manual-review.controller.ts
│  │  │  │  │  └─ manual-review.service.ts
│  │  │  │  └─ shared
│  │  │  │     ├─ reconciliation.errors.ts
│  │  │  │     └─ reconciliation.types.ts
│  │  │  ├─ sub-categories
│  │  │  │  ├─ sub-categories.controller.ts
│  │  │  │  ├─ sub-categories.openapi.ts
│  │  │  │  ├─ sub-categories.repository.ts
│  │  │  │  ├─ sub-categories.routes.ts
│  │  │  │  ├─ sub-categories.schema.ts
│  │  │  │  └─ sub-categories.service.ts
│  │  │  ├─ supplier-products
│  │  │  │  ├─ index.ts
│  │  │  │  ├─ supplier-products.constants.ts
│  │  │  │  ├─ supplier-products.controller.ts
│  │  │  │  ├─ supplier-products.errors.ts
│  │  │  │  ├─ supplier-products.mapper.ts
│  │  │  │  ├─ supplier-products.openapi.ts
│  │  │  │  ├─ supplier-products.repository.ts
│  │  │  │  ├─ supplier-products.routes.ts
│  │  │  │  ├─ supplier-products.schema.ts
│  │  │  │  ├─ supplier-products.service.ts
│  │  │  │  └─ supplier-products.types.ts
│  │  │  ├─ suppliers
│  │  │  │  ├─ README.md
│  │  │  │  ├─ suppliers.constants.ts
│  │  │  │  ├─ suppliers.controller.ts
│  │  │  │  ├─ suppliers.errors.ts
│  │  │  │  ├─ suppliers.mapper.ts
│  │  │  │  ├─ suppliers.openapi.ts
│  │  │  │  ├─ suppliers.repository.ts
│  │  │  │  ├─ suppliers.routes.ts
│  │  │  │  ├─ suppliers.schema.ts
│  │  │  │  ├─ suppliers.service.ts
│  │  │  │  └─ suppliers.types.ts
│  │  │  └─ users
│  │  │     ├─ users.controller.ts
│  │  │     ├─ users.mapper.ts
│  │  │     ├─ users.openapi.ts
│  │  │     ├─ users.repository.ts
│  │  │     ├─ users.routes.ts
│  │  │     ├─ users.schema.ts
│  │  │     ├─ users.service.ts
│  │  │     └─ users.types.ts
│  │  ├─ seeds
│  │  │  ├─ accounting-purpose-accounts.seed.ts
│  │  │  ├─ accounting-purposes.seed.ts
│  │  │  ├─ default_permissions.ts
│  │  │  └─ run-seeds.ts
│  │  ├─ server.ts
│  │  ├─ services
│  │  │  ├─ audit.service.ts
│  │  │  ├─ export.service.ts
│  │  │  ├─ import.service.ts
│  │  │  ├─ permission.service.ts
│  │  │  ├─ products.export.service.ts
│  │  │  └─ products.import.service.ts
│  │  ├─ types
│  │  │  ├─ common.types.ts
│  │  │  └─ request.types.ts
│  │  └─ utils
│  │     ├─ age.util.ts
│  │     ├─ bulk.util.ts
│  │     ├─ cache.util.ts
│  │     ├─ employee-id-preview.util.ts
│  │     ├─ employee.util.ts
│  │     ├─ error-handler.util.ts
│  │     ├─ export.util.ts
│  │     ├─ handler.ts
│  │     ├─ pagination.util.ts
│  │     ├─ permissions.util.ts
│  │     ├─ response.util.ts
│  │     └─ validation.util.ts
│  ├─ test-swagger.js
│  └─ tsconfig.json
├─ frontend
│  ├─ eslint.config.js
│  ├─ index.html
│  ├─ lighthouserc.js
│  ├─ package-lock.json
│  ├─ package.json
│  ├─ postcss.config.js
│  ├─ public
│  │  └─ vite.svg
│  ├─ src
│  │  ├─ App.tsx
│  │  ├─ assets
│  │  │  └─ react.svg
│  │  ├─ components
│  │  │  ├─ AssignEmployeeToBranchModal.tsx
│  │  │  ├─ BulkActionBar.tsx
│  │  │  ├─ ErrorBoundary.tsx
│  │  │  ├─ ExportButton.tsx
│  │  │  ├─ ImportModal.tsx
│  │  │  ├─ layout
│  │  │  │  ├─ Layout.css
│  │  │  │  └─ Layout.tsx
│  │  │  ├─ mobile
│  │  │  │  ├─ BottomNav.tsx
│  │  │  │  ├─ EmployeeCard.tsx
│  │  │  │  ├─ FloatingActionButton.tsx
│  │  │  │  └─ MobileDrawer.tsx
│  │  │  └─ ui
│  │  │     ├─ ConfirmModal.tsx
│  │  │     ├─ Skeleton.tsx
│  │  │     └─ ToastContainer.tsx
│  │  ├─ constants
│  │  ├─ contexts
│  │  │  └─ ToastContext.tsx
│  │  ├─ features
│  │  │  ├─ accounting
│  │  │  │  ├─ accounting-purpose-accounts
│  │  │  │  │  ├─ api
│  │  │  │  │  │  └─ accountingPurposeAccounts.api.ts
│  │  │  │  │  ├─ components
│  │  │  │  │  │  ├─ AccountingPurposeAccountFilters.tsx
│  │  │  │  │  │  ├─ AccountingPurposeAccountForm.tsx
│  │  │  │  │  │  ├─ AccountingPurposeAccountTable.tsx
│  │  │  │  │  │  ├─ PriorityBadge.tsx
│  │  │  │  │  │  └─ SideBadge.tsx
│  │  │  │  │  ├─ constants
│  │  │  │  │  │  └─ accounting-purpose-account.constants.ts
│  │  │  │  │  ├─ index.ts
│  │  │  │  │  ├─ pages
│  │  │  │  │  │  ├─ AccountingPurposeAccountFormPage.tsx
│  │  │  │  │  │  ├─ AccountingPurposeAccountsDeletedPage.tsx
│  │  │  │  │  │  ├─ AccountingPurposeAccountsListPage.tsx
│  │  │  │  │  │  └─ AccountingPurposeAccountsPage.tsx
│  │  │  │  │  ├─ store
│  │  │  │  │  │  └─ accountingPurposeAccounts.store.ts
│  │  │  │  │  ├─ types
│  │  │  │  │  │  └─ accounting-purpose-account.types.ts
│  │  │  │  │  └─ utils
│  │  │  │  │     └─ validation.ts
│  │  │  │  ├─ accounting-purposes
│  │  │  │  │  ├─ api
│  │  │  │  │  │  └─ accountingPurposes.api.ts
│  │  │  │  │  ├─ components
│  │  │  │  │  │  ├─ AccountingPurposeFilters.tsx
│  │  │  │  │  │  ├─ AccountingPurposeForm.tsx
│  │  │  │  │  │  ├─ AccountingPurposeTable.tsx
│  │  │  │  │  │  ├─ AppliedToBadge.tsx
│  │  │  │  │  │  └─ SystemLockBadge.tsx
│  │  │  │  │  ├─ constants
│  │  │  │  │  │  └─ accounting-purpose.constants.ts
│  │  │  │  │  ├─ hooks
│  │  │  │  │  ├─ index.ts
│  │  │  │  │  ├─ pages
│  │  │  │  │  │  ├─ AccountingPurposeDetailPage.tsx
│  │  │  │  │  │  ├─ AccountingPurposeFormPage.tsx
│  │  │  │  │  │  ├─ AccountingPurposesListPage.tsx
│  │  │  │  │  │  └─ AccountingPurposesPage.tsx
│  │  │  │  │  ├─ store
│  │  │  │  │  │  └─ accountingPurposes.store.ts
│  │  │  │  │  ├─ types
│  │  │  │  │  │  └─ accounting-purpose.types.ts
│  │  │  │  │  └─ utils
│  │  │  │  │     ├─ format.ts
│  │  │  │  │     └─ validation.ts
│  │  │  │  ├─ chart-of-accounts
│  │  │  │  │  ├─ api
│  │  │  │  │  │  └─ chartOfAccounts.api.ts
│  │  │  │  │  ├─ components
│  │  │  │  │  │  ├─ AccountTypeBadge.tsx
│  │  │  │  │  │  ├─ ChartOfAccountFilters.tsx
│  │  │  │  │  │  ├─ ChartOfAccountForm.tsx
│  │  │  │  │  │  ├─ ChartOfAccountTable.tsx
│  │  │  │  │  │  └─ ChartOfAccountTree.tsx
│  │  │  │  │  ├─ constants
│  │  │  │  │  │  └─ chart-of-account.constants.ts
│  │  │  │  │  ├─ index.ts
│  │  │  │  │  ├─ pages
│  │  │  │  │  │  ├─ ChartOfAccountDetailPage.tsx
│  │  │  │  │  │  ├─ ChartOfAccountsPage.tsx
│  │  │  │  │  │  ├─ CreateChartOfAccountPage.tsx
│  │  │  │  │  │  └─ EditChartOfAccountPage.tsx
│  │  │  │  │  ├─ store
│  │  │  │  │  │  └─ chartOfAccounts.store.ts
│  │  │  │  │  ├─ types
│  │  │  │  │  │  └─ chart-of-account.types.ts
│  │  │  │  │  └─ utils
│  │  │  │  │     ├─ format.ts
│  │  │  │  │     └─ validation.ts
│  │  │  │  ├─ fiscal-periods
│  │  │  │  │  ├─ README.md
│  │  │  │  │  ├─ api
│  │  │  │  │  │  └─ fiscalPeriods.api.ts
│  │  │  │  │  ├─ components
│  │  │  │  │  │  ├─ ClosePeriodModal.tsx
│  │  │  │  │  │  ├─ FiscalPeriodFilters.tsx
│  │  │  │  │  │  ├─ FiscalPeriodForm.tsx
│  │  │  │  │  │  ├─ FiscalPeriodTable.tsx
│  │  │  │  │  │  └─ StatusBadge.tsx
│  │  │  │  │  ├─ constants
│  │  │  │  │  │  └─ fiscal-period.constants.ts
│  │  │  │  │  ├─ index.ts
│  │  │  │  │  ├─ pages
│  │  │  │  │  │  ├─ FiscalPeriodEditPage.tsx
│  │  │  │  │  │  ├─ FiscalPeriodFormPage.tsx
│  │  │  │  │  │  ├─ FiscalPeriodsDeletedPage.tsx
│  │  │  │  │  │  ├─ FiscalPeriodsListPage.tsx
│  │  │  │  │  │  └─ FiscalPeriodsPage.tsx
│  │  │  │  │  ├─ store
│  │  │  │  │  │  └─ fiscalPeriods.store.ts
│  │  │  │  │  ├─ types
│  │  │  │  │  │  └─ fiscal-period.types.ts
│  │  │  │  │  └─ utils
│  │  │  │  │     └─ validation.ts
│  │  │  │  ├─ journals
│  │  │  │  │  ├─ journal-headers
│  │  │  │  │  │  ├─ api
│  │  │  │  │  │  │  └─ journalHeaders.api.ts
│  │  │  │  │  │  ├─ components
│  │  │  │  │  │  │  ├─ JournalHeaderFilters.tsx
│  │  │  │  │  │  │  ├─ JournalHeaderForm.tsx
│  │  │  │  │  │  │  ├─ JournalHeaderTable.tsx
│  │  │  │  │  │  │  ├─ JournalLinesTable.tsx
│  │  │  │  │  │  │  ├─ JournalStatusBadge.tsx
│  │  │  │  │  │  │  └─ JournalTypeBadge.tsx
│  │  │  │  │  │  ├─ constants
│  │  │  │  │  │  │  └─ journal-header.constants.ts
│  │  │  │  │  │  ├─ hooks
│  │  │  │  │  │  │  ├─ useAutoSaveDraft.ts
│  │  │  │  │  │  │  └─ useJournalPermissions.ts
│  │  │  │  │  │  ├─ index.ts
│  │  │  │  │  │  ├─ pages
│  │  │  │  │  │  │  ├─ JournalHeaderDetailPage.tsx
│  │  │  │  │  │  │  ├─ JournalHeaderEditPage.tsx
│  │  │  │  │  │  │  ├─ JournalHeaderFormPage.tsx
│  │  │  │  │  │  │  ├─ JournalHeadersDeletedPage.tsx
│  │  │  │  │  │  │  ├─ JournalHeadersListPage.tsx
│  │  │  │  │  │  │  └─ JournalHeadersPage.tsx
│  │  │  │  │  │  ├─ store
│  │  │  │  │  │  │  └─ journalHeaders.store.ts
│  │  │  │  │  │  ├─ types
│  │  │  │  │  │  │  ├─ journal-header.types.ts
│  │  │  │  │  │  │  └─ journal-header.types.ts<
│  │  │  │  │  │  │     └─ parameter>
<
│  │  │  │  │  │  └─ utils
│  │  │  │  │  ├─ journal-lines
│  │  │  │  │  │  ├─ api
│  │  │  │  │  │  │  └─ journalLines.api.ts
│  │  │  │  │  │  ├─ components
│  │  │  │  │  │  │  └─ BalanceIndicator.tsx
│  │  │  │  │  │  ├─ index.ts
│  │  │  │  │  │  ├─ store
│  │  │  │  │  │  │  └─ journalLines.store.ts
│  │  │  │  │  │  └─ types
│  │  │  │  │  │     └─ journal-line.types.ts
│  │  │  │  │  └─ shared
│  │  │  │  │     ├─ AccountSelector.tsx
│  │  │  │  │     ├─ index.ts
│  │  │  │  │     ├─ journal.constants.ts
│  │  │  │  │     ├─ journal.types.ts
│  │  │  │  │     └─ journal.utils.ts
│  │  │  │  └─ ledger-entries
│  │  │  ├─ auth
│  │  │  │  ├─ index.ts
│  │  │  │  └─ store
│  │  │  │     └─ auth.store.ts
│  │  │  ├─ bank-accounts
│  │  │  │  ├─ api
│  │  │  │  │  └─ bankAccounts.api.ts
│  │  │  │  ├─ components
│  │  │  │  │  ├─ BankAccountForm.tsx
│  │  │  │  │  ├─ BankAccountTable.tsx
│  │  │  │  │  ├─ BankAccountsSection.tsx
│  │  │  │  │  └─ PrimaryBadge.tsx
│  │  │  │  ├─ index.ts
│  │  │  │  ├─ schemas
│  │  │  │  │  └─ bankAccount.schema.ts
│  │  │  │  ├─ store
│  │  │  │  │  └─ useBankAccounts.ts
│  │  │  │  └─ types.ts
│  │  │  ├─ banks
│  │  │  │  ├─ api
│  │  │  │  │  └─ banks.api.ts
│  │  │  │  ├─ components
│  │  │  │  │  ├─ BankForm.tsx
│  │  │  │  │  ├─ BankStatusBadge.tsx
│  │  │  │  │  └─ BankTable.tsx
│  │  │  │  ├─ index.ts
│  │  │  │  ├─ pages
│  │  │  │  │  ├─ BanksListPage.tsx
│  │  │  │  │  ├─ CreateBankPage.tsx
│  │  │  │  │  └─ EditBankPage.tsx
│  │  │  │  ├─ schemas
│  │  │  │  │  └─ bank.schema.ts
│  │  │  │  ├─ store
│  │  │  │  │  └─ useBanks.ts
│  │  │  │  ├─ types
│  │  │  │  └─ types.ts
│  │  │  ├─ branch_context
│  │  │  │  ├─ api
│  │  │  │  │  └─ branchContext.api.ts
│  │  │  │  ├─ components
│  │  │  │  │  ├─ BranchContextErrorBoundary
│  │  │  │  │  │  ├─ BranchContextErrorBoundary.tsx
│  │  │  │  │  │  └─ index.ts
│  │  │  │  │  ├─ BranchSelectionGuard
│  │  │  │  │  │  ├─ BranchSelectionGuard.tsx
│  │  │  │  │  │  └─ index.ts
│  │  │  │  │  ├─ BranchSwitcher
│  │  │  │  │  │  ├─ BranchSwitcher.tsx
│  │  │  │  │  │  └─ index.ts
│  │  │  │  │  └─ PermissionProvider
│  │  │  │  │     ├─ PermissionProvider.tsx
│  │  │  │  │     └─ index.ts
│  │  │  │  ├─ hooks
│  │  │  │  │  ├─ useBranchContext.ts
│  │  │  │  │  └─ usePermission.ts
│  │  │  │  ├─ index.ts
│  │  │  │  ├─ store
│  │  │  │  │  ├─ branchContext.store.ts
│  │  │  │  │  └─ permission.store.ts
│  │  │  │  └─ types
│  │  │  │     └─ index.ts
│  │  │  ├─ branches
│  │  │  │  ├─ api
│  │  │  │  │  └─ branches.api.ts
│  │  │  │  ├─ components
│  │  │  │  │  ├─ BranchForm.tsx
│  │  │  │  │  └─ BranchTable.tsx
│  │  │  │  ├─ constants.ts
│  │  │  │  ├─ index.ts
│  │  │  │  ├─ pages
│  │  │  │  │  ├─ BranchDetailPage.tsx
│  │  │  │  │  ├─ BranchesPage.tsx
│  │  │  │  │  ├─ CreateBranchPage.tsx
│  │  │  │  │  └─ EditBranchPage.tsx
│  │  │  │  ├─ store
│  │  │  │  │  └─ branches.store.ts
│  │  │  │  └─ types.ts
│  │  │  ├─ categories
│  │  │  │  ├─ api
│  │  │  │  │  └─ categories.api.ts
│  │  │  │  ├─ components
│  │  │  │  │  ├─ CategoryForm.tsx
│  │  │  │  │  ├─ CategoryTable.tsx
│  │  │  │  │  ├─ SubCategoryForm.tsx
│  │  │  │  │  └─ SubCategoryTable.tsx
│  │  │  │  ├─ index.ts
│  │  │  │  ├─ pages
│  │  │  │  │  ├─ CategoriesPage.tsx
│  │  │  │  │  ├─ CategoryDetailPage.tsx
│  │  │  │  │  ├─ CreateCategoryPage.tsx
│  │  │  │  │  ├─ CreateSubCategoryPage.tsx
│  │  │  │  │  ├─ EditCategoryPage.tsx
│  │  │  │  │  ├─ EditSubCategoryPage.tsx
│  │  │  │  │  ├─ SubCategoriesPage.tsx
│  │  │  │  │  └─ SubCategoryDetailPage.tsx
│  │  │  │  ├─ store
│  │  │  │  │  └─ categories.store.ts
│  │  │  │  └─ types.ts
│  │  │  ├─ companies
│  │  │  │  ├─ api
│  │  │  │  │  └─ companies.api.ts
│  │  │  │  ├─ components
│  │  │  │  │  ├─ CompanyForm.tsx
│  │  │  │  │  └─ CompanyTable.tsx
│  │  │  │  ├─ index.ts
│  │  │  │  ├─ pages
│  │  │  │  │  ├─ CompaniesDetailPage.tsx
│  │  │  │  │  ├─ CompaniesPage.tsx
│  │  │  │  │  ├─ CreateCompanyPage.tsx
│  │  │  │  │  └─ EditCompanyPage.tsx
│  │  │  │  ├─ store
│  │  │  │  │  └─ companies.store.ts
│  │  │  │  └─ types.ts
│  │  │  ├─ employee_branches
│  │  │  │  ├─ api
│  │  │  │  │  ├─ employeeBranches.api.ts
│  │  │  │  │  ├─ errors.ts
│  │  │  │  │  └─ types.ts
│  │  │  │  ├─ components
│  │  │  │  │  ├─ BranchAssignmentModal.tsx
│  │  │  │  │  ├─ EmployeeBranchDetailForm.tsx
│  │  │  │  │  └─ EmployeeBranchDetailTable.tsx
│  │  │  │  ├─ hooks
│  │  │  │  │  └─ useEmployeeBranchDetail.ts
│  │  │  │  ├─ index.ts
│  │  │  │  ├─ pages
│  │  │  │  │  ├─ EmployeeBranchDetailPage.tsx
│  │  │  │  │  └─ EmployeeBranchesPage.tsx
│  │  │  │  └─ store
│  │  │  │     └─ employeeBranches.store.ts
│  │  │  ├─ employees
│  │  │  │  ├─ api
│  │  │  │  │  └─ employees.api.ts
│  │  │  │  ├─ components
│  │  │  │  │  ├─ EmployeeBranchAccessTab.tsx
│  │  │  │  │  ├─ EmployeeDetailPanel.tsx
│  │  │  │  │  ├─ EmployeeForm.tsx
│  │  │  │  │  ├─ EmployeeListItem.tsx
│  │  │  │  │  └─ EmployeeTable.tsx
│  │  │  │  ├─ index.ts
│  │  │  │  ├─ pages
│  │  │  │  │  ├─ CreateEmployeePage.tsx
│  │  │  │  │  ├─ EditEmployeePage.tsx
│  │  │  │  │  ├─ EmployeeDetailPage.tsx
│  │  │  │  │  ├─ EmployeesPage.tsx
│  │  │  │  │  └─ ProfilePage.tsx
│  │  │  │  ├─ schemas
│  │  │  │  │  └─ employee.schema.ts
│  │  │  │  ├─ store
│  │  │  │  │  └─ employee.store.ts
│  │  │  │  └─ types.ts
│  │  │  ├─ jobs
│  │  │  │  ├─ api
│  │  │  │  │  └─ jobs.api.ts
│  │  │  │  ├─ components
│  │  │  │  │  └─ JobNotificationBell.tsx
│  │  │  │  ├─ index.ts
│  │  │  │  ├─ store
│  │  │  │  │  └─ jobs.store.ts
│  │  │  │  └─ types
│  │  │  │     └─ jobs.types.ts
│  │  │  ├─ metric_units
│  │  │  │  ├─ api
│  │  │  │  │  └─ metricUnits.api.ts
│  │  │  │  ├─ components
│  │  │  │  │  ├─ MetricUnitForm.tsx
│  │  │  │  │  └─ MetricUnitTable.tsx
│  │  │  │  ├─ index.ts
│  │  │  │  ├─ pages
│  │  │  │  │  ├─ CreateMetricUnitPage.tsx
│  │  │  │  │  ├─ EditMetricUnitPage.tsx
│  │  │  │  │  └─ MetricUnitsPage.tsx
│  │  │  │  ├─ store
│  │  │  │  │  └─ metricUnits.store.ts
│  │  │  │  ├─ types.ts
│  │  │  │  └─ utils
│  │  │  │     └─ errors.ts
│  │  │  ├─ payment-methods
│  │  │  │  ├─ api
│  │  │  │  │  └─ paymentMethods.api.ts
│  │  │  │  ├─ components
│  │  │  │  │  ├─ PaymentMethodFilters.tsx
│  │  │  │  │  ├─ PaymentMethodForm.tsx
│  │  │  │  │  ├─ PaymentMethodStatusBadge.tsx
│  │  │  │  │  └─ PaymentMethodTable.tsx
│  │  │  │  ├─ index.ts
│  │  │  │  ├─ pages
│  │  │  │  │  └─ PaymentMethodsPage.tsx
│  │  │  │  ├─ store
│  │  │  │  │  └─ paymentMethods.store.ts
│  │  │  │  └─ types.ts
│  │  │  ├─ payment-terms
│  │  │  │  ├─ api
│  │  │  │  │  └─ paymentTerms.api.ts
│  │  │  │  ├─ components
│  │  │  │  │  ├─ PaymentTermDeleteDialog.tsx
│  │  │  │  │  ├─ PaymentTermFilters.tsx
│  │  │  │  │  ├─ PaymentTermForm.tsx
│  │  │  │  │  ├─ PaymentTermStatusBadge.tsx
│  │  │  │  │  └─ PaymentTermTable.tsx
│  │  │  │  ├─ index.ts
│  │  │  │  ├─ pages
│  │  │  │  │  ├─ CreatePaymentTermPage.tsx
│  │  │  │  │  ├─ EditPaymentTermPage.tsx
│  │  │  │  │  ├─ PaymentTermDetailPage.tsx
│  │  │  │  │  └─ PaymentTermsPage.tsx
│  │  │  │  ├─ store
│  │  │  │  │  └─ paymentTerms.store.ts
│  │  │  │  └─ types.ts
│  │  │  ├─ permissions
│  │  │  │  ├─ api
│  │  │  │  │  └─ permissions.api.ts
│  │  │  │  ├─ index.ts
│  │  │  │  ├─ pages
│  │  │  │  │  └─ PermissionsPage.tsx
│  │  │  │  ├─ store
│  │  │  │  │  └─ permissions.store.ts
│  │  │  │  └─ types.ts
│  │  │  ├─ pos-aggregates
│  │  │  │  ├─ api
│  │  │  │  │  └─ posAggregates.api.ts
│  │  │  │  ├─ components
│  │  │  │  │  ├─ FailedTransactionDetailModal.tsx
│  │  │  │  │  ├─ FailedTransactionsTable.tsx
│  │  │  │  │  ├─ GenerateFromImportModal.tsx
│  │  │  │  │  ├─ GenerateJournalModal.tsx
│  │  │  │  │  ├─ PosAggregatesDetail.tsx
│  │  │  │  │  ├─ PosAggregatesFilters.tsx
│  │  │  │  │  ├─ PosAggregatesForm.tsx
│  │  │  │  │  ├─ PosAggregatesStatusBadge.tsx
│  │  │  │  │  ├─ PosAggregatesSummary.tsx
│  │  │  │  │  └─ PosAggregatesTable.tsx
│  │  │  │  ├─ index.ts
│  │  │  │  ├─ pages
│  │  │  │  │  ├─ CreatePosAggregatePage.tsx
│  │  │  │  │  ├─ EditPosAggregatePage.tsx
│  │  │  │  │  ├─ FailedTransactionsPage.tsx
│  │  │  │  │  ├─ PosAggregateDetailPage.tsx
│  │  │  │  │  └─ PosAggregatesPage.tsx
│  │  │  │  ├─ store
│  │  │  │  │  ├─ failedTransactions.store.ts
│  │  │  │  │  └─ posAggregates.store.ts
│  │  │  │  └─ types.ts
│  │  │  ├─ pos-imports
│  │  │  │  ├─ api
│  │  │  │  │  └─ pos-imports.api.ts
│  │  │  │  ├─ components
│  │  │  │  │  ├─ AnalysisModal.tsx
│  │  │  │  │  ├─ ConfirmModal.tsx
│  │  │  │  │  ├─ PosImportsErrorBoundary.tsx
│  │  │  │  │  ├─ PosImportsTable.tsx
│  │  │  │  │  ├─ UploadModal.tsx
│  │  │  │  │  └─ UploadProgressToast.tsx
│  │  │  │  ├─ constants
│  │  │  │  │  └─ pos-imports.constants.ts
│  │  │  │  ├─ index.ts
│  │  │  │  ├─ pages
│  │  │  │  │  ├─ PosImportDetailPage.tsx
│  │  │  │  │  └─ PosImportsPage.tsx
│  │  │  │  ├─ store
│  │  │  │  │  └─ pos-imports.store.ts
│  │  │  │  ├─ types
│  │  │  │  │  └─ pos-imports.types.ts
│  │  │  │  └─ utils
│  │  │  │     ├─ business-rules.util.ts
│  │  │  │     ├─ format.ts
│  │  │  │     └─ state-persistence.util.ts
│  │  │  ├─ pos-transactions
│  │  │  │  ├─ api
│  │  │  │  │  └─ pos-transactions.api.ts
│  │  │  │  ├─ index.ts
│  │  │  │  └─ pages
│  │  │  │     └─ PosTransactionsPage.tsx
│  │  │  ├─ pricelists
│  │  │  │  ├─ api
│  │  │  │  │  └─ pricelists.api.ts
│  │  │  │  ├─ components
│  │  │  │  │  ├─ PricelistFormContextual.tsx
│  │  │  │  │  └─ PricelistTable.tsx
│  │  │  │  ├─ constants
│  │  │  │  │  └─ pricelist.constants.ts
│  │  │  │  ├─ index.ts
│  │  │  │  ├─ pages
│  │  │  │  │  ├─ CreatePricelistFromSupplierProductPage.tsx
│  │  │  │  │  ├─ CreatePricelistPage.tsx
│  │  │  │  │  ├─ EditPricelistPage.tsx
│  │  │  │  │  ├─ PricelistDetailPage.tsx
│  │  │  │  │  ├─ PricelistsPage.tsx
│  │  │  │  │  └─ SupplierProductPricelistsPage.tsx
│  │  │  │  ├─ store
│  │  │  │  │  └─ pricelists.store.ts
│  │  │  │  ├─ types
│  │  │  │  │  └─ pricelist.types.ts
│  │  │  │  └─ utils
│  │  │  │     ├─ errorParser.ts
│  │  │  │     ├─ format.ts
│  │  │  │     └─ validation.ts
│  │  │  ├─ product-uoms
│  │  │  │  ├─ api
│  │  │  │  │  └─ productUoms.api.ts
│  │  │  │  ├─ components
│  │  │  │  │  ├─ ProductUomForm.tsx
│  │  │  │  │  └─ ProductUomTable.tsx
│  │  │  │  ├─ index.ts
│  │  │  │  ├─ pages
│  │  │  │  │  └─ ProductUomsPage.tsx
│  │  │  │  ├─ store
│  │  │  │  │  └─ productUoms.store.ts
│  │  │  │  └─ types.ts
│  │  │  ├─ products
│  │  │  │  ├─ api
│  │  │  │  │  └─ products.api.ts
│  │  │  │  ├─ components
│  │  │  │  │  ├─ ProductDeleteDialog.tsx
│  │  │  │  │  ├─ ProductForm.tsx
│  │  │  │  │  └─ ProductTable.tsx
│  │  │  │  ├─ index.ts
│  │  │  │  ├─ pages
│  │  │  │  │  ├─ CreateProductPage.tsx
│  │  │  │  │  ├─ EditProductPage.tsx
│  │  │  │  │  ├─ ProductDetailPage.tsx
│  │  │  │  │  └─ ProductsPage.tsx
│  │  │  │  ├─ store
│  │  │  │  │  └─ products.store.ts
│  │  │  │  └─ types.ts
│  │  │  ├─ supplier-products
│  │  │  │  ├─ api
│  │  │  │  │  └─ supplierProducts.api.ts
│  │  │  │  ├─ components
│  │  │  │  │  ├─ SupplierProductFilters.tsx
│  │  │  │  │  ├─ SupplierProductForm.tsx
│  │  │  │  │  └─ SupplierProductTable.tsx
│  │  │  │  ├─ constants
│  │  │  │  │  └─ supplier-product.constants.ts
│  │  │  │  ├─ hooks
│  │  │  │  │  ├─ useProductSearch.ts
│  │  │  │  │  └─ useSupplierSearch.ts
│  │  │  │  ├─ index.ts
│  │  │  │  ├─ pages
│  │  │  │  │  ├─ CreateSupplierProductPage.tsx
│  │  │  │  │  ├─ EditSupplierProductPage.tsx
│  │  │  │  │  ├─ SupplierProductDetailPage.tsx
│  │  │  │  │  └─ SupplierProductsPage.tsx
│  │  │  │  ├─ store
│  │  │  │  │  └─ supplierProducts.store.ts
│  │  │  │  ├─ types
│  │  │  │  │  └─ supplier-product.types.ts
│  │  │  │  └─ utils
│  │  │  │     ├─ errorParser.ts
│  │  │  │     └─ format.ts
│  │  │  ├─ suppliers
│  │  │  │  ├─ api
│  │  │  │  │  └─ suppliers.api.ts
│  │  │  │  ├─ components
│  │  │  │  │  ├─ SupplierFilterBar.tsx
│  │  │  │  │  ├─ SupplierForm.tsx
│  │  │  │  │  ├─ SupplierStatusBadge.tsx
│  │  │  │  │  └─ SupplierTypeBadge.tsx
│  │  │  │  ├─ constants
│  │  │  │  │  └─ supplier.constants.ts
│  │  │  │  ├─ index.ts
│  │  │  │  ├─ pages
│  │  │  │  │  ├─ CreateSupplierPage.tsx
│  │  │  │  │  ├─ EditSupplierPage.tsx
│  │  │  │  │  ├─ SupplierDetailPage.tsx
│  │  │  │  │  └─ SuppliersPage.tsx
│  │  │  │  ├─ store
│  │  │  │  │  └─ suppliers.store.ts
│  │  │  │  └─ types
│  │  │  │     └─ supplier.types.ts
│  │  │  └─ users
│  │  │     ├─ api
│  │  │     │  └─ users.api.ts
│  │  │     ├─ components
│  │  │     │  └─ UserTable.tsx
│  │  │     ├─ index.ts
│  │  │     ├─ pages
│  │  │     │  ├─ UserDetailPage.tsx
│  │  │     │  ├─ UserEditPage.tsx
│  │  │     │  └─ UsersPage.tsx
│  │  │     ├─ store
│  │  │     │  └─ users.store.ts
│  │  │     └─ types.ts
│  │  ├─ hooks
│  │  │  └─ _shared
│  │  │     ├─ useBulkSelection.ts
│  │  │     ├─ useDebounce.ts
│  │  │     ├─ useMediaQuery.ts
│  │  │     └─ useUomSearch.ts
│  │  ├─ index.css
│  │  ├─ lib
│  │  │  ├─ axios.ts
│  │  │  └─ errorParser.ts
│  │  ├─ main.tsx
│  │  ├─ pages
│  │  │  ├─ HomePage.tsx
│  │  │  └─ auth
│  │  │     ├─ ForgotPasswordPage.tsx
│  │  │     ├─ LoginPage.tsx
│  │  │     ├─ RegisterPage.tsx
│  │  │     └─ ResetPasswordPage.tsx
│  │  ├─ services
│  │  │  ├─ permissionService.ts
│  │  │  └─ userService.ts
│  │  └─ utils
│  │     ├─ audit.util.ts
│  │     ├─ dateUtils.ts
│  │     ├─ error-monitoring.util.ts
│  │     └─ performance.ts
│  ├─ tailwind.config.js
│  ├─ tsconfig.app.json
│  ├─ tsconfig.json
│  ├─ tsconfig.node.json
│  ├─ vercel.json
│  └─ vite.config.ts
├─ package-lock.json
└─ package.json

```