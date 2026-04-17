import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext.jsx'
import Modal from '../components/Modal.jsx'

const STATUS = { active: 'Đang hợp tác', prospect: 'Tiềm năng', inactive: 'Ngừng hợp tác' }
const STATUS_BADGE = { active: 'badge-green', prospect: 'badge-blue', inactive: 'badge-gray' }
const EMPTY_FORM = { name: '', contact_name: '', email: '', phone: '', address: '', tax_code: '', status: 'prospect', notes: '' }

function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(-2).map(w => w[0]).join('').toUpperCase() || '?'
}

function Avatar({ name, size = 40 }) {
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

export default function CustomersPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [customers, setCustomers] = useState([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [view, setView] = useState('list')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const canEdit = profile?.role === 'admin' || profile?.role === 'manager'

  useEffect(() => { fetchCustomers() }, [])

  async function fetchCustomers() {
    setLoading(true)
    const { data } = await supabase.from('customers').select('*').order('name')
    setCustomers(data || [])
    setLoading(false)
  }

  const filtered = customers.filter(c => {
    const q = search.toLowerCase()
    const matchSearch = !q || c.name?.toLowerCase().includes(q) || c.contact_name?.toLowerCase().includes(q) || c.tax_code?.toLowerCase().includes(q)
    const matchStatus = !filterStatus || c.status === filterStatus
    return matchSearch && matchStatus
  })

  function openAdd() { setForm(EMPTY_FORM); setError(''); setModal('add') }
  function openEdit(e, c) { e.stopPropagation(); setForm({ ...c }); setError(''); setModal('edit') }

  async function save() {
    if (!form.name?.trim()) { setError('Vui lòng nhập tên công ty'); return }
    setSaving(true); setError('')
    const payload = { name: form.name, contact_name: form.contact_name, email: form.email, phone: form.phone, address: form.address, tax_code: form.tax_code, status: form.status, notes: form.notes }
    const { error: err } = modal === 'add'
      ? await supabase.from('customers').insert(payload)
      : await supabase.from('customers').update(payload).eq('id', form.id)
    if (err) setError(err.message)
    else { fetchCustomers(); setModal(null) }
    setSaving(false)
  }

  async function del(e, id) {
    e.stopPropagation()
    if (!confirm('Xoá khách hàng này?')) return
    await supabase.from('customers').delete().eq('id', id)
    fetchCustomers()
  }

  const F = ({ label, k, type = 'text', opts, ta, required }) => (
    <div className="form-group">
      <label className="form-label">{label}{required && <span className="req">*</span>}</label>
      {opts
        ? <select className="form-select" value={form[k] || ''} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}>
            {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        : ta
          ? <textarea className="form-textarea" value={form[k] || ''} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} rows={3} />
          : <input className="form-input" type={type} value={form[k] || ''} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} />
      }
    </div>
  )

  if (loading) return <div className="loading-screen" style={{ minHeight: '60vh' }}><div className="spinner" /></div>

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div className="search-wrap" style={{ flex: 1, minWidth: 200 }}>
          <input className="search-input" placeholder="Tìm tên, người liên hệ, mã số thuế..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-select" style={{ width: 'auto', minWidth: 150 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          {Object.entries(STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 2, background: 'var(--bg-2)', borderRadius: 8, padding: 2 }}>
          {[['list','fa-list'],['grid','fa-grid-2']].map(([v, icon]) => (
            <button key={v} onClick={() => setView(v)} title={v === 'list' ? 'Danh sách' : 'Lưới'} style={{
              padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: view === v ? 'var(--bg)' : 'transparent',
              color: 'var(--text-1)',
              boxShadow: view === v ? '0 1px 3px rgba(0,0,0,.1)' : 'none'
            }}>
              <i className={`fa-light ${icon}`} />
            </button>
          ))}
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={openAdd}>
            <i className="fa-light fa-plus" /> Thêm KH
          </button>
        )}
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap' }}>
        {[['', 'Tất cả', customers.length], ['active', 'Đang hợp tác', customers.filter(c=>c.status==='active').length], ['prospect', 'Tiềm năng', customers.filter(c=>c.status==='prospect').length], ['inactive', 'Ngừng hợp tác', customers.filter(c=>c.status==='inactive').length]].map(([v, l, n]) => (
          <button key={v} onClick={() => setFilterStatus(v)} style={{
            padding: '4px 14px', borderRadius: 20, border: '1px solid var(--border)',
            background: filterStatus === v ? 'var(--primary)' : 'var(--bg)',
            color: filterStatus === v ? '#fff' : 'var(--text-2)',
            fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all .15s'
          }}>
            {l} <strong style={{ color: filterStatus === v ? '#fff' : 'var(--text-1)' }}>{n}</strong>
          </button>
        ))}
      </div>

      {/* LIST VIEW */}
      {view === 'list' && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Khách hàng</th>
                  <th>Người liên hệ</th>
                  <th>Mã số thuế</th>
                  <th>Điện thoại</th>
                  <th>Trạng thái</th>
                  {canEdit && <th></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0
                  ? <tr><td colSpan="6"><div className="empty"><div className="empty-icon">🏢</div><div className="empty-text">Không có khách hàng nào</div></div></td></tr>
                  : filtered.map(c => (
                    <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/customers/${c.id}`)}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar name={c.name} size={32} />
                          <div>
                            <div style={{ fontWeight: 500 }}>{c.name}</div>
                            {c.email && <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{c.email}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-2)' }}>{c.contact_name || '—'}</td>
                      <td style={{ color: 'var(--text-2)', fontSize: 13 }}>{c.tax_code || '—'}</td>
                      <td style={{ color: 'var(--text-2)' }}>{c.phone || '—'}</td>
                      <td><span className={`badge ${STATUS_BADGE[c.status] || 'badge-gray'}`}>{STATUS[c.status] || c.status}</span></td>
                      {canEdit && (
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 2 }}>
                            <button className="icon-btn" onClick={e => openEdit(e, c)}><i className="fa-light fa-pen" /></button>
                            {profile?.role === 'admin' && <button className="icon-btn" style={{ color: 'var(--red)' }} onClick={e => del(e, c.id)}><i className="fa-light fa-trash-can" /></button>}
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
      )}

      {/* GRID VIEW */}
      {view === 'grid' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {filtered.length === 0
            ? <div className="empty" style={{ gridColumn: '1/-1' }}><div className="empty-icon">🏢</div><div className="empty-text">Không có khách hàng nào</div></div>
            : filtered.map(c => (
              <div key={c.id} className="card" style={{ cursor: 'pointer', padding: '1rem', transition: 'box-shadow .15s' }}
                onClick={() => navigate(`/customers/${c.id}`)}
                onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = ''}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar name={c.name} size={40} />
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{c.name}</div>
                      {c.tax_code && <div style={{ fontSize: 12, color: 'var(--text-2)' }}>MST: {c.tax_code}</div>}
                    </div>
                  </div>
                  <span className={`badge ${STATUS_BADGE[c.status] || 'badge-gray'}`}>{STATUS[c.status]}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 13, color: 'var(--text-2)' }}>
                  {c.contact_name && <span><i className="fa-light fa-user" style={{ marginRight: 6, width: 14 }} />{c.contact_name}</span>}
                  {c.phone && <span><i className="fa-light fa-phone" style={{ marginRight: 6, width: 14 }} />{c.phone}</span>}
                  {c.email && <span><i className="fa-light fa-envelope" style={{ marginRight: 6, width: 14 }} />{c.email}</span>}
                  {c.address && <span><i className="fa-light fa-location-dot" style={{ marginRight: 6, width: 14 }} />{c.address}</span>}
                </div>
                {canEdit && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', justifyContent: 'flex-end' }}
                    onClick={e => e.stopPropagation()}>
                    <button className="icon-btn" onClick={e => openEdit(e, c)}><i className="fa-light fa-pen" /></button>
                    {profile?.role === 'admin' && <button className="icon-btn" style={{ color: 'var(--red)' }} onClick={e => del(e, c.id)}><i className="fa-light fa-trash-can" /></button>}
                  </div>
                )}
              </div>
            ))
          }
        </div>
      )}

      {/* MODAL */}
      {modal && (
        <Modal
          title={modal === 'add' ? 'Thêm khách hàng mới' : 'Chỉnh sửa khách hàng'}
          onClose={() => setModal(null)}
          footer={[
            <button key="c" className="btn" onClick={() => setModal(null)}>Huỷ</button>,
            <button key="s" className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</button>
          ]}
        >
          {error && <div className="alert alert-error"><i className="fa-light fa-circle-exclamation" /> {error}</div>}
          <div className="form-row">
            <F label="Tên công ty" k="name" required />
            <F label="Mã số thuế" k="tax_code" />
          </div>
          <div className="form-row">
            <F label="Người liên hệ" k="contact_name" />
            <F label="Điện thoại" k="phone" />
          </div>
          <div className="form-row">
            <F label="Email" k="email" type="email" />
            <F label="Trạng thái" k="status" opts={Object.entries(STATUS)} />
          </div>
          <F label="Địa chỉ" k="address" />
          <F label="Ghi chú" k="notes" ta />
        </Modal>
      )}
    </div>
  )
}
