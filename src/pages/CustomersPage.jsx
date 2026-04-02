import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext.jsx'
import Modal from '../components/Modal.jsx'

const INDUSTRIES = ['Công nghệ', 'E-commerce', 'Sản xuất', 'Dịch vụ', 'Tài chính', 'Y tế', 'Giáo dục', 'Khác']
const STATUS = { active: 'Đang hợp tác', prospect: 'Tiềm năng', inactive: 'Ngừng hợp tác' }
const STATUS_BADGE = { active: 'badge-green', prospect: 'badge-blue', inactive: 'badge-gray' }

const EMPTY_FORM = { name: '', contact_name: '', email: '', phone: '', status: 'prospect', contract_value: '', industry: INDUSTRIES[0], notes: '' }

export default function CustomersPage() {
  const { profile } = useAuth()
  const [customers, setCustomers] = useState([])
  const [search, setSearch] = useState('')
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

  const filtered = customers.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.contact_name?.toLowerCase().includes(search.toLowerCase())
  )

  function openAdd() { setForm(EMPTY_FORM); setError(''); setModal('add') }
  function openEdit(c) { setForm({ ...c }); setError(''); setModal('edit') }

  async function save() {
    if (!form.name?.trim()) { setError('Vui lòng nhập tên công ty'); return }
    setSaving(true); setError('')
    const payload = { name: form.name, contact_name: form.contact_name, email: form.email, phone: form.phone, status: form.status, contract_value: form.contract_value, industry: form.industry, notes: form.notes }
    const { error } = modal === 'add'
      ? await supabase.from('customers').insert(payload)
      : await supabase.from('customers').update(payload).eq('id', form.id)
    if (error) setError(error.message)
    else { fetchCustomers(); setModal(null) }
    setSaving(false)
  }

  async function del(id) {
    if (!confirm('Xoá khách hàng này?')) return
    await supabase.from('customers').delete().eq('id', id)
    fetchCustomers()
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
          <input className="search-input" placeholder="Tìm kiếm khách hàng..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {canEdit && <button className="btn btn-primary" onClick={openAdd}>+ Thêm khách hàng</button>}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {['Công ty', 'Người liên hệ', 'Email', 'Ngành', 'Giá trị HĐ', 'Trạng thái', canEdit ? '' : null].filter(Boolean).map(c => <th key={c}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan="7"><div className="empty"><div className="empty-icon">🏢</div><div className="empty-text">Không có khách hàng nào</div></div></td></tr>
                : filtered.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 500 }}>{c.name}</td>
                    <td>{c.contact_name}</td>
                    <td style={{ color: 'var(--text-2)', fontSize: '12px' }}>{c.email}</td>
                    <td style={{ color: 'var(--text-2)' }}>{c.industry}</td>
                    <td>{c.contract_value ? c.contract_value + ' đ' : '—'}</td>
                    <td><span className={`badge ${STATUS_BADGE[c.status]}`}>{STATUS[c.status]}</span></td>
                    {canEdit && (
                      <td>
                        <div style={{ display: 'flex', gap: '2px' }}>
                          <button className="icon-btn" onClick={() => openEdit(c)}>✎</button>
                          {profile?.role === 'admin' && <button className="icon-btn" style={{ color: 'var(--red)' }} onClick={() => del(c.id)}>✕</button>}
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
          title={modal === 'add' ? 'Thêm khách hàng mới' : 'Chỉnh sửa khách hàng'}
          onClose={() => setModal(null)}
          footer={[
            <button key="c" className="btn" onClick={() => setModal(null)}>Huỷ</button>,
            <button key="s" className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</button>
          ]}
        >
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-row">
            <F label="Tên công ty *" k="name" />
            <F label="Người liên hệ" k="contact_name" />
          </div>
          <div className="form-row">
            <F label="Email" k="email" type="email" />
            <F label="Điện thoại" k="phone" />
          </div>
          <div className="form-row">
            <F label="Ngành nghề" k="industry" opts={INDUSTRIES.map(i => [i, i])} />
            <F label="Trạng thái" k="status" opts={Object.entries(STATUS)} />
          </div>
          <F label="Giá trị hợp đồng (VND)" k="contract_value" />
          <F label="Ghi chú" k="notes" ta />
        </Modal>
      )}
    </div>
  )
}
