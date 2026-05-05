import { useState, useEffect, useRef } from 'react'
import DatePicker from '../components/DatePicker.jsx'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext.jsx'

const STATUS_BADGE = { pending:'badge-amber', approved:'badge-green', rejected:'badge-red' }
const STATUS_LABEL = { pending:'Chờ duyệt', approved:'Đã duyệt', rejected:'Từ chối' }
const LEAVE_TYPES = [['full','Nghỉ cả ngày'],['morning','Nghỉ nửa buổi sáng'],['afternoon','Nghỉ nửa buổi chiều']]

// Ngày lễ cố định (MM-DD), không tính năm
const FIXED_HOLIDAYS = ['01-01','04-30','05-01','09-02','09-03','11-24']

function isHoliday(date, publicHolidays) {
  const mmdd = `${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
  if (FIXED_HOLIDAYS.includes(mmdd)) return true
  const yyyy_mm_dd = `${date.getFullYear()}-${mmdd}`
  return publicHolidays.includes(yyyy_mm_dd)
}

function countWorkdays(from, to, publicHolidays = []) {
  if (!from || !to) return 0
  let count = 0
  const d = new Date(from + 'T00:00:00')
  const end = new Date(to + 'T00:00:00')
  while (d <= end) {
    const day = d.getDay()
    if (day !== 0 && day !== 6 && !isHoliday(d, publicHolidays)) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

// Tính số ngày phép dựa theo join_date (1 ngày/tháng, tối đa 12)
function calcLeaveEntitlement(joinDateStr) {
  if (!joinDateStr) return 12
  const join = new Date(joinDateStr + 'T00:00:00')
  const now = new Date()
  // Số tháng từ join đến đầu tháng hiện tại
  const months = (now.getFullYear() - join.getFullYear()) * 12 + (now.getMonth() - join.getMonth())
  if (months >= 12) return 12
  return Math.max(0, months)
}

// Min date = ngày mai
function getTomorrow() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

const EMPTY_FORM = { from_date:'', to_date:'', leave_type:'full', reason:'', handover_to:'', handover_email:'' }

function AutocompleteInput({ value, onChange, members, placeholder }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const ref = useRef(null)

  useEffect(() => { setQuery(value) }, [value])

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = query.length > 0
    ? members.filter(m => m.full_name?.toLowerCase().includes(query.toLowerCase())).slice(0, 6)
    : []

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        className="form-input"
        value={query}
        placeholder={placeholder}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value, null); setOpen(true) }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          maxHeight: '200px', overflowY: 'auto', marginTop: '2px'
        }}>
          {filtered.map(m => (
            <div
              key={m.id}
              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '2px' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              onMouseDown={() => { onChange(m.full_name, m); setQuery(m.full_name); setOpen(false) }}
            >
              <span style={{ fontWeight: 500 }}>{m.full_name}</span>
              <span style={{ color: 'var(--text-2)', fontSize: '12px' }}>{m.email}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function LeaveDetailModal({ leave, onClose }) {
  if (!leave) return null
  const typeLabel = LEAVE_TYPES.find(t => t[0] === leave.leave_type)?.[1] || leave.leave_type
  const fromStr = new Date(leave.from_date).toLocaleDateString('vi-VN')
  const toStr = new Date(leave.to_date).toLocaleDateString('vi-VN')
  const createdStr = new Date(leave.created_at).toLocaleString('vi-VN')

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
    }} onClick={onClose}>
      <div style={{
        background: 'var(--card)', borderRadius: '12px', width: '100%', maxWidth: '480px',
        padding: '24px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ fontWeight: 600, fontSize: '15px' }}>Chi tiết đơn nghỉ phép</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--text-2)', padding: '0 4px' }}>
            <i className="fa-light fa-xmark" />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
          {[
            ['Hình thức', typeLabel],
            ['Số ngày nghỉ', (leave.days_count || '—') + ' ngày'],
            ['Ngày bắt đầu', fromStr],
            ['Ngày kết thúc', toStr],
            ['Bàn giao cho', leave.handover_to || '—'],
            ['Email bàn giao', leave.handover_email || '—'],
          ].map(([k, v]) => (
            <div key={k} style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 'var(--radius)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-2)', marginBottom: '3px' }}>{k}</div>
              <div style={{ fontWeight: 500, fontSize: '13px', wordBreak: 'break-all' }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 'var(--radius)', marginBottom: '10px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-2)', marginBottom: '3px' }}>Lý do nghỉ</div>
          <div style={{ fontWeight: 500, fontSize: '13px' }}>{leave.reason}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-2)' }}>
            <i className="fa-light fa-clock" style={{ marginRight: '4px' }} />
            Gửi lúc: {createdStr}
          </div>
          <span className={`badge ${STATUS_BADGE[leave.status]}`}>{STATUS_LABEL[leave.status]}</span>
        </div>
      </div>
    </div>
  )
}

export default function LeavePage() {
  const { profile } = useAuth()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(EMPTY_FORM)
  const [leaves, setLeaves] = useState([])
  const [members, setMembers] = useState([])
  const [publicHolidays, setPublicHolidays] = useState([]) // ['YYYY-MM-DD', ...]
  const [employeeProfile, setEmployeeProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [selectedLeave, setSelectedLeave] = useState(null)

  const tomorrow = getTomorrow()

  // Tính số ngày phép được hưởng
  const totalLeave = calcLeaveEntitlement(employeeProfile?.join_date)

  // Tính số ngày đã dùng (đơn approved)
  const usedLeave = leaves
    .filter(l => l.status === 'approved')
    .reduce((sum, l) => sum + (Number(l.days_count) || 0), 0)

  const remainLeave = totalLeave - usedLeave

  // Tính days_count có trừ ngày lễ
  const workdays = form.leave_type === 'full'
    ? countWorkdays(form.from_date, form.to_date, publicHolidays)
    : 0.5
  const daysDisplay = workdays

  useEffect(() => {
    fetchLeaves()
    fetchMembers()
    fetchPublicHolidays()
    fetchEmployeeProfile()
  }, [profile?.id])

  async function fetchLeaves() {
    if (!profile?.id) return
    setLoading(true)
    const { data } = await supabase.from('leave_requests').select('*').eq('user_id', profile.id).order('created_at', { ascending: false })
    setLeaves(data || [])
    setLoading(false)
  }

  async function fetchMembers() {
    const { data } = await supabase.from('user_profiles').select('id,full_name,email').order('full_name')
    setMembers(data || [])
  }

  async function fetchPublicHolidays() {
    const { data } = await supabase.from('public_holidays').select('date')
    setPublicHolidays((data || []).map(h => h.date))
  }

  async function fetchEmployeeProfile() {
    if (!profile?.id) return
    const { data } = await supabase.from('employee_profiles').select('join_date').eq('user_id', profile.id).single()
    setEmployeeProfile(data)
  }

  function handleHandoverChange(name, member) {
    setForm(p => ({ ...p, handover_to: name, handover_email: member?.email || p.handover_email }))
  }

  function validateForm() {
    if (!form.from_date) return 'Vui lòng chọn ngày bắt đầu'
    if (form.leave_type === 'full' && !form.to_date) return 'Vui lòng chọn ngày kết thúc'
    if (form.leave_type === 'full' && form.from_date > form.to_date) return 'Ngày bắt đầu không được lớn hơn ngày kết thúc'
    if (!form.reason.trim()) return 'Vui lòng nhập lý do nghỉ'
    if (!form.handover_to.trim()) return 'Vui lòng nhập người nhận bàn giao'
    if (!form.handover_email.trim()) return 'Vui lòng nhập email người nhận bàn giao'
    if (daysDisplay <= 0) return 'Khoảng thời gian chọn không có ngày làm việc hợp lệ (trùng ngày lễ hoặc cuối tuần)'
    if (daysDisplay > remainLeave) return `Số ngày nghỉ vượt quá số phép còn lại (${remainLeave} ngày)`
    return null
  }

  function goReview() {
    const err = validateForm()
    if (err) { setError(err); return }
    setError('')
    setStep(2)
  }

  async function submit() {
    setSubmitting(true)
    const { data: inserted, error } = await supabase.from('leave_requests').insert({
      user_id: profile.id,
      from_date: form.from_date,
      to_date: form.leave_type === 'full' ? form.to_date : form.from_date,
      leave_type: form.leave_type,
      days_count: daysDisplay,
      reason: form.reason,
      handover_to: form.handover_to,
      handover_email: form.handover_email,
      status: 'pending',
    }).select().single()
    if (error) { setError(error.message); setSubmitting(false); return }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch('https://sohwksictzmszufkrpas.supabase.co/functions/v1/send-leave-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ leave_id: inserted.id }),
      })
    } catch (e) {
      console.warn('Email notification failed:', e)
    }

    fetchLeaves()
    setForm(EMPTY_FORM)
    setStep(0)
    setSubmitting(false)
  }

  if (loading) return <div className="loading-screen" style={{minHeight:'60vh'}}><div className="spinner"/></div>

  return (
    <div>
      {/* Stats */}
      <div className="stats-grid" style={{gridTemplateColumns:'repeat(3,minmax(0,1fr))',marginBottom:'1rem'}}>
        <div className="stat-card">
          <div className="stat-label">Phép năm</div>
          <div className="stat-value">{totalLeave}</div>
          <div className="stat-sub">ngày{totalLeave < 12 ? ' (đang tích lũy)' : '/năm'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Đã dùng</div>
          <div className="stat-value">{usedLeave}</div>
          <div className="stat-sub">ngày</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Còn lại</div>
          <div className="stat-value" style={{color: remainLeave <= 2 ? 'var(--danger)' : 'var(--primary)'}}>{remainLeave}</div>
          <div className="stat-sub">ngày</div>
        </div>
      </div>

      {step === 0 && (
        <div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem'}}>
            <span style={{fontSize:'13px',color:'var(--text-2)'}}>{leaves.length} đơn nghỉ phép</span>
            <button className="btn btn-primary" onClick={()=>{setStep(1);setError('')}} disabled={remainLeave <= 0}>
              <i className="fa-solid fa-plus"/>Tạo đơn nghỉ
            </button>
          </div>
          {remainLeave <= 0 && (
            <div className="alert alert-error" style={{marginBottom:'1rem'}}>
              <i className="fa-solid fa-circle-exclamation"/> Bạn đã hết ngày phép năm nay.
            </div>
          )}
          <div className="card" style={{padding:0}}>
            <div className="table-wrap">
              <table>
                <thead><tr>{['Thời gian nghỉ','Hình thức','Số ngày','Lý do','Trạng thái'].map(c=><th key={c}>{c}</th>)}</tr></thead>
                <tbody>
                  {leaves.length === 0
                    ? <tr><td colSpan="5"><div className="empty"><div className="empty-icon"><i className="fa-solid fa-umbrella-beach"/></div><div className="empty-text">Chưa có đơn nghỉ phép nào</div></div></td></tr>
                    : leaves.map(l=>(
                      <tr key={l.id} style={{cursor:'pointer'}} onClick={()=>setSelectedLeave(l)}>
                        <td style={{fontWeight:500}}>{new Date(l.from_date).toLocaleDateString('vi-VN')}{l.to_date !== l.from_date && ' → '+new Date(l.to_date).toLocaleDateString('vi-VN')}</td>
                        <td style={{color:'var(--text-2)'}}>{LEAVE_TYPES.find(t=>t[0]===l.leave_type)?.[1]||l.leave_type}</td>
                        <td>{l.days_count} ngày</td>
                        <td style={{color:'var(--text-2)',maxWidth:'200px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.reason}</td>
                        <td><span className={`badge ${STATUS_BADGE[l.status]}`}>{STATUS_LABEL[l.status]}</span></td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {(step === 1 || step === 2) && (
        <div>
          <div className="steps" style={{marginBottom:'1.5rem'}}>
            <div className={`step${step>=1?' active':''}`}>
              <div className="step-circle"><i className="fa-solid fa-pen"/></div>
              <span className="step-label">Nhập đơn</span>
            </div>
            <div className="step-line"/>
            <div className={`step${step>=2?' active':''}`}>
              <div className="step-circle"><i className="fa-solid fa-eye"/></div>
              <span className="step-label">Xem lại</span>
            </div>
            <div className="step-line"/>
            <div className="step">
              <div className="step-circle"><i className="fa-solid fa-paper-plane"/></div>
              <span className="step-label">Gửi đơn</span>
            </div>
          </div>

          {step === 1 && (
            <div className="card">
              <div className="card-title" style={{marginBottom:'1.25rem'}}>Nhập thông tin nghỉ phép</div>
              {error && <div className="alert alert-error"><i className="fa-solid fa-circle-exclamation"/>{error}</div>}

              <div className="form-group">
                <label className="form-label">Hình thức nghỉ<span className="req">*</span></label>
                <select className="form-select" value={form.leave_type} onChange={e=>setForm(p=>({...p,leave_type:e.target.value,to_date:''}))}>
                  {LEAVE_TYPES.map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Ngày bắt đầu<span className="req">*</span></label>
                  <DatePicker
                    value={form.from_date}
                    onChange={v=>setForm(p=>({...p,from_date:v,to_date:''}))}
                    placeholder="DD/MM/YYYY"
                    minDate={tomorrow}
                  />
                </div>
                {form.leave_type === 'full' && (
                  <div className="form-group">
                    <label className="form-label">Ngày kết thúc<span className="req">*</span></label>
                    <DatePicker
                      value={form.to_date}
                      onChange={v=>setForm(p=>({...p,to_date:v}))}
                      placeholder="DD/MM/YYYY"
                      minDate={form.from_date || tomorrow}
                    />
                  </div>
                )}
              </div>

              {(form.from_date && (form.leave_type !== 'full' || form.to_date)) && (
                <div style={{padding:'10px 14px',background: daysDisplay > 0 ? 'var(--primary-bg)' : '#fef3c7',borderRadius:'var(--radius)',marginBottom:'14px',fontSize:'13px',color: daysDisplay > 0 ? 'var(--primary)' : '#92400e',fontWeight:'500'}}>
                  <i className={`fa-solid ${daysDisplay > 0 ? 'fa-calendar-check' : 'fa-triangle-exclamation'}`} style={{marginRight:'6px'}}/>
                  {daysDisplay > 0
                    ? <>Số ngày nghỉ: <strong>{daysDisplay} ngày</strong> (đã trừ ngày lễ & cuối tuần)</>
                    : 'Khoảng thời gian này không có ngày làm việc (trùng lễ/cuối tuần)'
                  }
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Lý do nghỉ<span className="req">*</span></label>
                <textarea className="form-textarea" value={form.reason} onChange={e=>setForm(p=>({...p,reason:e.target.value}))} placeholder="Nhập lý do nghỉ..." />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Bàn giao công việc cho<span className="req">*</span></label>
                  <AutocompleteInput value={form.handover_to} onChange={handleHandoverChange} members={members} placeholder="Nhập tên..." />
                </div>
                <div className="form-group">
                  <label className="form-label">Email người nhận bàn giao<span className="req">*</span></label>
                  <input className="form-input" type="email" value={form.handover_email} onChange={e=>setForm(p=>({...p,handover_email:e.target.value}))} placeholder="Tự điền khi chọn tên" />
                </div>
              </div>

              <div style={{display:'flex',justifyContent:'flex-end',gap:'8px',marginTop:'1rem'}}>
                <button className="btn" onClick={()=>setStep(0)}>Huỷ</button>
                <button className="btn btn-primary" onClick={goReview}>Xem lại <i className="fa-solid fa-arrow-right"/></button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="card">
              <div className="card-title" style={{marginBottom:'1.25rem'}}>Xem lại đơn nghỉ phép</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'1.5rem'}}>
                {[
                  ['Họ tên', profile?.full_name],
                  ['Hình thức', LEAVE_TYPES.find(t=>t[0]===form.leave_type)?.[1]],
                  ['Ngày bắt đầu', new Date(form.from_date).toLocaleDateString('vi-VN')],
                  ['Ngày kết thúc', form.leave_type==='full'?new Date(form.to_date).toLocaleDateString('vi-VN'):'—'],
                  ['Số ngày nghỉ', daysDisplay+' ngày'],
                  ['Bàn giao cho', form.handover_to],
                  ['Email bàn giao', form.handover_email],
                ].map(([k,v])=>(
                  <div key={k} style={{padding:'12px',background:'var(--bg)',borderRadius:'var(--radius)'}}>
                    <div style={{fontSize:'11px',color:'var(--text-2)',marginBottom:'3px'}}>{k}</div>
                    <div style={{fontWeight:'500',fontSize:'13px'}}>{v}</div>
                  </div>
                ))}
                <div style={{gridColumn:'span 2',padding:'12px',background:'var(--bg)',borderRadius:'var(--radius)'}}>
                  <div style={{fontSize:'11px',color:'var(--text-2)',marginBottom:'3px'}}>Lý do nghỉ</div>
                  <div style={{fontWeight:'500',fontSize:'13px'}}>{form.reason}</div>
                </div>
              </div>
              {error && <div className="alert alert-error">{error}</div>}
              <div style={{display:'flex',justifyContent:'flex-end',gap:'8px'}}>
                <button className="btn" onClick={()=>setStep(1)}><i className="fa-solid fa-arrow-left"/>Sửa lại</button>
                <button className="btn btn-primary" onClick={submit} disabled={submitting}>
                  <i className="fa-solid fa-paper-plane"/>
                  {submitting ? 'Đang gửi...' : 'Gửi đơn'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <LeaveDetailModal leave={selectedLeave} onClose={()=>setSelectedLeave(null)} />
    </div>
  )
}
