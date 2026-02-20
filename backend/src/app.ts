import express from "express";
import cors from "cors";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import authRoutes from "./modules/auth/auth.routes";
import employeesRoutes from "./modules/employees/employees.routes";
import companiesRoutes from "./modules/companies/companies.routes";
import branchesRoutes from "./modules/branches/branches.routes";
import categoriesRoutes from "./modules/categories/categories.routes";
import subCategoriesRoutes from "./modules/sub-categories/sub-categories.routes";
import permissionsRoutes from "./modules/permissions/permissions.routes";
import usersRoutes from "./modules/users/users.routes";
import metricUnitsRoutes from "./modules/metric-units/metricUnits.routes";
import productsRoutes from "./modules/products/products.routes";
import productUomsRoutes from "./modules/product-uoms/product-uoms.routes";
import employeeBranchesRoutes from "./modules/employee_branches/employee_branches.routes";
import paymentTermsRoutes from "./modules/payment-terms/payment-terms.routes";
import suppliersRoutes from "./modules/suppliers/suppliers.routes";
import banksRoutes from "./modules/banks/banks.routes";
import bankAccountsRoutes, {
  ownerBankAccountsRouter,
} from "./modules/bank-accounts/bankAccounts.routes";
import paymentMethodsRoutes from "./modules/payment-methods/payment-methods.routes";
import supplierProductsRoutes from "./modules/supplier-products/supplier-products.routes";
import pricelistsRoutes from "./modules/pricelists/pricelists.routes";
import chartOfAccountsRoutes from "./modules/accounting/chart-of-accounts/chart-of-accounts.routes";
import accountingPurposesRoutes from "./modules/accounting/accounting-purposes/accounting-purposes.routes";
import accountingPurposeAccountsRoutes from "./modules/accounting/accounting-purpose-accounts/accounting-purpose-accounts.routes";
import fiscalPeriodsRoutes from "./modules/accounting/fiscal-periods/fiscal-periods.routes";
import journalHeadersRoutes from "./modules/accounting/journals/journal-headers/journal-headers.routes";
import journalLinesRoutes from "./modules/accounting/journals/journal-lines/journal-lines.routes";
import posImportsRoutes from "./modules/pos-imports/pos-imports/pos-imports.routes";
import posAggregatesRoutes from "./modules/pos-imports/pos-aggregates/pos-aggregates.routes";
import posTransactionsRoutes from "./modules/pos-imports/pos-transactions/pos-transactions.routes";
import jobsRoutes from "./modules/jobs/jobs.routes";
import monitoringRoutes from "./modules/monitoring/monitoring.routes";
import bankStatementImportRoutes from "./modules/reconciliation/bank-statement-import/bank-statement-import.routes";
import { setupBankReconciliationModule } from "./modules/reconciliation/bank-reconciliation";
import { setupSettlementGroupModule } from "./modules/reconciliation/bank-settlement-group";
import { errorHandler } from "./middleware/error.middleware";
import { requestLogger } from "./middleware/request-logger.middleware";
import { generateOpenApiDocument } from "./config/openapi";

const app = express();

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
    credentials: true,
  }),
);
app.use(express.json());
app.use(requestLogger);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// OpenAPI Documentation
const openApiDocument = generateOpenApiDocument();
app.get("/openapi.json", (req, res) => {
  res.json(openApiDocument);
});
app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(openApiDocument, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Sushimas ERP API Docs",
  }),
);

// API v1 Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/employees", employeesRoutes);
app.use("/api/v1/companies", companiesRoutes);
app.use("/api/v1/branches", branchesRoutes);
app.use("/api/v1/categories", categoriesRoutes);
app.use("/api/v1/sub-categories", subCategoriesRoutes);
app.use("/api/v1/permissions", permissionsRoutes);
app.use("/api/v1/users", usersRoutes);
app.use("/api/v1/metric-units", metricUnitsRoutes);
app.use("/api/v1/products", productsRoutes);
app.use("/api/v1/product-uoms", productUomsRoutes);
app.use("/api/v1/employee-branches", employeeBranchesRoutes);
app.use("/api/v1/payment-terms", paymentTermsRoutes);
app.use("/api/v1/suppliers", suppliersRoutes);
app.use("/api/v1/banks", banksRoutes);
app.use("/api/v1/bank-accounts", bankAccountsRoutes);
app.use("/api/v1/payment-methods", paymentMethodsRoutes);
app.use("/api/v1/supplier-products", supplierProductsRoutes);
app.use("/api/v1/pricelists", pricelistsRoutes);
app.use("/api/v1/chart-of-accounts", chartOfAccountsRoutes);
app.use("/api/v1/accounting-purposes", accountingPurposesRoutes);
app.use("/api/v1/accounting-purpose-accounts", accountingPurposeAccountsRoutes);
app.use("/api/v1/accounting/fiscal-periods", fiscalPeriodsRoutes);
app.use("/api/v1/accounting/journals", journalHeadersRoutes);
app.use("/api/v1/accounting/journal-lines", journalLinesRoutes);
app.use("/api/v1/pos-imports", posImportsRoutes);
app.use("/api/v1/aggregated-transactions", posAggregatesRoutes);
app.use("/api/v1/pos-transactions", posTransactionsRoutes);
app.use("/api/v1/jobs", jobsRoutes);
app.use("/api/v1/monitoring", monitoringRoutes);
app.use("/api/v1/bank-statement-imports", bankStatementImportRoutes);
app.use("/api/v1/reconciliation/bank", setupBankReconciliationModule().router);
app.use("/api/v1/settlement-group", setupSettlementGroupModule().router);
app.use("/api/v1", ownerBankAccountsRouter);

// Error handler
app.use(errorHandler);

// Register modules on startup (silently fail if DB not available)
import { PermissionService } from "./services/permission.service";
import { logInfo } from "./config/logger";

// Initialize permission modules
const registerModules = async () => {
  try {
    await PermissionService.registerModule("jobs", "Job Queue Management");
    await PermissionService.registerModule("companies", "Company Management");
    await PermissionService.registerModule("products", "Product Management");
    await PermissionService.registerModule("categories", "Category Management");
    await PermissionService.registerModule(
      "chart_of_accounts",
      "Chart of Accounts",
    );
    await PermissionService.registerModule(
      "accounting_purposes",
      "Accounting Purposes",
    );
    await PermissionService.registerModule(
      "bank_reconciliation",
      "Bank Reconciliation",
    );
    await PermissionService.registerModule(
      "monitoring",
      "System Monitoring & Audit",
    );
    logInfo("Permission modules registered successfully");
  } catch (error) {
    // Silently fail - module will be registered via seed later
    logInfo("Permission modules will be registered via seed");
  }
};
registerModules();

export default app;
