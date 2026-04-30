import { useEffect, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/features/auth";
import {
  BranchSelectionGuard,
  BranchContextErrorBoundary,
  PermissionProvider,
} from "@/features/branch_context";
import { ToastProvider } from "./contexts/ToastContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { RequirePermission } from "./components/RequirePermission";
import Layout from "./components/layout/Layout";
import LoginPage from "./features/auth/pages/LoginPage";
import RegisterPage from "./features/auth/pages/RegisterPage";
import ForgotPasswordPage from "./features/auth/pages/ForgotPasswordPage";
import ResetPasswordPage from "./features/auth/pages/ResetPasswordPage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Lazy load features
const DashboardLayout = lazy(() =>
  import("./features/dashboard/layouts/DashboardLayout").then((m) => ({ default: m.default }))
);
const DashboardSalesPage = lazy(() =>
  import("./features/dashboard/pages/DashboardSalesPage").then((m) => ({ default: m.default }))
);
const DashboardAccountingPage = lazy(() =>
  import("./features/dashboard/pages/DashboardAccountingPage").then((m) => ({ default: m.default }))
);
const DashboardHRDPage = lazy(() =>
  import("./features/dashboard/pages/DashboardHRDPage").then((m) => ({ default: m.default }))
);
const DashboardFinancePage = lazy(() =>
  import("./features/dashboard/pages/DashboardFinancePage").then((m) => ({ default: m.default }))
);

// Lazy load features
const EmployeesPage = lazy(() =>
  import("./features/employees").then((m) => ({ default: m.EmployeesPage })),
);
const CreateEmployeePage = lazy(() =>
  import("./features/employees").then((m) => ({
    default: m.CreateEmployeePage,
  })),
);
const EmployeeDetailPage = lazy(() =>
  import("./features/employees").then((m) => ({
    default: m.EmployeeDetailPage,
  })),
);
const EditEmployeePage = lazy(() =>
  import("./features/employees").then((m) => ({ default: m.EditEmployeePage })),
);
const ProfilePage = lazy(() =>
  import("./features/employees").then((m) => ({ default: m.ProfilePage })),
);
const UsersPage = lazy(() =>
  import("./features/users").then((m) => ({ default: m.UsersPage })),
);
const UserDetailPage = lazy(() =>
  import("./features/users").then((m) => ({ default: m.UserDetailPage })),
);
const UserEditPage = lazy(() =>
  import("./features/users").then((m) => ({ default: m.UserEditPage })),
);
const CompaniesPage = lazy(() =>
  import("./features/companies").then((m) => ({ default: m.CompaniesPage })),
);
const CreateCompanyPage = lazy(() =>
  import("./features/companies").then((m) => ({
    default: m.CreateCompanyPage,
  })),
);
const CompaniesDetailPage = lazy(() =>
  import("./features/companies").then((m) => ({
    default: m.CompaniesDetailPage,
  })),
);
const EditCompanyPage = lazy(() =>
  import("./features/companies").then((m) => ({ default: m.EditCompanyPage })),
);
const BranchesPage = lazy(() =>
  import("./features/branches").then((m) => ({ default: m.BranchesPage })),
);
const CreateBranchPage = lazy(() =>
  import("./features/branches").then((m) => ({ default: m.CreateBranchPage })),
);
const EditBranchPage = lazy(() =>
  import("./features/branches").then((m) => ({ default: m.EditBranchPage })),
);
const BranchDetailPage = lazy(() =>
  import("./features/branches").then((m) => ({ default: m.BranchDetailPage })),
);
const CategoriesPage = lazy(() =>
  import("./features/categories").then((m) => ({ default: m.CategoriesPage })),
);
const CreateCategoryPage = lazy(() =>
  import("./features/categories").then((m) => ({
    default: m.CreateCategoryPage,
  })),
);
const CategoryDetailPage = lazy(() =>
  import("./features/categories").then((m) => ({
    default: m.CategoryDetailPage,
  })),
);
const EditCategoryPage = lazy(() =>
  import("./features/categories").then((m) => ({
    default: m.EditCategoryPage,
  })),
);
const SubCategoriesPage = lazy(() =>
  import("./features/categories").then((m) => ({
    default: m.SubCategoriesPage,
  })),
);
const CreateSubCategoryPage = lazy(() =>
  import("./features/categories").then((m) => ({
    default: m.CreateSubCategoryPage,
  })),
);
const SubCategoryDetailPage = lazy(() =>
  import("./features/categories").then((m) => ({
    default: m.SubCategoryDetailPage,
  })),
);
const EditSubCategoryPage = lazy(() =>
  import("./features/categories").then((m) => ({
    default: m.EditSubCategoryPage,
  })),
);
const MetricUnitsPage = lazy(() =>
  import("./features/metric_units").then((m) => ({
    default: m.MetricUnitsPage,
  })),
);
const CreateMetricUnitPage = lazy(() =>
  import("./features/metric_units").then((m) => ({
    default: m.CreateMetricUnitPage,
  })),
);
const EditMetricUnitPage = lazy(() =>
  import("./features/metric_units").then((m) => ({
    default: m.EditMetricUnitPage,
  })),
);
const PermissionsPage = lazy(() =>
  import("./features/permissions").then((m) => ({
    default: m.PermissionsPage,
  })),
);
const ProductsPage = lazy(() =>
  import("./features/products").then((m) => ({ default: m.ProductsPage })),
);
const CreateProductPage = lazy(() =>
  import("./features/products").then((m) => ({ default: m.CreateProductPage })),
);
const ProductDetailPage = lazy(() =>
  import("./features/products").then((m) => ({ default: m.ProductDetailPage })),
);
const EditProductPage = lazy(() =>
  import("./features/products").then((m) => ({ default: m.EditProductPage })),
);
const ProductUomsPage = lazy(() =>
  import("./features/product-uoms").then((m) => ({
    default: m.ProductUomsPage,
  })),
);
const EmployeeBranchesPage = lazy(() =>
  import("./features/employee_branches").then((m) => ({
    default: m.EmployeeBranchesPage,
  })),
);
const EmployeeBranchDetailPage = lazy(() =>
  import("./features/employee_branches").then((m) => ({
    default: m.EmployeeBranchDetailPage,
  })),
);
const PaymentTermsPage = lazy(() =>
  import("./features/payment-terms").then((m) => ({
    default: m.PaymentTermsPage,
  })),
);
const CreatePaymentTermPage = lazy(() =>
  import("./features/payment-terms").then((m) => ({
    default: m.CreatePaymentTermPage,
  })),
);
const PaymentTermDetailPage = lazy(() =>
  import("./features/payment-terms").then((m) => ({
    default: m.PaymentTermDetailPage,
  })),
);
const EditPaymentTermPage = lazy(() =>
  import("./features/payment-terms").then((m) => ({
    default: m.EditPaymentTermPage,
  })),
);
const PaymentMethodsPage = lazy(() =>
  import("./features/payment-methods").then((m) => ({
    default: m.PaymentMethodsPage,
  })),
);
const PosImportsPage = lazy(() =>
  import("./features/pos-imports").then((m) => ({ default: m.PosImportsPage })),
);
const PosImportDetailPage = lazy(() =>
  import("./features/pos-imports").then((m) => ({
    default: m.PosImportDetailPage,
  })),
);
const PosTransactionsPage = lazy(() =>
  import("./features/pos-transactions").then((m) => ({
    default: m.PosTransactionsPage,
  })),
);
const PosStagingPage = lazy(() =>
  import("./features/pos-staging").then((m) => ({ default: m.PosStagingPage })),
);
const SuppliersPage = lazy(() =>
  import("./features/suppliers").then((m) => ({ default: m.SuppliersPage })),
);
const CreateSupplierPage = lazy(() =>
  import("./features/suppliers").then((m) => ({
    default: m.CreateSupplierPage,
  })),
);
const EditSupplierPage = lazy(() =>
  import("./features/suppliers").then((m) => ({ default: m.EditSupplierPage })),
);
const SupplierDetailPage = lazy(() =>
  import("./features/suppliers").then((m) => ({
    default: m.SupplierDetailPage,
  })),
);
const SupplierProductsPage = lazy(() =>
  import("./features/supplier-products").then((m) => ({
    default: m.SupplierProductsPage,
  })),
);
const CreateSupplierProductPage = lazy(() =>
  import("./features/supplier-products").then((m) => ({
    default: m.CreateSupplierProductPage,
  })),
);
const EditSupplierProductPage = lazy(() =>
  import("./features/supplier-products").then((m) => ({
    default: m.EditSupplierProductPage,
  })),
);
const SupplierProductDetailPage = lazy(() =>
  import("./features/supplier-products").then((m) => ({
    default: m.SupplierProductDetailPage,
  })),
);
const PricelistsPage = lazy(() =>
  import("./features/pricelists").then((m) => ({ default: m.PricelistsPage })),
);
const CreatePricelistPage = lazy(() =>
  import("./features/pricelists").then((m) => ({
    default: m.CreatePricelistPage,
  })),
);
const SupplierProductPricelistsPage = lazy(() =>
  import("./features/pricelists").then((m) => ({
    default: m.SupplierProductPricelistsPage,
  })),
);
const CreatePricelistFromSupplierProductPage = lazy(() =>
  import("./features/pricelists").then((m) => ({
    default: m.CreatePricelistFromSupplierProductPage,
  })),
);
const EditPricelistPage = lazy(() =>
  import("./features/pricelists").then((m) => ({
    default: m.EditPricelistPage,
  })),
);
const PricelistDetailPage = lazy(() =>
  import("./features/pricelists").then((m) => ({
    default: m.PricelistDetailPage,
  })),
);
const BanksListPage = lazy(() =>
  import("./features/banks").then((m) => ({ default: m.BanksListPage })),
);
const CreateBankPage = lazy(() =>
  import("./features/banks").then((m) => ({ default: m.CreateBankPage })),
);
const EditBankPage = lazy(() =>
  import("./features/banks").then((m) => ({ default: m.EditBankPage })),
);
const ChartOfAccountsPage = lazy(
  () =>
    import("./features/accounting/chart-of-accounts/pages/ChartOfAccountsPage"),
);
const CreateChartOfAccountPage = lazy(
  () =>
    import("./features/accounting/chart-of-accounts/pages/CreateChartOfAccountPage"),
);
const EditChartOfAccountPage = lazy(
  () =>
    import("./features/accounting/chart-of-accounts/pages/EditChartOfAccountPage"),
);
const ChartOfAccountDetailPage = lazy(
  () =>
    import("./features/accounting/chart-of-accounts/pages/ChartOfAccountDetailPage"),
);
const AccountingPurposesPage = lazy(() =>
  import("./features/accounting/accounting-purposes").then((m) => ({
    default: m.AccountingPurposesPage,
  })),
);
const AccountingPurposeAccountsPage = lazy(() =>
  import("./features/accounting/accounting-purpose-accounts").then((m) => ({
    default: m.AccountingPurposeAccountsPage,
  })),
);
const FiscalPeriodsPage = lazy(() =>
  import("./features/accounting/fiscal-periods").then((m) => ({
    default: m.FiscalPeriodsPage,
  })),
);
const JournalHeadersPage = lazy(() =>
  import("./features/accounting/journals/journal-headers").then((m) => ({
    default: m.JournalHeadersPage,
  })),
);
const TrialBalancePage = lazy(() =>
  import("./features/accounting/trial-balance").then((m) => ({
    default: m.TrialBalancePage,
  }))
);
const IncomeStatementPage = lazy(() =>
  import("./features/accounting/income-statement").then((m) => ({
    default: m.IncomeStatementPage,
  }))
);
const BalanceSheetPage = lazy(() =>
  import("./features/accounting/balance-sheet").then((m) => ({
    default: m.BalanceSheetPage,
  }))
);
const PosAggregatesPage = lazy(() =>
  import("./features/pos-aggregates").then((m) => ({
    default: m.PosAggregatesPage,
  })),
);
const CreatePosAggregatePage = lazy(() =>
  import("./features/pos-aggregates").then((m) => ({
    default: m.CreatePosAggregatePage,
  })),
);
const EditPosAggregatePage = lazy(() =>
  import("./features/pos-aggregates").then((m) => ({
    default: m.EditPosAggregatePage,
  })),
);
const PosAggregateDetailPage = lazy(() =>
  import("./features/pos-aggregates").then((m) => ({
    default: m.PosAggregateDetailPage,
  })),
);
const FailedTransactionsPage = lazy(() =>
  import("./features/pos-aggregates").then((m) => ({
    default: m.FailedTransactionsPage,
  })),
);
const BankStatementImportListPage = lazy(() =>
  import("./features/bank-statement-import").then((m) => ({
    default: m.BankStatementImportListPage,
  })),
);
const BankStatementImportDetailPage = lazy(() =>
  import("./features/bank-statement-import").then((m) => ({
    default: m.BankStatementImportDetailPage,
  })),
);
const BankReconciliationPage = lazy(() =>
  import("./features/bank-reconciliation").then((m) => ({
    default: m.BankReconciliationPage,
  })),
);
// const CashCountsPage = lazy(() =>
//   import("./features/cash-counts").then((m) => ({
//     default: m.CashCountsPage,
//   })),
// );
// const CashDepositsPage = lazy(() =>
//   import("./features/cash-counts/pages/CashDepositsPage").then((m) => ({
//     default: m.CashDepositsPage,
//   })),
// );

const CashCountsManagementPage = lazy(() =>
  import('./features/cash-counts').then(m => ({
    default: m.CashCountsManagementPage,
  })),
);

const SettlementGroupsPage = lazy(() =>
  import("./features/bank-reconciliation/settlement-groups").then((m) => ({
    default: m.SettlementGroupsPage,
  })),
);
const SettlementGroupDetailPage = lazy(() =>
  import("./features/bank-reconciliation/settlement-groups/pages/SettlementGroupDetailPage").then(
    (m) => ({
      default: m.default,
    }),
  ),
);
const MonitoringPage = lazy(() =>
  import("./features/monitoring").then((m) => ({ default: m.MonitoringPage })),
);
const FeeDiscrepancyReviewPage = lazy(() =>
  import("./features/bank-reconciliation/fee-discrepancy-review").then((m) => ({ default: m.FeeDiscrepancyReviewPage })),
);

const PosSyncAggregatesPage = lazy(() =>
  import('./features/pos-sync-aggregates').then(m => ({ default: m.PosSyncAggregatesPage }))
)
const PosSyncAggregateDetailPage = lazy(() =>
  import('./features/pos-sync-aggregates').then(m => ({ default: m.PosSyncAggregateDetailPage }))
)
const CashFlowPage = lazy(() =>
  import('./features/cash-flow').then(m => ({ default: m.CashFlowPage }))
)
const CashFlowSettingsPage = lazy(() =>
  import('./features/cash-flow').then(m => ({ default: m.CashFlowSettingsPage }))
)
const ExpenseCategorizationPage = lazy(() =>
  import('./features/expense-categorization/pages/ExpenseCategorizationPage')
)

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
);


