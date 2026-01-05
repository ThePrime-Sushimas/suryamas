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
const EditProductPage = lazy(() => import('./features/products').then(m => ({ default: m.EditProductPage })))
const EmployeeBranchesPage = lazy(() => import('./features/employee_branches').then(m => ({ default: m.EmployeeBranchesPage })))
const EmployeeBranchDetailPage = lazy(() => import('./features/employee_branches').then(m => ({ default: m.EmployeeBranchDetailPage })))

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
          <Route path="products/:id" element={<ProtectedRoute><div>Detail</div></ProtectedRoute>} />
          <Route path="products/:id/edit" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><EditProductPage /></Suspense></ProtectedRoute>} />
          <Route path="employee-branches" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><EmployeeBranchesPage /></Suspense></ProtectedRoute>} />
          <Route path="employees/:employeeId/branches" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><EmployeeBranchDetailPage /></Suspense></ProtectedRoute>} />
              </Route>
            </Routes>
          </BrowserRouter>
        </BranchContextErrorBoundary>
      </ToastProvider>
    </ErrorBoundary>
  )
}

export default App
