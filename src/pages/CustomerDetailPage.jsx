import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext.jsx'
import Modal from '../components/Modal.jsx'

const STATUS = { active: 'Đang hợp tác', prospect: 'Tiềm năng', inactive: 'Ngừng hợp tác' }
const STATUS_BADGE = { active: 'badge-green', prospect: 'badge-blue', inactive: 'badge-gray' }

function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(-2).map(w => w[0]).join('').toUpperCase() || '?'
}

function Avatar({ name, size = 48 }) {
  const colors = ['#4f7ef8','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316']
  const color = colors[name.charCodeAt(0) % colors.length]
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 500, fontSize: size * 0.35, flexShrink: 0
    }}>
      {initials(name)}
    </div>
  )
}

const EMPTY_SERVICE = { service_type_id: '', assigned_to: '', start_date: '', end_date: '', is_active: true, notes: '' }

export default function CustomerDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [customer, setCustomer] = useState(null)
  const [services, setServices] = useState([])
  const [serviceTypes, setServiceTypes] = useState([])
  const [users, setUsers] = useState([])
  const [tasks, setTasks] = useState([])
  const [tab, setTab] = useState('info')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY_SERVICE)
  const [editForm, setEditForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const canEdit = profile?.role === 'admin' || profile?.role === 'manager'

  useEffect(() => { fetchAll() }, [id])

  async function fetchAll() {
    setLoading(true)
    const [{ data: cust }, { data: svcs }, { data: stypes }, { data: usrs }, { data: tsks }] = await Promise.all([
      supabase.from('customers').select('*').eq('id', id).single(),
      supabase.from('customer_services').select('*, service_types(name), user_profiles(full_name, email)').eq('customer_id', id).order('created_at', { ascending: false }),
      supabase.from('service_types').select('*').order('name'),
      supabase.from('user_profiles').select('id, full_name, email').order('full_name'),
      supabase.from('tasks').select('*').eq('customer_id', id).order('created_at', { ascending: false })
    ])
    if (!cust) { navigate('/customers'); return }
    setCustomer(cust)
    setServices(svcs || [])
    setServiceTypes(stypes || [])
    setUsers(usrs || [])
    setTasks(tsks || [])
    setLoading(false)
  }

  async function saveService() {
    if (!form.service_type_id) { setError('Vui lòng chọn loại dịch vụ'); return }
    setSaving(true); setError('')
    const payload = { ...form, customer_id: id, start_date: form.start_date || null, end_date: form.end_date || null, assigned_to: form.assigned_to || null }
    const { error: err } = modal === 'add-service'
      ? await supabase.from('customer_services').insert(payload)
      : await supabase.from('customer_services').update(payload).eq('id', form.id)
    if (err) setError(err.message)
    else { fetchAll(); setModal(null) }
    setSaving(false)
  }

  async function saveCustomer() {
    if (!editForm?.name?.trim()) return
    setSaving(true)
    await supabase.from('customers').update(editForm).eq('id', id)
    fetchAll(); setEditForm(null); setSaving(false)
  }

  async function deleteService(sid) {
    if (!confirm('Xoá dịch vụ này?')) return
    await supabase.from('customer_services').delete().eq('id', sid)
    fetchAll()
  }

  const F = ({ label, k, type = 'text', opts, ta }) => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {opts
        ? <select className="form-select" value={form[k] ?? ''} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}>
            <option value="">— Chọn —</option>
            {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        : ta
          ? <textarea className="form-textarea" value={form[k] || ''} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} rows={2} />
          : <input className="form-input" type={type} value={form[k] || ''} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} />
      }
    </div>
  )

  if (loading) return <div className="loading-screen" style={{ minHeight: '60vh' }}><div className="spinner" /></div>
  if (!customer) return null

  const TASK_STATUS = { todo: 'Cần làm', in_progress: 'Đang làm', done: 'Hoàn thành', cancelled: 'Đã huỷ' }
  const TASK_BADGE = { todo: 'badge-gray', in_progress: 'badge-blue', done: 'badge-green', cancelled: 'badge-gray' }

  return (
    <div>
      {/* Back */}
      <button onClick={() => navigate('/customers')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: 13, marginBottom: 16, padding: 0 }}>
        <i className="fa-light fa-arrow-left" /> Danh sách khách hàng
      </button>

      {/* Header */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <Avatar name={customer.name} size={56} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{customer.name}</h2>
              <span className={`badge ${STATUS_BADGE[customer.status] || 'badge-gray'}`}>{STATUS[customer.status]}</span>
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
              {customer.tax_code && <span style={{ fontSize: 13, color: 'var(--text-2)' }}><i className="fa-light fa-hashtag" style={{ marginRight: 4 }} />MST: {customer.tax_code}</span>}
              {customer.contact_name && <span style={{ fontSize: 13, color: 'var(--text-2)' }}><i className="fa-light fa-user" style={{ marginRight: 4 }} />{customer.contact_name}</span>}
              {customer.phone && <span style={{ fontSize: 13, color: 'var(--text-2)' }}><i className="fa-light fa-phone" style={{ marginRight: 4 }} />{customer.phone}</span>}
              {customer.email && <span style={{ fontSize: 13, color: 'var(--text-2)' }}><i className="fa-light fa-envelope" style={{ marginRight: 4 }} />{customer.email}</span>}
            </div>
          </div>
          {canEdit && (
            <button className="btn" onClick={() => setEditForm({ ...customer })}>
              <i className="fa-light fa-pen" /> Chỉnh sửa
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
        {[
          ['fa-briefcase', services.filter(s => s.is_active).length, 'Dịch vụ đang dùng', 'var(--primary)'],
          ['fa-list-check', tasks.filter(t => t.status === 'in_progress').length, 'Task đang làm', '#f59e0b'],
          ['fa-circle-check', tasks.filter(t => t.status === 'done').length, 'Task hoàn thành', '#10b981'],
        ].map(([icon, val, label, color]) => (
          <div key={label} className="card" style={{ textAlign: 'center', padding: '1rem' }}>
            <i className={`fa-light ${icon}`} style={{ fontSize: 20, color, marginBottom: 6 }} />
            <div style={{ fontSize: 22, fontWeight: 700, color }}>{val}</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
        {[['info','fa-circle-info','Thông tin'], ['services','fa-briefcase','Dịch vụ'], ['tasks','fa-list-check','Công việc']].map(([t, icon, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: tab === t ? 500 : 400,
            color: tab === t ? 'var(--primary)' : 'var(--text-2)',
            borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent',
            marginBottom: -1, display: 'flex', alignItems: 'center', gap: 6
          }}>
            <i className={`fa-light ${icon}`} /> {label}
          </button>
        ))}
      </div>

      {/* TAB: INFO */}
      {tab === 'info' && (
        <div className="card">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
            {[
              ['Tên công ty', customer.name],
              ['Mã số thuế', customer.tax_code],
              ['Người liên hệ', customer.contact_name],
              ['Điện thoại', customer.phone],
              ['Email', customer.email],
              ['Địa chỉ', customer.address],
            ].map(([label, val]) => val ? (
              <div key={label}>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 14 }}>{val}</div>
              </div>
            ) : null)}
          </div>
          {customer.notes && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>Ghi chú</div>
              <div style={{ fontSize: 14, color: 'var(--text-1)', whiteSpace: 'pre-wrap' }}>{customer.notes}</div>
            </div>
          )}
        </div>
      )}

      {/* TAB: SERVICES */}
      {tab === 'services' && (
        <div>
          {canEdit && (
            <div style={{ marginBottom: 12 }}>
              <button className="btn btn-primary" onClick={() => { setForm(EMPTY_SERVICE); setError(''); setModal('add-service') }}>
                <i className="fa-light fa-plus" /> Thêm dịch vụ
              </button>
            </div>
          )}
          {services.length === 0
            ? <div className="empty"><div className="empty-icon">📋</div><div className="empty-text">Chưa có dịch vụ nào</div></div>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {services.map(s => (
                  <div key={s.id} className="card" style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{ fontWeight: 500 }}>{s.service_types?.name || '—'}</span>
                          <span className={`badge ${s.is_active ? 'badge-green' : 'badge-gray'}`}>{s.is_active ? 'Đang dùng' : 'Ngừng'}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-2)' }}>
                          {s.user_profiles && <span><i className="fa-light fa-user" style={{ marginRight: 4 }} />{s.user_profiles.full_name || s.user_profiles.email}</span>}
                          {s.start_date && <span><i className="fa-light fa-calendar" style={{ marginRight: 4 }} />{s.start_date}{s.end_date ? ` → ${s.end_date}` : ''}</span>}
                        </div>
                        {s.notes && <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>{s.notes}</div>}
                      </div>
                      {canEdit && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="icon-btn" onClick={() => { setForm({ ...s, service_type_id: s.service_type_id || '', assigned_to: s.assigned_to || '' }); setError(''); setModal('edit-service') }}>
                            <i className="fa-light fa-pen" />
                          </button>
                          {profile?.role === 'admin' && (
                            <button className="icon-btn" style={{ color: 'var(--red)' }} onClick={() => deleteService(s.id)}>
                              <i className="fa-light fa-trash-can" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </div>
      )}

      {/* TAB: TASKS */}
      {tab === 'tasks' && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tên công việc</th>
                  <th>Trạng thái</th>
                  <th>Deadline</th>
                  <th>Người thực hiện</th>
                </tr>
              </thead>
              <tbody>
                {tasks.length === 0
                  ? <tr><td colSpan="4"><div className="empty"><div className="empty-icon">✅</div><div className="empty-text">Chưa có công việc nào</div></div></td></tr>
                  : tasks.map(t => (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 500 }}>{t.title}</td>
                      <td><span className={`badge ${TASK_BADGE[t.status] || 'badge-gray'}`}>{TASK_STATUS[t.status] || t.status}</span></td>
                      <td style={{ color: 'var(--text-2)', fontSize: 13 }}>{t.due_date || '—'}</td>
                      <td style={{ color: 'var(--text-2)', fontSize: 13 }}>{t.assignee_id || '—'}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: Add/Edit Service */}
      {(modal === 'add-service' || modal === 'edit-service') && (
        <Modal
          title={modal === 'add-service' ? 'Thêm dịch vụ' : 'Chỉnh sửa dịch vụ'}
          onClose={() => setModal(null)}
          footer={[
            <button key="c" className="btn" onClick={() => setModal(null)}>Huỷ</button>,
            <button key="s" className="btn btn-primary" onClick={saveService} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</button>
          ]}
        >
          {error && <div className="alert alert-error"><i className="fa-light fa-circle-exclamation" /> {error}</div>}
          <F label="Loại dịch vụ *" k="service_type_id" opts={serviceTypes.map(s => [s.id, s.name])} />
          <F label="Nhân viên phụ trách" k="assigned_to" opts={users.map(u => [u.id, u.full_name || u.email])} />
          <div className="form-row">
            <F label="Ngày bắt đầu" k="start_date" type="date" />
            <F label="Ngày kết thúc" k="end_date" type="date" />
          </div>
          <div className="form-group">
            <label className="form-label">Trạng thái</label>
            <select className="form-select" value={form.is_active ? 'true' : 'false'} onChange={e => setForm(p => ({ ...p, is_active: e.target.value === 'true' }))}>
              <option value="true">Đang dùng</option>
              <option value="false">Ngừng</option>
            </select>
          </div>
          <F label="Ghi chú" k="notes" ta />
        </Modal>
      )}

      {/* MODAL: Edit Customer */}
      {editForm && (
        <Modal
          title="Chỉnh sửa thông tin khách hàng"
          onClose={() => setEditForm(null)}
          footer={[
            <button key="c" className="btn" onClick={() => setEditForm(null)}>Huỷ</button>,
            <button key="s" className="btn btn-primary" onClick={saveCustomer} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</button>
          ]}
        >
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Tên công ty <span className="req">*</span></label>
              <input className="form-input" value={editForm.name || ''} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Mã số thuế</label>
              <input className="form-input" value={editForm.tax_code || ''} onChange={e => setEditForm(p => ({ ...p, tax_code: e.target.value }))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Người liên hệ</label>
              <input className="form-input" value={editForm.contact_name || ''} onChange={e => setEditForm(p => ({ ...p, contact_name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Điện thoại</label>
              <input className="form-input" value={editForm.phone || ''} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={editForm.email || ''} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Trạng thái</label>
              <select className="form-select" value={editForm.status || 'prospect'} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}>
                {Object.entries(STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Địa chỉ</label>
            <input className="form-input" value={editForm.address || ''} onChange={e => setEditForm(p => ({ ...p, address: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Ghi chú</label>
            <textarea className="form-textarea" rows={3} value={editForm.notes || ''} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
        </Modal>
      )}
    </div>
  )
}