function App() {
  const { checkAuth, isInitialized } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <BranchContextErrorBoundary>
            <BrowserRouter>
              <Routes>
                {/* Auth Routes - No Layout */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route
                  path="/forgot-password"
                  element={<ForgotPasswordPage />}
                />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route
                  path="/reset-password "
                  element={<ResetPasswordPage />}
                />
                <Route
                  path="/reset-password%20"
                  element={<ResetPasswordPage />}
                />

                {/* Protected Routes - With Layout */}
                <Route
                  path="/"
                  element={
                    <BranchSelectionGuard>
                      <PermissionProvider>
                        <Layout />
                      </PermissionProvider>
                    </BranchSelectionGuard>
                  }
                >
                  <Route index element={<Navigate to="/dashboard/sales" replace />} /> 
                  <Route path="dashboard" element={
                    <RequirePermission>
                      <Suspense fallback={<LoadingFallback />}>
                        <DashboardLayout />
                      </Suspense>
                    </RequirePermission>
                  }>
                    <Route index element={<Navigate to="/dashboard/sales" replace />} />
                    <Route path="sales" element={<Suspense fallback={<LoadingFallback />}><DashboardSalesPage /></Suspense>} />
                    <Route path="accounting" element={<Suspense fallback={<LoadingFallback />}><DashboardAccountingPage /></Suspense>} />
                    <Route path="hrd" element={<Suspense fallback={<LoadingFallback />}><DashboardHRDPage /></Suspense>} />
                    <Route path="finance" element={<Suspense fallback={<LoadingFallback />}><DashboardFinancePage /></Suspense>} />
                  </Route>
                  <Route
                    path="profile"
                    element={
                      <RequirePermission>
                        <Suspense fallback={<LoadingFallback />}>
                          <ProfilePage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="employees"
                    element={
                      <RequirePermission module="employees">
                        <Suspense fallback={<LoadingFallback />}>
                          <EmployeesPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="employees/create"
                    element={
                      <RequirePermission module="employees">
                        <Suspense fallback={<LoadingFallback />}>
                          <CreateEmployeePage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="employees/:id"
                    element={
                      <RequirePermission module="employees">
                        <Suspense fallback={<LoadingFallback />}>
                          <EmployeeDetailPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="employees/edit/:id"
                    element={
                      <RequirePermission module="employees">
                        <Suspense fallback={<LoadingFallback />}>
                          <EditEmployeePage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="companies"
                    element={
                      <RequirePermission module="companies">
                        <Suspense fallback={<LoadingFallback />}>
                          <CompaniesPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="companies/new"
                    element={
                      <RequirePermission module="companies">
                        <Suspense fallback={<LoadingFallback />}>
                          <CreateCompanyPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="companies/:id"
                    element={
                      <RequirePermission module="companies">
                        <Suspense fallback={<LoadingFallback />}>
                          <CompaniesDetailPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="companies/:id/edit"
                    element={
                      <RequirePermission module="companies">
                        <Suspense fallback={<LoadingFallback />}>
                          <EditCompanyPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="branches"
                    element={
                      <RequirePermission module="branches">
                        <Suspense fallback={<LoadingFallback />}>
                          <BranchesPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="branches/new"
                    element={
                      <RequirePermission module="branches">
                        <Suspense fallback={<LoadingFallback />}>
                          <CreateBranchPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="branches/:id"
                    element={
                      <RequirePermission module="branches">
                        <Suspense fallback={<LoadingFallback />}>
                          <BranchDetailPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="branches/:id/edit"
                    element={
                      <RequirePermission module="branches">
                        <Suspense fallback={<LoadingFallback />}>
                          <EditBranchPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="bank-statement-import/:id"
                    element={
                      <RequirePermission module="bank_statement_imports">
                        <Suspense fallback={<LoadingFallback />}>
                          <BankStatementImportDetailPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="permissions"
                    element={
                      <RequirePermission module="permissions">
                        <Suspense fallback={<LoadingFallback />}>
                          <PermissionsPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="monitoring"
                    element={
                      <RequirePermission module="monitoring">
                        <Suspense fallback={<LoadingFallback />}>
                          <MonitoringPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="users"
                    element={
                      <RequirePermission module="users">
                        <Suspense fallback={<LoadingFallback />}>
                          <UsersPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="users/:id"
                    element={
                      <RequirePermission module="users">
                        <Suspense fallback={<LoadingFallback />}>
                          <UserDetailPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="users/edit/:id"
                    element={
                      <RequirePermission module="users">
                        <Suspense fallback={<LoadingFallback />}>
                          <UserEditPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="categories"
                    element={
                      <RequirePermission module="categories">
                        <Suspense fallback={<LoadingFallback />}>
                          <CategoriesPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="categories/new"
                    element={
                      <RequirePermission module="categories">
                        <Suspense fallback={<LoadingFallback />}>
                          <CreateCategoryPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="categories/:id"
                    element={
                      <RequirePermission module="categories">
                        <Suspense fallback={<LoadingFallback />}>
                          <CategoryDetailPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="categories/:id/edit"
                    element={
                      <RequirePermission module="categories">
                        <Suspense fallback={<LoadingFallback />}>
                          <EditCategoryPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="sub-categories"
                    element={
                      <RequirePermission module="sub_categories">
                        <Suspense fallback={<LoadingFallback />}>
                          <SubCategoriesPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="sub-categories/new"
                    element={
                      <RequirePermission module="sub_categories">
                        <Suspense fallback={<LoadingFallback />}>
                          <CreateSubCategoryPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="sub-categories/:id"
                    element={
                      <RequirePermission module="sub_categories">
                        <Suspense fallback={<LoadingFallback />}>
                          <SubCategoryDetailPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="sub-categories/:id/edit"
                    element={
                      <RequirePermission module="sub_categories">
                        <Suspense fallback={<LoadingFallback />}>
                          <EditSubCategoryPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="metric-units"
                    element={
                      <RequirePermission module="metric_units">
                        <Suspense fallback={<LoadingFallback />}>
                          <MetricUnitsPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="metric-units/new"
                    element={
                      <RequirePermission module="metric_units">
                        <Suspense fallback={<LoadingFallback />}>
                          <CreateMetricUnitPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="metric-units/:id/edit"
                    element={
                      <RequirePermission module="metric_units">
                        <Suspense fallback={<LoadingFallback />}>
                          <EditMetricUnitPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="products"
                    element={
                      <RequirePermission module="products">
                        <Suspense fallback={<LoadingFallback />}>
                          <ProductsPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="products/create"
                    element={
                      <RequirePermission module="products">
                        <Suspense fallback={<LoadingFallback />}>
                          <CreateProductPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="products/:id"
                    element={
                      <RequirePermission module="products">
                        <Suspense fallback={<LoadingFallback />}>
                          <ProductDetailPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="products/:id/edit"
                    element={
                      <RequirePermission module="products">
                        <Suspense fallback={<LoadingFallback />}>
                          <EditProductPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="products/:productId/uoms"
                    element={
                      <RequirePermission module="products">
                        <Suspense fallback={<LoadingFallback />}>
                          <ProductUomsPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="employee-branches"
                    element={
                      <RequirePermission module="employee_branches">
                        <Suspense fallback={<LoadingFallback />}>
                          <EmployeeBranchesPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="employees/:employeeId/branches"
                    element={
                      <RequirePermission module="employee_branches">
                        <Suspense fallback={<LoadingFallback />}>
                          <EmployeeBranchDetailPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="payment-terms"
                    element={
                      <RequirePermission module="payment_terms">
                        <Suspense fallback={<LoadingFallback />}>
                          <PaymentTermsPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="payment-terms/new"
                    element={
                      <RequirePermission module="payment_terms">
                        <Suspense fallback={<LoadingFallback />}>
                          <CreatePaymentTermPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="payment-terms/:id"
                    element={
                      <RequirePermission module="payment_terms">
                        <Suspense fallback={<LoadingFallback />}>
                          <PaymentTermDetailPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="payment-terms/:id/edit"
                    element={
                      <RequirePermission module="payment_terms">
                        <Suspense fallback={<LoadingFallback />}>
                          <EditPaymentTermPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="payment-methods"
                    element={
                      <RequirePermission module="payment_methods">
                        <Suspense fallback={<LoadingFallback />}>
                          <PaymentMethodsPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="pos-imports"
                    element={
                      <RequirePermission module="pos_imports">
                        <Suspense fallback={<LoadingFallback />}>
                          <PosImportsPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="pos-imports/:id"
                    element={
                      <RequirePermission module="pos_imports">
                        <Suspense fallback={<LoadingFallback />}>
                          <PosImportDetailPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="pos-staging"
                    element={
                      <RequirePermission module="pos_imports">
                        <Suspense fallback={<LoadingFallback />}>
                          <PosStagingPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="pos-transactions"
                    element={
                      <RequirePermission module="pos_imports">
                        <Suspense fallback={<LoadingFallback />}>
                          <PosTransactionsPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="suppliers"
                    element={
                      <RequirePermission module="suppliers">
                        <Suspense fallback={<LoadingFallback />}>
                          <SuppliersPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="suppliers/create"
                    element={
                      <RequirePermission module="suppliers">
                        <Suspense fallback={<LoadingFallback />}>
                          <CreateSupplierPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="suppliers/:id"
                    element={
                      <RequirePermission module="suppliers">
                        <Suspense fallback={<LoadingFallback />}>
                          <SupplierDetailPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="suppliers/:id/edit"
                    element={
                      <RequirePermission module="suppliers">
                        <Suspense fallback={<LoadingFallback />}>
                          <EditSupplierPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="pricelists"
                    element={
                      <RequirePermission module="pricelists">
                        <Suspense fallback={<LoadingFallback />}>
                          <PricelistsPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="pricelists/new"
                    element={
                      <RequirePermission module="pricelists">
                        <Suspense fallback={<LoadingFallback />}>
                          <CreatePricelistPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="pricelists/:id"
                    element={
                      <RequirePermission module="pricelists">
                        <Suspense fallback={<LoadingFallback />}>
                          <PricelistDetailPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="pricelists/:id/edit"
                    element={
                      <RequirePermission module="pricelists">
                        <Suspense fallback={<LoadingFallback />}>
                          <EditPricelistPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="supplier-products"
                    element={
                      <RequirePermission module="supplier_products">
                        <Suspense fallback={<LoadingFallback />}>
                          <SupplierProductsPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="supplier-products/create"
                    element={
                      <RequirePermission module="supplier_products">
                        <Suspense fallback={<LoadingFallback />}>
                          <CreateSupplierProductPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="supplier-products/:id"
                    element={
                      <RequirePermission module="supplier_products">
                        <Suspense fallback={<LoadingFallback />}>
                          <SupplierProductDetailPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="supplier-products/:id/edit"
                    element={
                      <RequirePermission module="supplier_products">
                        <Suspense fallback={<LoadingFallback />}>
                          <EditSupplierProductPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="supplier-products/:supplierProductId/pricelists"
                    element={
                      <RequirePermission module="supplier_products">
                        <Suspense fallback={<LoadingFallback />}>
                          <SupplierProductPricelistsPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="supplier-products/:supplierProductId/pricelists/create"
                    element={
                      <RequirePermission module="supplier_products">
                        <Suspense fallback={<LoadingFallback />}>
                          <CreatePricelistFromSupplierProductPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="supplier-products/:supplierProductId/pricelists/:pricelistId"
                    element={
                      <RequirePermission module="supplier_products">
                        <Suspense fallback={<LoadingFallback />}>
                          <PricelistDetailPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="supplier-products/:supplierProductId/pricelists/:pricelistId/edit"
                    element={
                      <RequirePermission module="supplier_products">
                        <Suspense fallback={<LoadingFallback />}>
                          <EditPricelistPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="settings/banks"
                    element={
                      <RequirePermission module="banks">
                        <Suspense fallback={<LoadingFallback />}>
                          <BanksListPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="settings/banks/create"
                    element={
                      <RequirePermission module="banks">
                        <Suspense fallback={<LoadingFallback />}>
                          <CreateBankPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="settings/banks/:id/edit"
                    element={
                      <RequirePermission module="banks">
                        <Suspense fallback={<LoadingFallback />}>
                          <EditBankPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="chart-of-accounts"
                    element={
                      <RequirePermission module="chart_of_accounts">
                        <Suspense fallback={<LoadingFallback />}>
                          <ChartOfAccountsPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="chart-of-accounts/new"
                    element={
                      <RequirePermission module="chart_of_accounts">
                        <Suspense fallback={<LoadingFallback />}>
                          <CreateChartOfAccountPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="chart-of-accounts/:id"
                    element={
                      <RequirePermission module="chart_of_accounts">
                        <Suspense fallback={<LoadingFallback />}>
                          <ChartOfAccountDetailPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="chart-of-accounts/:id/edit"
                    element={
                      <RequirePermission module="chart_of_accounts">
                        <Suspense fallback={<LoadingFallback />}>
                          <EditChartOfAccountPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="accounting-purposes"
                    element={
                      <RequirePermission module="accounting_purposes">
                        <Suspense fallback={<LoadingFallback />}>
                          <AccountingPurposesPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="accounting-purposes/:id"
                    element={
                      <RequirePermission module="accounting_purposes">
                        <Suspense fallback={<LoadingFallback />}>
                          <AccountingPurposesPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="accounting-purpose-accounts/*"
                    element={
                      <RequirePermission module="accounting_purpose_accounts">
                        <Suspense fallback={<LoadingFallback />}>
                          <AccountingPurposeAccountsPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="accounting/fiscal-periods/*"
                    element={
                      <RequirePermission module="fiscal_periods">
                        <Suspense fallback={<LoadingFallback />}>
                          <FiscalPeriodsPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="accounting/journals/*"
                    element={
                      <RequirePermission module="journals">
                        <Suspense fallback={<LoadingFallback />}>
                          <JournalHeadersPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="accounting/trial-balance"
                    element={
                      <RequirePermission module="trial_balance">
                        <Suspense fallback={<LoadingFallback />}>
                          <TrialBalancePage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="accounting/income-statement"
                    element={
                      <RequirePermission module="income_statement">
                        <Suspense fallback={<LoadingFallback />}>
                          <IncomeStatementPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="accounting/balance-sheet"
                    element={
                      <RequirePermission module="balance_sheet">
                        <Suspense fallback={<LoadingFallback />}>
                          <BalanceSheetPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route path="pos-sync-aggregates" element={
                    <RequirePermission module="pos_sync_aggregates"><Suspense fallback={<LoadingFallback />}><PosSyncAggregatesPage /></Suspense></RequirePermission>
                  } />
                  <Route path="pos-sync-aggregates/:id" element={
                    <RequirePermission module="pos_sync_aggregates"><Suspense fallback={<LoadingFallback />}><PosSyncAggregateDetailPage /></Suspense></RequirePermission>
                  } />
                  <Route
                    path="pos-aggregates/create"
                    element={
                      <RequirePermission module="pos_aggregates">
                        <Suspense fallback={<LoadingFallback />}>
                          <CreatePosAggregatePage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="pos-aggregates/:id"
                    element={
                      <RequirePermission module="pos_aggregates">
                        <Suspense fallback={<LoadingFallback />}>
                          <PosAggregateDetailPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="pos-aggregates/:id/edit"
                    element={
                      <RequirePermission module="pos_aggregates">
                        <Suspense fallback={<LoadingFallback />}>
                          <EditPosAggregatePage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="pos-aggregates"
                    element={
                      <RequirePermission module="pos_aggregates">
                        <Suspense fallback={<LoadingFallback />}>
                          <PosAggregatesPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="pos-aggregates/failed-transactions"
                    element={
                      <RequirePermission module="pos_aggregates">
                        <Suspense fallback={<LoadingFallback />}>
                          <FailedTransactionsPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="bank-statement-import"
                    element={
                      <RequirePermission module="bank_statement_imports">
                        <Suspense fallback={<LoadingFallback />}>
                          <BankStatementImportListPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="bank-statement-import/:id"
                    element={
                      <RequirePermission module="bank_statement_imports">
                        <Suspense fallback={<LoadingFallback />}>
                          <BankStatementImportDetailPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="bank-reconciliation"
                    element={
                      <RequirePermission module="bank_reconciliation">
                        <Suspense fallback={<LoadingFallback />}>
                          <BankReconciliationPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="bank-reconciliation/settlement-groups"
                    element={
                      <RequirePermission module="bank_reconciliation">
                        <Suspense fallback={<LoadingFallback />}>
                          <SettlementGroupsPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="bank-reconciliation/settlement-groups/:id"
                    element={
                      <RequirePermission module="bank_reconciliation">
                        <Suspense fallback={<LoadingFallback />}>
                          <SettlementGroupDetailPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="bank-reconciliation/fee-discrepancy-review"
                    element={
                      <RequirePermission module="fee_discrepancy_review">
                        <Suspense fallback={<LoadingFallback />}>
                          <FeeDiscrepancyReviewPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="cash-counts"
                    element={
                      <RequirePermission module="cash_counts">
                        <Suspense fallback={<LoadingFallback />}>
                          <CashCountsManagementPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="cash-flow"
                    element={
                      <RequirePermission module="cash_flow">
                        <Suspense fallback={<LoadingFallback />}>
                          <CashFlowPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="cash-flow/settings"
                    element={
                      <RequirePermission module="cash_flow">
                        <Suspense fallback={<LoadingFallback />}>
                          <CashFlowSettingsPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="expense-categorization"
                    element={
                      <RequirePermission module="cash_flow">
                        <Suspense fallback={<LoadingFallback />}>
                          <ExpenseCategorizationPage />
                        </Suspense>
                      </RequirePermission>
                    }
                  />
                </Route>
              </Routes>
            </BrowserRouter>
          </BranchContextErrorBoundary>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
