import { useState, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { supabase } from '../lib/supabase'
import Modal from './Modal.jsx'

const NAV = [
  { path: '/', label: 'Dashboard', icon: 'fa-light fa-grid-2', module: 'dashboard' },
  {
    id: 'nhansu', label: 'Nhân sự', icon: 'fa-light fa-users',
    children: [
      { path: '/ho-so', label: 'Hồ sơ', alwaysVisible: true },
      { path: '/nhan-vien', label: 'Danh sách nhân viên', module: 'employees' },
      { path: '/nhan-vien/them-moi', label: 'Thêm nhân sự', module: 'employees', action: 'edit' },
      { path: '/luong', label: 'Lương', alwaysVisible: true },
      { path: '/yeu-cau-chinh-sua', label: 'Yêu cầu chỉnh sửa', adminOnly: true },
    ]
  },
  {
    id: 'thoigian', label: 'Thời gian', icon: 'fa-light fa-clock',
    children: [
      { path: '/cham-cong', label: 'Chấm công', alwaysVisible: true },
      { path: '/nghi-phep', label: 'Nghỉ phép', alwaysVisible: true },
      { path: '/don-cua-toi', label: 'Đơn của tôi', alwaysVisible: true },
      { path: '/duyet-nghi-phep', label: 'Duyệt nghỉ phép', module: 'leave', action: 'edit' },
    ]
  },
  { path: '/tasks', label: 'Công việc', icon: 'fa-light fa-list-check', module: 'tasks' },
  { path: '/customers', label: 'Khách hàng', icon: 'fa-light fa-handshake', module: 'customers' },
  { path: '/reports', label: 'Báo cáo', icon: 'fa-light fa-chart-line', module: 'reports' },
  { path: '/users', label: 'Người dùng', icon: 'fa-light fa-gear', module: 'users' },
  { path: '/phan-quyen', label: 'Phân quyền', icon: 'fa-light fa-shield-halved', superOnly: true },
]

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/ho-so': 'Hồ sơ nhân viên',
  '/nhan-vien': 'Danh sách nhân viên',
  '/nhan-vien/them-moi': 'Thêm nhân sự',
  '/cham-cong': 'Chấm công',
  '/nghi-phep': 'Nghỉ phép',
  '/don-cua-toi': 'Đơn của tôi',
  '/luong': 'Bảng lương',
  '/tasks': 'Công việc',
  '/customers': 'Khách hàng',
  '/customers/:id': 'Chi tiết khách hàng',
  '/reports': 'Báo cáo & Thống kê',
  '/users': 'Quản lý người dùng',
  '/yeu-cau-chinh-sua': 'Yêu cầu chỉnh sửa',
  '/duyet-nghi-phep': 'Duyệt nghỉ phép',
  '/phan-quyen': 'Phân quyền',
}

const ROLE_LABELS = { admin: 'Admin', ceo: 'CEO', manager: 'Manager', staff: 'Nhân viên' }

function getBreadcrumb(pathname) {
  for (const item of NAV) {
    if (item.children) {
      const child = item.children.find(c => c.path === pathname)
      if (child) return [item.label, child.label]
    } else if (item.path === pathname) {
      return [item.label]
    }
  }
  if (pathname.startsWith('/customers/')) return ['Khách hàng', 'Chi tiết khách hàng']
  return [PAGE_TITLES[pathname] || 'Optways']
}

function initials(name = '') {
  return name.split(' ').slice(-2).map(w => w[0]).join('').toUpperCase()
}

