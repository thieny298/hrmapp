import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal.jsx'

const ROLES = { admin: 'Admin', manager: 'Manager', employee: 'Nhân viên' }
const ROLE_BADGE = { admin: 'role-admin', manager: 'role-manager', employee: 'role-employee' }

function initials(name = '') { return name.split(' ').slice(-2).map(w => w[0]).join('').toUpperCase() }

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ email: '', full_name: '', role: 'employee', password: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => { fetchUsers() }, [])

  async function fetchUsers() {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('full_name')
    setUsers(data || [])
    setLoading(false)
  }

  function openAdd() {
    setForm({ email: '', full_name: '', role: 'employee', password: '' })
    setError(''); setSuccess(''); setModal('add')
  }

  function openEdit(u) {
    setForm({ ...u, password: '' })
    setError(''); setSuccess(''); setModal('edit')
  }

  async function save() {
    setError(''); setSuccess('')
    if (!form.full_name?.trim()) { setError('Vui lòng nhập họ tên'); return }

    setSaving(true)

    if (modal === 'add') {
      if (!form.email?.trim()) { setError('Vui lòng nhập email'); setSaving(false); return }
      if (form.password.length < 6) { setError('Mật khẩu tối thiểu 6 ký tự'); setSaving(false); return }

      // Tạo user qua Supabase Auth (dùng Admin API nếu có, hoặc signUp)
      const { data, error: authErr } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { full_name: form.full_name } }
      })

      if (authErr) { setError(authErr.message); setSaving(false); return }

      // Cập nhật role trong profiles
      if (data.user) {
        await supabase.from('profiles').upsert({ id: data.user.id, email: form.email, full_name: form.full_name, role: form.role })
      }
      setSuccess('Tạo tài khoản thành công! Người dùng cần xác nhận email.')
    } else {
      // Chỉ cập nhật profile (không đổi password ở đây)
      const { error } = await supabase.from('profiles').update({ full_name: form.full_name, role: form.role }).eq('id', form.id)
      if (error) { setError(error.message); setSaving(false); return }
      setSuccess('Cập nhật thành công!')
      fetchUsers()
      setTimeout(() => setModal(null), 1200)
    }

    setSaving(false)
    fetchUsers()
  }

  if (loading) return <div className="loading-screen" style={{ minHeight: '60vh' }}><div className="spinner" /></div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ fontSize: '13px', color: 'var(--text-2)' }}>{users.length} tài khoản</div>
        <button className="btn btn-primary" onClick={openAdd}>+ Tạo tài khoản</button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {['Người dùng', 'Email', 'Vai trò', 'Ngày tạo', ''].map(c => <th key={c}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {users.length === 0
                ? <tr><td colSpan="5"><div className="empty"><div className="empty-icon">⚙</div><div className="empty-text">Chưa có tài khoản nào</div></div></td></tr>
                : users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="avatar avatar-sm">{initials(u.full_name || u.email)}</div>
                        <span style={{ fontWeight: 500 }}>{u.full_name || '—'}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-2)', fontSize: '12px' }}>{u.email}</td>
                    <td><span className={`badge ${ROLE_BADGE[u.role]}`}>{ROLES[u.role]}</span></td>
                    <td style={{ color: 'var(--text-2)', fontSize: '12px' }}>{u.created_at ? new Date(u.created_at).toLocaleDateString('vi-VN') : '—'}</td>
                    <td>
                      <button className="icon-btn" onClick={() => openEdit(u)} title="Sửa">✎</button>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <Modal
          title={modal === 'add' ? 'Tạo tài khoản mới' : 'Chỉnh sửa tài khoản'}
          onClose={() => setModal(null)}
          footer={!success ? [
            <button key="c" className="btn" onClick={() => setModal(null)}>Huỷ</button>,
            <button key="s" className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</button>
          ] : null}
        >
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}
          {!success && (
            <>
              <div className="form-group">
                <label className="form-label">Họ và tên *</label>
                <input className="form-input" value={form.full_name || ''} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} placeholder="Nguyễn Văn A" />
              </div>
              {modal === 'add' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Email *</label>
                    <input className="form-input" type="email" value={form.email || ''} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="email@congty.vn" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Mật khẩu tạm *</label>
                    <input className="form-input" type="password" value={form.password || ''} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Tối thiểu 6 ký tự" />
                  </div>
                </>
              )}
              <div className="form-group">
                <label className="form-label">Vai trò</label>
                <select className="form-select" value={form.role || 'employee'} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                  {Object.entries(ROLES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              {modal === 'edit' && (
                <div style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 'var(--radius)', fontSize: '12px', color: 'var(--text-2)' }}>
                  Để đổi mật khẩu, người dùng dùng chức năng "Quên mật khẩu" ở trang đăng nhập.
                </div>
              )}
            </>
          )}
        </Modal>
      )}
    </div>
  )
}
