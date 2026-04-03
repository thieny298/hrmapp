import { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'

const NAV = [
  { path: '/', label: 'Dashboard', icon: 'fa-light fa-grid-2', roles: ['admin','manager','employee'] },
  {
    id: 'nhansu', label: 'Nhân sự', icon: 'fa-light fa-users',
    roles: ['admin','manager','employee'],
    children: [
      { path: '/ho-so', label: 'Hồ sơ', roles: ['admin','manager','employee'] },
      { path: '/cham-cong', label: 'Chấm công', roles: ['admin','manager','employee'] },
      { path: '/nghi-phep', label: 'Nghỉ phép', roles: ['admin','manager','employee'] },
      { path: '/luong', label: 'Lương', roles: ['admin','manager','employee'] },
    ]
  },
  { path: '/tasks', label: 'Công việc', icon: 'fa-light fa-list-check', roles: ['admin','manager','employee'] },
  { path: '/customers', label: 'Khách hàng', icon: 'fa-light fa-handshake', roles: ['admin','manager','employee'] },
  { path: '/reports', label: 'Báo cáo', icon: 'fa-light fa-chart-line', roles: ['admin','manager'] },
  { path: '/users', label: 'Người dùng', icon: 'fa-light fa-gear', roles: ['admin'] },
]

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/ho-so': 'Hồ sơ nhân viên',
  '/cham-cong': 'Chấm công',
  '/nghi-phep': 'Nghỉ phép',
  '/luong': 'Bảng lương',
  '/tasks': 'Công việc',
  '/customers': 'Khách hàng',
  '/reports': 'Báo cáo & Thống kê',
  '/users': 'Quản lý người dùng',
}

const ROLE_LABELS = { admin: 'Admin', manager: 'Manager', employee: 'Nhân viên' }

function initials(name = '') {
  return name.split(' ').slice(-2).map(w => w[0]).join('').toUpperCase()
}

export default function Layout() {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const role = profile?.role || 'employee'
  const [collapsed, setCollapsed] = useState(false)
const [openGroups, setOpenGroups] = useState({})

  function toggleGroup(id) {
    setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function isGroupActive(children) {
    return children?.some(c => location.pathname === c.path)
  }

  return (
    <div className="app">
      <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
          <img src="/Optways-Logo.svg" className="logo-text" alt="Optways" />
          </div>
          <button className="sidebar-toggle" onClick={() => setCollapsed(p => !p)} title={collapsed ? 'Mở rộng' : 'Thu gọn'}>
            <i className={`fa-light ${collapsed ? 'fa-angles-right' : 'fa-angles-left'}`} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV.map(item => {
            if (!item.roles.includes(role)) return null

            if (item.children) {
              const visible = item.children.filter(c => c.roles.includes(role))
              if (!visible.length) return null
              const groupActive = isGroupActive(visible)
              const isOpen = openGroups[item.id]

              return (
                <div key={item.id}>
                  <div
                    className={`nav-parent${groupActive ? ' active' : ''}${isOpen ? ' open' : ''}`}
                    onClick={() => !collapsed ? toggleGroup(item.id) : navigate(visible[0].path)}
                    title={collapsed ? item.label : undefined}
                  >
                    <i className={`nav-icon ${item.icon}`} />
                    <span className="nav-label">{item.label}</span>
                    <i className="nav-chevron fa-light fa-chevron-right" />
                  </div>
                  <div className={`nav-children${isOpen ? ' open' : ''}`}>
                    {visible.map(child => (
                      <div
                        key={child.path}
                        className={`nav-child${location.pathname === child.path ? ' active' : ''}`}
                        onClick={() => navigate(child.path)}
                      >
                        {child.label}
                      </div>
                    ))}
                  </div>
                </div>
              )
            }

            return (
              <div
                key={item.path}
                className={`nav-single${location.pathname === item.path ? ' active' : ''}`}
                onClick={() => navigate(item.path)}
                title={collapsed ? item.label : undefined}
              >
                <i className={`nav-icon ${item.icon}`} />
                <span className="nav-label">{item.label}</span>
              </div>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="avatar avatar-sm">{initials(profile?.full_name || profile?.email || '?')}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{profile?.full_name || profile?.email}</div>
              <div className="sidebar-user-role">{ROLE_LABELS[role]}</div>
            </div>
          </div>
          <button className="sidebar-signout" onClick={signOut}>
            <i className="fa-light fa-arrow-right-from-bracket" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      <div className={`main${collapsed ? ' collapsed' : ''}`}>
        <header className="topbar">
          <h1 className="page-title">{PAGE_TITLES[location.pathname] || 'Optways'}</h1>
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