export default function Layout() {
  const { profile, signOut, isSuper, canView, canEdit } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const role = profile?.role || 'staff'
  const [collapsed, setCollapsed] = useState(false)
  const [openGroups, setOpenGroups] = useState({})
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)

  useEffect(() => {
    const activeGroup = NAV.find(item => item.children?.some(c => c.path === location.pathname))
    setOpenGroups(activeGroup ? { [activeGroup.id]: true } : {})
    if (window.matchMedia('(max-width: 768px)').matches) setCollapsed(false)
  }, [location.pathname])

  function toggleGroup(id) {
    setOpenGroups(prev => (prev[id] ? {} : { [id]: true }))
  }

  function isGroupActive(children) {
    return children?.some(c => location.pathname === c.path)
  }

  function canSee(item) {
    if (item.superOnly) return isSuper()
    if (item.adminOnly) return ['admin', 'ceo'].includes(role)
    if (item.alwaysVisible) return true
    if (!item.module) return true
    return item.action === 'edit' ? canEdit(item.module) : canView(item.module)
  }

  function openPasswordModal() {
    setNewPassword('')
    setConfirmPassword('')
    setPwError('')
    setPwSuccess(false)
    setShowPasswordModal(true)
  }

  function translatePwError(msg) {
    if (msg.includes('should be different from the old password')) return 'Mật khẩu mới phải khác mật khẩu hiện tại'
    if (msg.includes('at least 6 characters')) return 'Mật khẩu phải có ít nhất 6 ký tự'
    if (msg.includes('Auth session missing')) return 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại'
    return 'Có lỗi xảy ra, vui lòng thử lại'
  }

  async function handleChangePassword() {
    if (!newPassword || newPassword.length < 6) { setPwError('Mật khẩu phải có ít nhất 6 ký tự'); return }
    if (newPassword !== confirmPassword) { setPwError('Mật khẩu nhập lại không khớp'); return }
    setPwSaving(true); setPwError('')
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPwSaving(false)
    if (error) { setPwError(translatePwError(error.message)); return }
    setPwSuccess(true)
    setNewPassword('')
    setConfirmPassword('')
  }

  const crumbs = getBreadcrumb(location.pathname)

  return (
    <div className="app">
      {collapsed && <div className="mobile-backdrop" onClick={() => setCollapsed(false)} />}
      <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <img src="/Optways-Logo.svg" className="logo-text" alt="Optways" />
           <img src="/public/Optways-Logo-icon.png" className="logo-text-toggle" alt="Optways" />
          </div>
          <button className="sidebar-toggle" onClick={() => setCollapsed(p => !p)} title={collapsed ? 'Mở rộng' : 'Thu gọn'}>
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="18" height="18"><path _ngcontent-ng-c2138935329="" d="M49.984,56l-35.989,0c-3.309,0 -5.995,-2.686 -5.995,-5.995l0,-36.011c0,-3.308 2.686,-5.995 5.995,-5.995l35.989,0c3.309,0 5.995,2.687 5.995,5.995l0,36.011c0,3.309 -2.686,5.995 -5.995,5.995Zm-25.984,-4.001l0,-39.999l-9.012,0c-1.65,0 -2.989,1.339 -2.989,2.989l0,34.021c0,1.65 1.339,2.989 2.989,2.989l9.012,0Zm24.991,-39.999l-20.991,0l0,39.999l20.991,0c1.65,0 2.989,-1.339 2.989,-2.989l0,-34.021c0,-1.65 -1.339,-2.989 -2.989,-2.989Z" fill="currentColor"></path></svg>
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV.map(item => {
            if (!canSee(item)) return null

            if (item.children) {
              const visible = item.children.filter(c => canSee(c))
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
                        <span className="nav-child-dot" />
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
          <button className="sidebar-signout" onClick={openPasswordModal}>
            <i className="fa-light fa-key" />
            <span>Đổi mật khẩu</span>
          </button>
          <button className="sidebar-signout" onClick={signOut}>
            <i className="fa-light fa-arrow-right-from-bracket" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      <div className={`main${collapsed ? ' collapsed' : ''}`}>
        <header className="topbar">
          <div className="topbar-left">
            <img src="/Optways-Logo.svg" alt="Optways" className="topbar-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }} />
            <div className="breadcrumb">
              {crumbs.map((c, i) => (
                <span key={i} className={i === crumbs.length - 1 ? 'breadcrumb-current' : ''}>
                  {c}
                  {i < crumbs.length - 1 && <i className="fa-light fa-chevron-right breadcrumb-sep" />}
                </span>
              ))}
            </div>
          </div>
          <div className="topbar-right">
        
            <button className={`mobile-menu-toggle${collapsed ? ' open' : ''}`} onClick={() => setCollapsed(p => !p)}>
              <span className="menu-bar menu-bar-1" />
              <span className="menu-bar menu-bar-2" />
            </button>
          </div>
        </header>
        <div className="content">
          <div className="content-inner">
          <Outlet />
          </div>
        </div>
      </div>

      {showPasswordModal && (
        <Modal
          title="Đổi mật khẩu"
          onClose={() => setShowPasswordModal(false)}
          footer={[
            <button key="c" className="btn" onClick={() => setShowPasswordModal(false)}>Đóng</button>,
            <button key="s" className="btn btn-primary" onClick={handleChangePassword} disabled={pwSaving}>
              {pwSaving ? 'Đang lưu...' : 'Đổi mật khẩu'}
            </button>
          ]}
        >
          {pwError && <div className="alert alert-error">{pwError}</div>}
          {pwSuccess && <div className="alert alert-success">Đổi mật khẩu thành công!</div>}
          <div className="form-group">
            <label className="form-label">Mật khẩu mới</label>
            <input className="form-input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Nhập lại mật khẩu mới</label>
            <input className="form-input" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
          </div>
        </Modal>
      )}
    </div>
  )
}
