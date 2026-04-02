import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext.jsx'
import Modal from '../components/Modal.jsx'

const COLS = ['todo', 'doing', 'review', 'done']
const TASK_STATUS = { todo: 'Cần làm', doing: 'Đang làm', review: 'Chờ duyệt', done: 'Hoàn thành' }
const COL_BADGE = { todo: 'badge-gray', doing: 'badge-blue', review: 'badge-amber', done: 'badge-green' }
const PRIORITIES = { high: 'Cao', medium: 'Trung bình', low: 'Thấp' }
const PRI_BADGE = { high: 'badge-red', medium: 'badge-amber', low: 'badge-green' }

function initials(name = '') { return name.split(' ').slice(-2).map(w => w[0]).join('').toUpperCase() }

const EMPTY_FORM = { title: '', assigned_to: '', customer_id: '', status: 'todo', priority: 'medium', due_date: '', description: '' }

export default function TasksPage() {
  const { profile } = useAuth()
  const [tasks, setTasks] = useState([])
  const [members, setMembers] = useState([])
  const [customers, setCustomers] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const canEdit = profile?.role === 'admin' || profile?.role === 'manager'
  const isEmployee = profile?.role === 'employee'

  useEffect(() => { fetchAll() }, [profile])

  async function fetchAll() {
    setLoading(true)
    const [tasksRes, membersRes, custRes] = await Promise.all([
      (() => {
        let q = supabase.from('tasks').select('*, assignee:profiles!tasks_assigned_to_fkey(id,full_name), customer:customers(id,name)').order('created_at', { ascending: false })
        if (isEmployee) q = q.eq('assigned_to', profile.id)
        return q
      })(),
      supabase.from('profiles').select('id, full_name').order('full_name'),
      supabase.from('customers').select('id, name').eq('status', 'active').order('name'),
    ])
    setTasks(tasksRes.data || [])
    setMembers(membersRes.data || [])
    setCustomers(custRes.data || [])
    setLoading(false)
  }

  function openAdd(status = 'todo') {
    setForm({ ...EMPTY_FORM, status, assigned_to: isEmployee ? profile.id : '' })
    setError(''); setModal('add')
  }
  function openEdit(t) {
    setForm({ ...t, assigned_to: t.assigned_to || '', customer_id: t.customer_id || '', due_date: t.due_date || '' })
    setError(''); setModal('edit')
  }

  async function save() {
    if (!form.title?.trim()) { setError('Vui lòng nhập tên task'); return }
    setSaving(true); setError('')
    const payload = { title: form.title, assigned_to: form.assigned_to || null, customer_id: form.customer_id || null, status: form.status, priority: form.priority, due_date: form.due_date || null, description: form.description }
    const { error } = modal === 'add'
      ? await supabase.from('tasks').insert(payload)
      : await supabase.from('tasks').update(payload).eq('id', form.id)
    if (error) setError(error.message)
    else { fetchAll(); setModal(null) }
    setSaving(false)
  }

  async function updateStatus(id, status) {
    await supabase.from('tasks').update({ status }).eq('id', id)
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t))
  }

  async function del(id) {
    if (!confirm('Xoá task này?')) return
    await supabase.from('tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
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
        <div style={{ fontSize: '13px', color: 'var(--text-2)' }}>{tasks.length} task tổng cộng</div>
        {canEdit && <button className="btn btn-primary" onClick={() => openAdd()}>+ Thêm task</button>}
      </div>

      <div className="kanban">
        {COLS.map(col => {
          const colTasks = tasks.filter(t => t.status === col)
          return (
            <div key={col} className="kanban-col">
              <div className="kanban-col-header">
                <span className="kanban-col-title">{TASK_STATUS[col]}</span>
                <span className={`badge ${COL_BADGE[col]}`}>{colTasks.length}</span>
              </div>

              {colTasks.map(t => (
                <div key={t.id} className="task-card" onClick={() => openEdit(t)}>
                  <div className="task-title">{t.title}</div>
                  <div className="task-meta">
                    <span className={`badge ${PRI_BADGE[t.priority]}`}>{PRIORITIES[t.priority]}</span>
                    {t.due_date && <span style={{ fontSize: '11px', color: 'var(--text-2)' }}>📅 {t.due_date}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <div className="avatar" style={{ width: '20px', height: '20px', fontSize: '9px' }}>{initials(t.assignee?.full_name || '?')}</div>
                      <span style={{ fontSize: '11px', color: 'var(--text-2)' }}>{t.assignee?.full_name || 'Chưa giao'}</span>
                    </div>
                    {canEdit && (
                      <button className="icon-btn" style={{ color: 'var(--red)', width: '20px', height: '20px', fontSize: '11px' }}
                        onClick={e => { e.stopPropagation(); del(t.id) }}>✕</button>
                    )}
                  </div>
                  {t.customer?.name && (
                    <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>🏢 {t.customer.name}</div>
                  )}
                </div>
              ))}

              {canEdit && (
                <button className="btn btn-ghost btn-sm" style={{ width: '100%', marginTop: '4px', justifyContent: 'center' }}
                  onClick={() => openAdd(col)}>+ Thêm</button>
              )}
            </div>
          )
        })}
      </div>

      {modal && (
        <Modal
          title={modal === 'add' ? 'Thêm task mới' : 'Chỉnh sửa task'}
          onClose={() => setModal(null)}
          footer={[
            <button key="c" className="btn" onClick={() => setModal(null)}>Huỷ</button>,
            <button key="s" className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</button>
          ]}
        >
          {error && <div className="alert alert-error">{error}</div>}
          <F label="Tên task *" k="title" />
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Giao cho</label>
              <select className="form-select" value={form.assigned_to || ''} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))} disabled={isEmployee}>
                <option value="">— Chưa giao —</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Khách hàng</label>
              <select className="form-select" value={form.customer_id || ''} onChange={e => setForm(p => ({ ...p, customer_id: e.target.value }))}>
                <option value="">— Không có —</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <F label="Trạng thái" k="status" opts={Object.entries(TASK_STATUS)} />
            <F label="Ưu tiên" k="priority" opts={Object.entries(PRIORITIES)} />
          </div>
          <F label="Deadline" k="due_date" type="date" />
          <F label="Mô tả" k="description" ta />
        </Modal>
      )}
    </div>
  )
}
