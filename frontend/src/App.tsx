import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/features/auth'
import { BranchSelectionGuard, BranchContextErrorBoundary, PermissionProvider } from '@/features/branch_context'
import { ToastProvider } from './contexts/ToastContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import Layout from './components/layout/Layout'
import HomePage from './pages/HomePage'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'

// Lazy load features
const EmployeesPage = lazy(() => import('./features/employees').then(m => ({ default: m.EmployeesPage })))
const CreateEmployeePage = lazy(() => import('./features/employees').then(m => ({ default: m.CreateEmployeePage })))
const EmployeeDetailPage = lazy(() => import('./features/employees').then(m => ({ default: m.EmployeeDetailPage })))
const EditEmployeePage = lazy(() => import('./features/employees').then(m => ({ default: m.EditEmployeePage })))
const ProfilePage = lazy(() => import('./features/employees').then(m => ({ default: m.ProfilePage })))
const UsersPage = lazy(() => import('./features/users').then(m => ({ default: m.UsersPage })))
const UserDetailPage = lazy(() => import('./features/users').then(m => ({ default: m.UserDetailPage })))
const UserEditPage = lazy(() => import('./features/users').then(m => ({ default: m.UserEditPage })))
const CompaniesPage = lazy(() => import('./features/companies').then(m => ({ default: m.CompaniesPage })))
const CreateCompanyPage = lazy(() => import('./features/companies').then(m => ({ default: m.CreateCompanyPage })))
const CompaniesDetailPage = lazy(() => import('./features/companies').then(m => ({ default: m.CompaniesDetailPage })))
const EditCompanyPage = lazy(() => import('./features/companies').then(m => ({ default: m.EditCompanyPage })))
const BranchesPage = lazy(() => import('./features/branches').then(m => ({ default: m.BranchesPage })))
const CreateBranchPage = lazy(() => import('./features/branches').then(m => ({ default: m.CreateBranchPage })))
const EditBranchPage = lazy(() => import('./features/branches').then(m => ({ default: m.EditBranchPage })))
const BranchDetailPage = lazy(() => import('./features/branches').then(m => ({ default: m.BranchDetailPage })))
const CategoriesPage = lazy(() => import('./features/categories').then(m => ({ default: m.CategoriesPage })))
const CreateCategoryPage = lazy(() => import('./features/categories').then(m => ({ default: m.CreateCategoryPage })))
const CategoryDetailPage = lazy(() => import('./features/categories').then(m => ({ default: m.CategoryDetailPage })))
const EditCategoryPage = lazy(() => import('./features/categories').then(m => ({ default: m.EditCategoryPage })))
const SubCategoriesPage = lazy(() => import('./features/categories').then(m => ({ default: m.SubCategoriesPage })))
const CreateSubCategoryPage = lazy(() => import('./features/categories').then(m => ({ default: m.CreateSubCategoryPage })))
const SubCategoryDetailPage = lazy(() => import('./features/categories').then(m => ({ default: m.SubCategoryDetailPage })))
const EditSubCategoryPage = lazy(() => import('./features/categories').then(m => ({ default: m.EditSubCategoryPage })))
const MetricUnitsPage = lazy(() => import('./features/metric_units').then(m => ({ default: m.MetricUnitsPage })))
const CreateMetricUnitPage = lazy(() => import('./features/metric_units').then(m => ({ default: m.CreateMetricUnitPage })))
const EditMetricUnitPage = lazy(() => import('./features/metric_units').then(m => ({ default: m.EditMetricUnitPage })))
const PermissionsPage = lazy(() => import('./features/permissions').then(m => ({ default: m.PermissionsPage })))
const ProductsPage = lazy(() => import('./features/products').then(m => ({ default: m.ProductsPage })))
const CreateProductPage = lazy(() => import('./features/products').then(m => ({ default: m.CreateProductPage })))
const ProductDetailPage = lazy(() => import('./features/products').then(m => ({ default: m.ProductDetailPage })))
const EditProductPage = lazy(() => import('./features/products').then(m => ({ default: m.EditProductPage })))
const ProductUomsPage = lazy(() => import('./features/product-uoms').then(m => ({ default: m.ProductUomsPage })))
const EmployeeBranchesPage = lazy(() => import('./features/employee_branches').then(m => ({ default: m.EmployeeBranchesPage })))
const EmployeeBranchDetailPage = lazy(() => import('./features/employee_branches').then(m => ({ default: m.EmployeeBranchDetailPage })))
const PaymentTermsPage = lazy(() => import('./features/payment-terms').then(m => ({ default: m.PaymentTermsPage })))
const CreatePaymentTermPage = lazy(() => import('./features/payment-terms').then(m => ({ default: m.CreatePaymentTermPage })))
const PaymentTermDetailPage = lazy(() => import('./features/payment-terms').then(m => ({ default: m.PaymentTermDetailPage })))
const EditPaymentTermPage = lazy(() => import('./features/payment-terms').then(m => ({ default: m.EditPaymentTermPage })))
const SuppliersPage = lazy(() => import('./features/suppliers').then(m => ({ default: m.SuppliersPage })))
const CreateSupplierPage = lazy(() => import('./features/suppliers').then(m => ({ default: m.CreateSupplierPage })))
const EditSupplierPage = lazy(() => import('./features/suppliers').then(m => ({ default: m.EditSupplierPage })))
const SupplierDetailPage = lazy(() => import('./features/suppliers').then(m => ({ default: m.SupplierDetailPage })))
const SupplierProductsPage = lazy(() => import('./features/supplier-products').then(m => ({ default: m.SupplierProductsPage })))
const CreateSupplierProductPage = lazy(() => import('./features/supplier-products').then(m => ({ default: m.CreateSupplierProductPage })))
const EditSupplierProductPage = lazy(() => import('./features/supplier-products').then(m => ({ default: m.EditSupplierProductPage })))
const SupplierProductDetailPage = lazy(() => import('./features/supplier-products').then(m => ({ default: m.SupplierProductDetailPage })))
const PricelistsPage = lazy(() => import('./features/pricelists').then(m => ({ default: m.PricelistsPage })))
const CreatePricelistPage = lazy(() => import('./features/pricelists').then(m => ({ default: m.CreatePricelistPage })))
const SupplierProductPricelistsPage = lazy(() => import('./features/pricelists').then(m => ({ default: m.SupplierProductPricelistsPage })))
const CreatePricelistFromSupplierProductPage = lazy(() => import('./features/pricelists').then(m => ({ default: m.CreatePricelistFromSupplierProductPage })))
const EditPricelistPage = lazy(() => import('./features/pricelists').then(m => ({ default: m.EditPricelistPage })))
const PricelistDetailPage = lazy(() => import('./features/pricelists').then(m => ({ default: m.PricelistDetailPage })))
const BanksListPage = lazy(() => import('./features/banks').then(m => ({ default: m.BanksListPage })))
const CreateBankPage = lazy(() => import('./features/banks').then(m => ({ default: m.CreateBankPage })))
const EditBankPage = lazy(() => import('./features/banks').then(m => ({ default: m.EditBankPage })))
const ChartOfAccountsPage = lazy(() => import('./features/accounting/chart-of-accounts/pages/ChartOfAccountsPage'))
const CreateChartOfAccountPage = lazy(() => import('./features/accounting/chart-of-accounts/pages/CreateChartOfAccountPage'))
const EditChartOfAccountPage = lazy(() => import('./features/accounting/chart-of-accounts/pages/EditChartOfAccountPage'))
const ChartOfAccountDetailPage = lazy(() => import('./features/accounting/chart-of-accounts/pages/ChartOfAccountDetailPage'))
const AccountingPurposesPage = lazy(() => import('./features/accounting/accounting-purposes').then(m => ({ default: m.AccountingPurposesPage })))
const AccountingPurposeAccountsPage = lazy(() => import('./features/accounting/accounting-purpose-accounts').then(m => ({ default: m.AccountingPurposeAccountsPage })))
const FiscalPeriodsPage = lazy(() => import('./features/accounting/fiscal-periods').then(m => ({ default: m.FiscalPeriodsPage })))

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
)

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, isInitialized } = useAuthStore()
  
  if (!isInitialized) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }
  
  return token ? children : <Navigate to="/login" />
}

