import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext.jsx'
import Layout from './components/Layout.jsx'
import LoginPage from './pages/LoginPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import EmployeesPage from './pages/EmployeesPage.jsx'
import TasksPage from './pages/TasksPage.jsx'
import CustomersPage from './pages/CustomersPage.jsx'
import ReportsPage from './pages/ReportsPage.jsx'
import UsersPage from './pages/UsersPage.jsx'

function ProtectedRoute({ children, allowedRoles }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <div className="loading-screen"><div className="spinner" /><span>Đang tải...</span></div>
  if (!user) return <Navigate to="/login" replace />
  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-screen"><div className="spinner" /><span>Đang tải...</span></div>

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="employees" element={<ProtectedRoute allowedRoles={['admin','manager','hr']}><EmployeesPage /></ProtectedRoute>} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="customers" element={<ProtectedRoute allowedRoles={['admin','manager']}><CustomersPage /></ProtectedRoute>} />
        <Route path="reports" element={<ProtectedRoute allowedRoles={['admin','manager']}><ReportsPage /></ProtectedRoute>} />
        <Route path="users" element={<ProtectedRoute allowedRoles={['admin']}><UsersPage /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
