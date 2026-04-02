import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext.jsx'
import Modal from '../components/Modal.jsx'

const DEPTS = ['Kỹ thuật', 'Marketing', 'Kinh doanh', 'Vận hành', 'HR', 'Tài chính', 'Khác']
const STATUS = { active: 'Đang làm', probation: 'Thử việc', leave: 'Nghỉ phép', quit: 'Đã nghỉ' }
const STATUS_BADGE = { active: 'badge-green', probation: 'badge-amber', leave: 'badge-blue', quit: 'badge-gray' }

function initials(name = '') { return name.split(' ').slice(-2).map(w => w[0]).join('').toUpperCase() }

const EMPTY_FORM = { full_name: '', department: DEPTS[0], position: '', status: 'active', email: '', phone: '', join_date: new Date().toISOString().slice(0, 10), notes: '' }

export default function EmployeesPage() {
  const { profile } = useAuth()
  const [employees, setEmployees] = useState([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const canEdit = profile?.role === 'admin' || profile?.role === 'manager'

  useEffect(() => { fetchEmployees() }, [])

  async function fetchEmployees() {
    setLoading(true)
    const { data } = await supabase.from('employees').select('*').order('full_name')
    setEmployees(data || [])
    setLoading(false)
  }

  const filtered = employees.filter(e =>
    e.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    e.department?.toLowerCase().includes(search.toLowerCase()) ||
    e.position?.toLowerCase().includes(search.toLowerCase())
  )

  function openAdd() { setForm(EMPTY_FORM); setError(''); setModal('add') }
  function openEdit(e) { setForm({ ...e }); setError(''); setModal('edit') }

  async function save() {
    if (!form.full_name?.trim()) { setError('Vui lòng nhập họ tên'); return }
    setSaving(true); setError('')
    const payload = { full_name: form.full_name, department: form.department, position: form.position, status: form.status, email: form.email, phone: form.phone, join_date: form.join_date, notes: form.notes }
    const { error } = modal === 'add'
      ? await supabase.from('employees').insert(payload)
      : await supabase.from('employees').update(payload).eq('id', form.id)
    if (error) setError(error.message)
    else { fetchEmployees(); setModal(null) }
    setSaving(false)
  }

  async function del(id) {
    if (!confirm('Xoá nhân viên này?')) return
    await supabase.from('employees').delete().eq('id', id)
    fetchEmployees()
  }

  const F = ({ label, k, type = 'text', opts, ta }) => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {opts
        ? <select className="form-select" value={form[k] || ''} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}>
            {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        : ta
          ? <textarea className="form-textarea" value={form[k] || ''} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} />
          : <input className="form-input" type={type} value={form[k] || ''} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} />
      }
    </div>
  )

  if (loading) return <div className="loading-screen" style={{ minHeight: '60vh' }}><div className="spinner" /></div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div className="search-wrap">
          <input className="search-input" placeholder="Tìm kiếm nhân viên..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {canEdit && <button className="btn btn-primary" onClick={openAdd}>+ Thêm nhân viên</button>}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {['Nhân viên', 'Phòng ban', 'Vị trí', 'Trạng thái', 'Email', 'Điện thoại', 'Ngày vào', canEdit ? '' : null].filter(Boolean).map(c => <th key={c}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan="8"><div className="empty"><div className="empty-icon">👤</div><div className="empty-text">Không có nhân viên nào</div></div></td></tr>
                : filtered.map(e => (
                  <tr key={e.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="avatar avatar-sm">{initials(e.full_name)}</div>
                        <span style={{ fontWeight: 500 }}>{e.full_name}</span>
                      </div>
                    </td>
                    <td>{e.department}</td>
                    <td style={{ color: 'var(--text-2)' }}>{e.position}</td>
                    <td><span className={`badge ${STATUS_BADGE[e.status]}`}>{STATUS[e.status]}</span></td>
                    <td style={{ color: 'var(--text-2)', fontSize: '12px' }}>{e.email}</td>
                    <td style={{ color: 'var(--text-2)' }}>{e.phone}</td>
                    <td style={{ color: 'var(--text-2)', fontSize: '12px' }}>{e.join_date}</td>
                    {canEdit && (
                      <td>
                        <div style={{ display: 'flex', gap: '2px' }}>
                          <button className="icon-btn" onClick={() => openEdit(e)} title="Sửa">✎</button>
                          {profile?.role === 'admin' && <button className="icon-btn" style={{ color: 'var(--red)' }} onClick={() => del(e.id)} title="Xoá">✕</button>}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <Modal
          title={modal === 'add' ? 'Thêm nhân viên mới' : 'Chỉnh sửa nhân viên'}
          onClose={() => setModal(null)}
          footer={[
            <button key="c" className="btn" onClick={() => setModal(null)}>Huỷ</button>,
            <button key="s" className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</button>
          ]}
        >
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-row">
            <F label="Họ và tên *" k="full_name" />
            <F label="Phòng ban" k="department" opts={DEPTS.map(d => [d, d])} />
          </div>
          <div className="form-row">
            <F label="Vị trí / Chức danh" k="position" />
            <F label="Trạng thái" k="status" opts={Object.entries(STATUS)} />
          </div>
          <div className="form-row">
            <F label="Email" k="email" type="email" />
            <F label="Điện thoại" k="phone" />
          </div>
          <F label="Ngày vào làm" k="join_date" type="date" />
          <F label="Ghi chú" k="notes" ta />
        </Modal>
      )}
    </div>
  )
}
