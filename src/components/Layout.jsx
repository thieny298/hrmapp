import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'

const NAV = [
  { path: '/', label: 'Dashboard', icon: '▦', roles: ['admin','manager','employee'] },
  { path: '/employees', label: 'Nhân sự', icon: '👤', roles: ['admin','manager'] },
  { path: '/tasks', label: 'Công việc', icon: '✓', roles: ['admin','manager','employee'] },
  { path: '/customers', label: 'Khách hàng', icon: '🏢', roles: ['admin','manager'] },
  { path: '/reports', label: 'Báo cáo', icon: '📊', roles: ['admin','manager'] },
  { path: '/users', label: 'Người dùng', icon: '⚙', roles: ['admin'] },
]

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/employees': 'Quản lý nhân sự',
  '/tasks': 'Theo dõi công việc',
  '/customers': 'Quản lý khách hàng',
  '/reports': 'Báo cáo & Thống kê',
  '/users': 'Quản lý người dùng',
}

const ROLE_LABELS = { admin: 'Admin', manager: 'Manager', employee: 'Nhân viên' }
const ROLE_BADGE = { admin: 'role-admin', manager: 'role-manager', employee: 'role-employee' }

function initials(name = '') {
  return name.split(' ').slice(-2).map(w => w[0]).join('').toUpperCase()
}

export default function Layout() {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const role = profile?.role || 'employee'
  const visibleNav = NAV.filter(n => n.roles.includes(role))

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">
          WorkFlow
          <small>Quản trị doanh nghiệp</small>
        </div>

        <div style={{ padding: '0.75rem 0', flex: 1 }}>
          {visibleNav.map(item => (
            <div
              key={item.path}
              className={`nav-item${location.pathname === item.path ? ' active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <span className="icon">{item.icon}</span>
              {item.label}
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <div className="avatar avatar-sm">{initials(profile?.full_name || profile?.email || '?')}</div>
            <div style={{ minWidth: 0 }}>
              <div className="user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile?.full_name || profile?.email}
              </div>
              <span className={`badge ${ROLE_BADGE[role]}`} style={{ fontSize: '10px', padding: '1px 6px' }}>
                {ROLE_LABELS[role]}
              </span>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ width: '100%' }} onClick={signOut}>
            Đăng xuất
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <h1 className="page-title">{PAGE_TITLES[location.pathname] || 'WorkFlow'}</h1>
          </div>
          <div className="topbar-right">
            <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>
              {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
        </header>
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
