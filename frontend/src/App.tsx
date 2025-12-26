import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import { ToastProvider } from './contexts/ToastContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import Layout from './components/layout/Layout'
import HomePage from './pages/HomePage'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'
import ProfilePage from './pages/employees/ProfilePage'
import EmployeesPage from './pages/employees/EmployeesPage'
import CreateEmployeePage from './pages/employees/CreateEmployeePage'
import EmployeeDetailPage from './pages/employees/EmployeeDetailPage'
import EditEmployeePage from './pages/employees/EditEmployeePage'
import UserDetailPage from './pages/users/UserDetailPage'
import UserEditPage from './pages/users/UserEditPage'
import { CompaniesPage, CreateCompanyPage, EditCompanyPage } from './features/companies'
import { BranchesPage, CreateBranchPage, EditBranchPage } from './features/branches'
import { CategoriesPage, CreateCategoryPage, EditCategoryPage } from './features/categories'
import { MetricUnitsPage, CreateMetricUnitPage, EditMetricUnitPage } from './features/metric_units'
import { SubCategoriesPage, CreateSubCategoryPage, EditSubCategoryPage } from './features/categories'
import { PermissionsPage } from './features/permissions'
import { UsersPage } from './features/users'
import { ProductsPage, CreateProductPage, EditProductPage } from './features/products'
import { EmployeeBranchesPage, EmployeeBranchCreatePage, EmployeeBranchEditPage } from './features/employee_branches'

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
        <BrowserRouter>
      <Routes>
        {/* Auth Routes - No Layout */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Protected Routes - With Layout */}
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="employees" element={<ProtectedRoute><EmployeesPage /></ProtectedRoute>} />
          <Route path="employees/create" element={<ProtectedRoute><CreateEmployeePage /></ProtectedRoute>} />
          <Route path="employees/:id" element={<ProtectedRoute><EmployeeDetailPage /></ProtectedRoute>} />
          <Route path="employees/edit/:id" element={<ProtectedRoute><EditEmployeePage /></ProtectedRoute>} />
          <Route path="companies" element={<ProtectedRoute><CompaniesPage /></ProtectedRoute>} />
          <Route path="companies/new" element={<ProtectedRoute><CreateCompanyPage /></ProtectedRoute>} />
          <Route path="companies/:id" element={<ProtectedRoute><div>Detail</div></ProtectedRoute>} />
          <Route path="companies/:id/edit" element={<ProtectedRoute><EditCompanyPage /></ProtectedRoute>} />
          <Route path="branches" element={<ProtectedRoute><BranchesPage /></ProtectedRoute>} />
          <Route path="branches/new" element={<ProtectedRoute><CreateBranchPage /></ProtectedRoute>} />
          <Route path="branches/:id" element={<ProtectedRoute><div>Detail</div></ProtectedRoute>} />
          <Route path="branches/:id/edit" element={<ProtectedRoute><EditBranchPage /></ProtectedRoute>} />
          <Route path="permissions" element={<ProtectedRoute><PermissionsPage /></ProtectedRoute>} />
          <Route path="users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
          <Route path="users/:id" element={<ProtectedRoute><UserDetailPage /></ProtectedRoute>} />
          <Route path="users/edit/:id" element={<ProtectedRoute><UserEditPage /></ProtectedRoute>} />
          <Route path="categories" element={<ProtectedRoute><CategoriesPage /></ProtectedRoute>} />
          <Route path="categories/new" element={<ProtectedRoute><CreateCategoryPage /></ProtectedRoute>} />
          <Route path="categories/:id" element={<ProtectedRoute><div>Detail</div></ProtectedRoute>} />
          <Route path="categories/:id/edit" element={<ProtectedRoute><EditCategoryPage /></ProtectedRoute>} />
          <Route path="sub-categories" element={<ProtectedRoute><SubCategoriesPage /></ProtectedRoute>} />
          <Route path="sub-categories/new" element={<ProtectedRoute><CreateSubCategoryPage /></ProtectedRoute>} />
          <Route path="sub-categories/:id" element={<ProtectedRoute><div>Detail</div></ProtectedRoute>} />
          <Route path="sub-categories/:id/edit" element={<ProtectedRoute><EditSubCategoryPage /></ProtectedRoute>} />
          <Route path="metric-units" element={<ProtectedRoute><MetricUnitsPage /></ProtectedRoute>} />
          <Route path="metric-units/new" element={<ProtectedRoute><CreateMetricUnitPage /></ProtectedRoute>} />
          <Route path="metric-units/:id/edit" element={<ProtectedRoute><EditMetricUnitPage /></ProtectedRoute>} />
          <Route path="products" element={<ProtectedRoute><ProductsPage /></ProtectedRoute>} />
          <Route path="products/create" element={<ProtectedRoute><CreateProductPage /></ProtectedRoute>} />
          <Route path="products/:id" element={<ProtectedRoute><div>Detail</div></ProtectedRoute>} />
          <Route path="products/:id/edit" element={<ProtectedRoute><EditProductPage /></ProtectedRoute>} />
          <Route path="employee-branches" element={<ProtectedRoute><EmployeeBranchesPage /></ProtectedRoute>} />
          <Route path="employee-branches/create" element={<ProtectedRoute><EmployeeBranchCreatePage /></ProtectedRoute>} />
          <Route path="employee-branches/:id/edit" element={<ProtectedRoute><EmployeeBranchEditPage /></ProtectedRoute>} />
        </Route>
        </Routes>
      </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  )
}

export default App
