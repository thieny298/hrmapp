import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext.jsx'
import Layout from './components/Layout.jsx'
import LoginPage from './pages/LoginPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import AttendancePage from './pages/AttendancePage.jsx'
import LeavePage from './pages/LeavePage.jsx'
import SalaryPage from './pages/SalaryPage.jsx'
import TasksPage from './pages/TasksPage.jsx'
import CustomersPage from './pages/CustomersPage.jsx'
import CustomerDetailPage from './pages/CustomerDetailPage.jsx'
import ReportsPage from './pages/ReportsPage.jsx'
import UsersPage from './pages/UsersPage.jsx'
import LeaveApprovalPage from './pages/LeaveApprovalPage.jsx'
import EmployeesPage from './pages/EmployeesPage.jsx'
import EmployeeCreatePage from './pages/EmployeeCreatePage.jsx'

function ProtectedRoute({ children, allowedRoles }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>
  if (!user) return <Navigate to="/login" replace />
  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="ho-so" element={<ProfilePage />} />
        <Route path="cham-cong" element={<AttendancePage />} />
        <Route path="nghi-phep" element={<LeavePage initialStep={1} />} />
        <Route path="don-cua-toi" element={<LeavePage initialStep={0} />} />
        <Route path="luong" element={<SalaryPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="customers/:id" element={<CustomerDetailPage />} />
        <Route path="reports" element={<ProtectedRoute allowedRoles={['admin','manager']}><ReportsPage /></ProtectedRoute>} />
        <Route path="users" element={<ProtectedRoute allowedRoles={['admin']}><UsersPage /></ProtectedRoute>} />
        <Route path="duyet-nghi-phep" element={<ProtectedRoute allowedRoles={['admin','manager']}><LeaveApprovalPage /></ProtectedRoute>} />
        <Route path="nhan-vien" element={<ProtectedRoute allowedRoles={['admin']}><EmployeesPage /></ProtectedRoute>} />
        <Route path="nhan-vien/them-moi" element={<ProtectedRoute allowedRoles={['admin']}><EmployeeCreatePage /></ProtectedRoute>} />
        <Route path="nhan-vien/:id" element={<ProtectedRoute allowedRoles={['admin']}><ProfilePage /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}