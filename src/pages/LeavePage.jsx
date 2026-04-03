import { useState, useEffect } from 'react'
import DateInput from '../components/DateInput.jsx'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext.jsx'

const STATUS_BADGE = { pending:'badge-amber', approved:'badge-green', rejected:'badge-red' }
const STATUS_LABEL = { pending:'Chờ duyệt', approved:'Đã duyệt', rejected:'Từ chối' }
const LEAVE_TYPES = [['full','Nghỉ cả ngày'],['morning','Nghỉ nửa buổi sáng'],['afternoon','Nghỉ nửa buổi chiều']]

function countWorkdays(from, to, holidays=[]) {
  if (!from || !to) return 0
  let count = 0
  const d = new Date(from)
  const end = new Date(to)
  while (d <= end) {
    const day = d.getDay()
    const dateStr = d.toISOString().slice(0,10)
    if (day !== 0 && day !== 6 && !holidays.includes(dateStr)) count++
    d.setDate(d.getDate()+1)
  }
  return count
}

const EMPTY_FORM = { from_date:'', to_date:'', leave_type:'full', reason:'', handover_to:'', handover_email:'' }

export default function LeavePage() {
  const { profile } = useAuth()
  const [step, setStep] = useState(0) // 0=list, 1=form, 2=review
  const [form, setForm] = useState(EMPTY_FORM)
  const [leaves, setLeaves] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [leaveBalance] = useState({ total: 12, used: 3 })

  const workdays = form.leave_type === 'full' ? countWorkdays(form.from_date, form.to_date) : 0.5
  const daysDisplay = form.leave_type === 'full' ? workdays : 0.5

  useEffect(() => { fetchLeaves(); fetchMembers() }, [profile])

  async function fetchLeaves() {
    if (!profile?.id) return
    setLoading(true)
    const { data } = await supabase.from('leave_requests').select('*').eq('user_id', profile.id).order('created_at', { ascending: false })
    setLeaves(data || [])
    setLoading(false)
  }

  async function fetchMembers() {
    const { data } = await supabase.from('profiles').select('id,full_name,email').order('full_name')
    setMembers(data || [])
  }

  function handleMemberSelect(name) {
    const m = members.find(x => x.full_name === name)
    setForm(p => ({ ...p, handover_to: name, handover_email: m?.email || p.handover_email }))
  }

  function validateForm() {
    if (!form.from_date) return 'Vui lòng chọn ngày bắt đầu'
    if (form.leave_type === 'full' && !form.to_date) return 'Vui lòng chọn ngày kết thúc'
    if (form.leave_type === 'full' && form.from_date > form.to_date) return 'Ngày bắt đầu không được lớn hơn ngày kết thúc'
    if (!form.reason.trim()) return 'Vui lòng nhập lý do nghỉ'
    if (!form.handover_to.trim()) return 'Vui lòng nhập người nhận bàn giao'
    if (!form.handover_email.trim()) return 'Vui lòng nhập email người nhận bàn giao'
    if (daysDisplay <= 0) return 'Số ngày nghỉ không hợp lệ'
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
    const { error } = await supabase.from('leave_requests').insert({
      user_id: profile.id,
      from_date: form.from_date,
      to_date: form.leave_type === 'full' ? form.to_date : form.from_date,
      leave_type: form.leave_type,
      days_count: daysDisplay,
      reason: form.reason,
      handover_to: form.handover_to,
      handover_email: form.handover_email,
      status: 'pending',
    })
    if (error) { setError(error.message); setSubmitting(false); return }
    fetchLeaves()
    setForm(EMPTY_FORM)
    setStep(0)
    setSubmitting(false)
  }

  if (loading) return <div className="loading-screen" style={{minHeight:'60vh'}}><div className="spinner"/></div>

  return (
    <div>
      {/* Balance cards */}
      <div className="stats-grid" style={{gridTemplateColumns:'repeat(3,minmax(0,1fr))',marginBottom:'1rem'}}>
        <div className="stat-card"><div className="stat-label">Phép năm</div><div className="stat-value">{leaveBalance.total}</div><div className="stat-sub">ngày/năm</div></div>
        <div className="stat-card"><div className="stat-label">Đã dùng</div><div className="stat-value">{leaveBalance.used}</div><div className="stat-sub">ngày</div></div>
        <div className="stat-card"><div className="stat-label">Còn lại</div><div className="stat-value" style={{color:'var(--primary)'}}>{leaveBalance.total - leaveBalance.used}</div><div className="stat-sub">ngày</div></div>
      </div>

      {step === 0 && (
        <div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem'}}>
            <span style={{fontSize:'13px',color:'var(--text-2)'}}>{leaves.length} đơn nghỉ phép</span>
            <button className="btn btn-primary" onClick={()=>{setStep(1);setError('')}}>
              <i className="fa-solid fa-plus"/>Tạo đơn nghỉ
            </button>
          </div>
          <div className="card" style={{padding:0}}>
            <div className="table-wrap">
              <table>
                <thead><tr>{['Thời gian nghỉ','Hình thức','Số ngày','Lý do','Trạng thái'].map(c=><th key={c}>{c}</th>)}</tr></thead>
                <tbody>
                  {leaves.length === 0
                    ? <tr><td colSpan="5"><div className="empty"><div className="empty-icon"><i className="fa-solid fa-umbrella-beach"/></div><div className="empty-text">Chưa có đơn nghỉ phép nào</div></div></td></tr>
                    : leaves.map(l=>(
                      <tr key={l.id}>
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
          {/* Steps indicator */}
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

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Hình thức nghỉ<span className="req">*</span></label>
                  <select className="form-select" value={form.leave_type} onChange={e=>setForm(p=>({...p,leave_type:e.target.value}))}>
                    {LEAVE_TYPES.map(([v,l])=><option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Ngày bắt đầu<span className="req">*</span></label>
                  <DateInput value={form.from_date} onChange={v=>setForm(p=>({...p,from_date:v}))} />
                </div>
              </div>

              {form.leave_type === 'full' && (
                <div className="form-group">
                  <label className="form-label">Ngày kết thúc<span className="req">*</span></label>
                  <DateInput value={form.to_date} onChange={v=>setForm(p=>({...p,to_date:v}))} />
                </div>
              )}

              {(form.from_date && (form.leave_type !== 'full' || form.to_date)) && (
                <div style={{padding:'10px 14px',background:'var(--primary-bg)',borderRadius:'var(--radius)',marginBottom:'14px',fontSize:'13px',color:'var(--primary)',fontWeight:'500'}}>
                  <i className="fa-solid fa-calendar-check" style={{marginRight:'6px'}}/>
                  Số ngày nghỉ: <strong>{daysDisplay} ngày</strong>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Lý do nghỉ<span className="req">*</span></label>
                <textarea className="form-textarea" value={form.reason} onChange={e=>setForm(p=>({...p,reason:e.target.value}))} placeholder="Nhập lý do nghỉ..." />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Bàn giao công việc cho<span className="req">*</span></label>
                  <input className="form-input" list="members-list" value={form.handover_to} onChange={e=>handleMemberSelect(e.target.value)} placeholder="Nhập tên..." />
                  <datalist id="members-list">{members.map(m=><option key={m.id} value={m.full_name}/>)}</datalist>
                </div>
                <div className="form-group">
                  <label className="form-label">Email người nhận bàn giao<span className="req">*</span></label>
                  <input className="form-input" type="email" value={form.handover_email} onChange={e=>setForm(p=>({...p,handover_email:e.target.value}))} />
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
    </div>
  )
}