function App() {
  const { checkAuth, isInitialized } = useAuthStore()
  
  useEffect(() => {
    checkAuth()
  }, [checkAuth])
  
  if (!isInitialized) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }
  
  return (
    <ErrorBoundary>
      <ToastProvider>
        <BranchContextErrorBoundary>
          <BrowserRouter>
            <Routes>
              {/* Auth Routes - No Layout */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              {/* Protected Routes - With Layout */}
              <Route path="/" element={
                <BranchSelectionGuard>
                  <PermissionProvider>
                    <Layout />
                  </PermissionProvider>
                </BranchSelectionGuard>
              }>
          <Route index element={<HomePage />} />
          <Route path="profile" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><ProfilePage /></Suspense></ProtectedRoute>} />
          <Route path="employees" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><EmployeesPage /></Suspense></ProtectedRoute>} />
          <Route path="employees/create" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><CreateEmployeePage /></Suspense></ProtectedRoute>} />
          <Route path="employees/:id" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><EmployeeDetailPage /></Suspense></ProtectedRoute>} />
          <Route path="employees/edit/:id" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><EditEmployeePage /></Suspense></ProtectedRoute>} />
          <Route path="companies" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><CompaniesPage /></Suspense></ProtectedRoute>} />
          <Route path="companies/new" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><CreateCompanyPage /></Suspense></ProtectedRoute>} />
          <Route path="companies/:id" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><CompaniesDetailPage /></Suspense></ProtectedRoute>} />
          <Route path="companies/:id/edit" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><EditCompanyPage /></Suspense></ProtectedRoute>} />
          <Route path="branches" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><BranchesPage /></Suspense></ProtectedRoute>} />
          <Route path="branches/new" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><CreateBranchPage /></Suspense></ProtectedRoute>} />
          <Route path="branches/:id" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><BranchDetailPage /></Suspense></ProtectedRoute>} />
          <Route path="branches/:id/edit" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><EditBranchPage /></Suspense></ProtectedRoute>} />
          <Route path="permissions" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><PermissionsPage /></Suspense></ProtectedRoute>} />
          <Route path="users" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><UsersPage /></Suspense></ProtectedRoute>} />
          <Route path="users/:id" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><UserDetailPage /></Suspense></ProtectedRoute>} />
          <Route path="users/edit/:id" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><UserEditPage /></Suspense></ProtectedRoute>} />
          <Route path="categories" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><CategoriesPage /></Suspense></ProtectedRoute>} />
          <Route path="categories/new" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><CreateCategoryPage /></Suspense></ProtectedRoute>} />
          <Route path="categories/:id" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><CategoryDetailPage /></Suspense></ProtectedRoute>} />
          <Route path="categories/:id/edit" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><EditCategoryPage /></Suspense></ProtectedRoute>} />
          <Route path="sub-categories" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><SubCategoriesPage /></Suspense></ProtectedRoute>} />
          <Route path="sub-categories/new" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><CreateSubCategoryPage /></Suspense></ProtectedRoute>} />
          <Route path="sub-categories/:id" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><SubCategoryDetailPage /></Suspense></ProtectedRoute>} />
          <Route path="sub-categories/:id/edit" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><EditSubCategoryPage /></Suspense></ProtectedRoute>} />
          <Route path="metric-units" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><MetricUnitsPage /></Suspense></ProtectedRoute>} />
          <Route path="metric-units/new" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><CreateMetricUnitPage /></Suspense></ProtectedRoute>} />
          <Route path="metric-units/:id/edit" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><EditMetricUnitPage /></Suspense></ProtectedRoute>} />
          <Route path="products" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><ProductsPage /></Suspense></ProtectedRoute>} />
          <Route path="products/create" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><CreateProductPage /></Suspense></ProtectedRoute>} />
          <Route path="products/:id" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><ProductDetailPage /></Suspense></ProtectedRoute>} />
          <Route path="products/:id/edit" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><EditProductPage /></Suspense></ProtectedRoute>} />
          <Route path="products/:productId/uoms" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><ProductUomsPage /></Suspense></ProtectedRoute>} />
          <Route path="employee-branches" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><EmployeeBranchesPage /></Suspense></ProtectedRoute>} />
          <Route path="employees/:employeeId/branches" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><EmployeeBranchDetailPage /></Suspense></ProtectedRoute>} />
          <Route path="payment-terms" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><PaymentTermsPage /></Suspense></ProtectedRoute>} />
          <Route path="payment-terms/new" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><CreatePaymentTermPage /></Suspense></ProtectedRoute>} />
          <Route path="payment-terms/:id" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><PaymentTermDetailPage /></Suspense></ProtectedRoute>} />
          <Route path="payment-terms/:id/edit" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><EditPaymentTermPage /></Suspense></ProtectedRoute>} />
          <Route path="suppliers" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><SuppliersPage /></Suspense></ProtectedRoute>} />
          <Route path="suppliers/create" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><CreateSupplierPage /></Suspense></ProtectedRoute>} />
          <Route path="suppliers/:id" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><SupplierDetailPage /></Suspense></ProtectedRoute>} />
          <Route path="suppliers/:id/edit" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><EditSupplierPage /></Suspense></ProtectedRoute>} />
          <Route path="pricelists" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><PricelistsPage /></Suspense></ProtectedRoute>} />
          <Route path="pricelists/new" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><CreatePricelistPage /></Suspense></ProtectedRoute>} />
          <Route path="pricelists/:id" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><PricelistDetailPage /></Suspense></ProtectedRoute>} />
          <Route path="pricelists/:id/edit" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><EditPricelistPage /></Suspense></ProtectedRoute>} />
          <Route path="supplier-products" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><SupplierProductsPage /></Suspense></ProtectedRoute>} />
          <Route path="supplier-products/create" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><CreateSupplierProductPage /></Suspense></ProtectedRoute>} />
          <Route path="supplier-products/:id" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><SupplierProductDetailPage /></Suspense></ProtectedRoute>} />
          <Route path="supplier-products/:id/edit" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><EditSupplierProductPage /></Suspense></ProtectedRoute>} />
          <Route path="supplier-products/:supplierProductId/pricelists" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><SupplierProductPricelistsPage /></Suspense></ProtectedRoute>} />
          <Route path="supplier-products/:supplierProductId/pricelists/create" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><CreatePricelistFromSupplierProductPage /></Suspense></ProtectedRoute>} />
          <Route path="supplier-products/:supplierProductId/pricelists/:pricelistId" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><PricelistDetailPage /></Suspense></ProtectedRoute>} />
          <Route path="supplier-products/:supplierProductId/pricelists/:pricelistId/edit" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><EditPricelistPage /></Suspense></ProtectedRoute>} />
          <Route path="settings/banks" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><BanksListPage /></Suspense></ProtectedRoute>} />
          <Route path="settings/banks/create" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><CreateBankPage /></Suspense></ProtectedRoute>} />
          <Route path="settings/banks/:id/edit" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><EditBankPage /></Suspense></ProtectedRoute>} />
          <Route path="chart-of-accounts" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><ChartOfAccountsPage /></Suspense></ProtectedRoute>} />
          <Route path="chart-of-accounts/new" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><CreateChartOfAccountPage /></Suspense></ProtectedRoute>} />
          <Route path="chart-of-accounts/:id" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><ChartOfAccountDetailPage /></Suspense></ProtectedRoute>} />
          <Route path="chart-of-accounts/:id/edit" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><EditChartOfAccountPage /></Suspense></ProtectedRoute>} />
          <Route path="accounting-purposes" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><AccountingPurposesPage /></Suspense></ProtectedRoute>} />
          <Route path="accounting-purpose-accounts/*" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><AccountingPurposeAccountsPage /></Suspense></ProtectedRoute>} />
          <Route path="accounting/fiscal-periods/*" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><FiscalPeriodsPage /></Suspense></ProtectedRoute>} />
              </Route>
            </Routes>
          </BrowserRouter>
        </BranchContextErrorBoundary>
      </ToastProvider>
    </ErrorBoundary>
  )
}

export default App
