import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import DatePicker from '../components/DatePicker.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext.jsx'

const STATUS_BADGE = { pending: 'badge-amber', approved: 'badge-green', rejected: 'badge-red' }
const STATUS_LABEL = { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối' }
const DAY_TYPE_LABEL = { full: 'Cả ngày', morning: 'Buổi sáng', afternoon: 'Buổi chiều', none: 'Không nghỉ' }
const DOW_NAMES = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']


const FIXED_HOLIDAYS = ['01-01', '04-30', '05-01', '09-02', '09-03', '11-24']

function isHoliday(date, publicHolidays) {
  const mmdd = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  if (FIXED_HOLIDAYS.includes(mmdd)) return true
  const yyyy_mm_dd = `${date.getFullYear()}-${mmdd}`
  return publicHolidays.includes(yyyy_mm_dd)
}

function isWeekend(date) {
  const day = date.getDay()
  return day === 0 || day === 6
}

function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}


function buildDayList(fromStr, toStr, publicHolidays, prevDays) {
  if (!fromStr || !toStr) return []
  const start = new Date(fromStr + 'T00:00:00')
  const end = new Date(toStr + 'T00:00:00')
  if (start > end) return []

  const prevMap = new Map((prevDays || []).map(d => [d.date, d.type]))
  const days = []
  const cursor = new Date(start)
  while (cursor <= end) {
    const iso = toISO(cursor)
    if (!isWeekend(cursor) && !isHoliday(cursor, publicHolidays)) {
      days.push({
        date: iso,
        displayDate: `${String(cursor.getDate()).padStart(2, '0')}/${String(cursor.getMonth() + 1).padStart(2, '0')}`,
        dayOfWeek: DOW_NAMES[cursor.getDay()],
        type: prevMap.get(iso) || 'full',
      })
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}


function calcLeaveEntitlement(joinDateStr) {
  if (!joinDateStr) return 12
  const join = new Date(joinDateStr + 'T00:00:00')
  const now = new Date()
  const months = (now.getFullYear() - join.getFullYear()) * 12 + (now.getMonth() - join.getMonth())
  if (months >= 12) return 12
  return Math.max(0, months)
}

function getTomorrow() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

const EMPTY_FORM = { from_date: '', to_date: '', reason: '', handover_to: '', handover_email: '', go_abroad: false }


const fieldErrorStyle = { fontStyle: 'italic', color: 'var(--red)', fontSize: 11, marginTop: 4 }

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
          background: 'var(--surface)', border: '1px solid var(--border)',
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

function DayTypeIcon({ type }) {
  const common = { width: 22, height: 22, viewBox: '0 0 30 30' }
  if (type === 'full') return <svg {...common}><circle cx="15" cy="15" r="13" fill="currentColor" /></svg>
  if (type === 'morning') return (
    <svg {...common}>
      <circle cx="15" cy="15" r="13" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M15,2 A13,13 0 0,0 15,28 Z" fill="currentColor" />
    </svg>
  )
  if (type === 'afternoon') return (
    <svg {...common}>
      <circle cx="15" cy="15" r="13" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M15,2 A13,13 0 0,1 15,28 Z" fill="currentColor" />
    </svg>
  )
  return <svg {...common}><circle cx="15" cy="15" r="13" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
}

function DayTypeModal({ days, onSetType, onClose }) {
  const TYPES = ['full', 'morning', 'afternoon', 'none']
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-title">
          <span>Chi tiết ngày nghỉ</span>
          <button className="icon-btn" onClick={onClose}><i className="fa-light fa-xmark" /></button>
        </div>

        <style>{`
          .day-modal-scroll::-webkit-scrollbar { width: 8px; }
          .day-modal-scroll::-webkit-scrollbar-track { background: transparent; }
          .day-modal-scroll::-webkit-scrollbar-thumb { background: #eaeaea; border-radius: 8px; }
          .day-modal-scroll::-webkit-scrollbar-button { display: none; width: 0; height: 0; }
          .day-modal-scroll { scrollbar-width: thin; scrollbar-color: #eaeaea transparent; }
        `}</style>
        <div className="day-modal-scroll" style={{ maxHeight: '55vh', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th></th>
                {TYPES.map(t => (
                  <th key={t} title={DAY_TYPE_LABEL[t]} style={{ padding: '6px', color: 'var(--primary)', textAlign: 'center' }}>
                    <DayTypeIcon type={t} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map(d => (
                <tr key={d.date}>
                  <td style={{ fontSize: 13, color: 'var(--text-2)', padding: '10px 8px', whiteSpace: 'nowrap' }}>
                    {d.dayOfWeek}, {d.displayDate}
                  </td>
                  {TYPES.map(t => (
                    <td key={t} style={{ textAlign: 'center', padding: '4px' }}>
                      <button
                        type="button"
                        onClick={() => onSetType(d.date, t)}
                        style={{
                          fontSize: 11, padding: '5px 8px', borderRadius: 6, cursor: 'pointer',
                          border: d.type === t ? '1px solid var(--primary)' : '1px solid var(--border)',
                          background: d.type === t ? 'var(--primary-bg)' : 'var(--surface)',
                          color: d.type === t ? 'var(--primary)' : 'var(--text-2)',
                          fontWeight: d.type === t ? 600 : 400,
                        }}
                      >
                        {DAY_TYPE_LABEL[t]}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}><i className="fa-solid fa-check" /> Xong</button>
        </div>
      </div>
    </div>
  )
}

function LeaveDetailModal({ leave, onClose }) {
  if (!leave) return null
  const fromStr = new Date(leave.from_date).toLocaleDateString('vi-VN')
  const toStr = new Date(leave.to_date).toLocaleDateString('vi-VN')
  const createdStr = new Date(leave.created_at).toLocaleString('vi-VN')
  const breakdown = Array.isArray(leave.day_breakdown) ? leave.day_breakdown : null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
    }} onClick={onClose}>
      <div style={{
        background: 'var(--surface)', borderRadius: '12px', width: '100%', maxWidth: '480px',
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
            ['Từ ngày', fromStr],
            ['Đến ngày', toStr],
            ['Số ngày nghỉ', (leave.days_count || '—') + ' ngày'],
            ['Bàn giao cho', leave.handover_to || '—'],
          ].map(([k, v]) => (
            <div key={k} style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 'var(--radius)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-2)', marginBottom: '3px' }}>{k}</div>
              <div style={{ fontWeight: 500, fontSize: '13px', wordBreak: 'break-all' }}>{v}</div>
            </div>
          ))}
        </div>

        {breakdown && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-2)', marginBottom: '6px' }}>Chi tiết ngày nghỉ</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {breakdown.map(b => (
                <span key={b.date} className="badge badge-gray" style={{ fontSize: '11px' }}>
                  {b.date.slice(8, 10)}/{b.date.slice(5, 7)} · {DAY_TYPE_LABEL[b.type] || b.type}
                </span>
              ))}
            </div>
          </div>
        )}

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

export default function LeavePage({ initialStep = 0 }) {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(initialStep) // 0: danh sách, 1: điền đơn, 2: xem lại, 3: hoàn thành
  const [form, setForm] = useState(EMPTY_FORM)
  const [days, setDays] = useState([])
  const [showDayModal, setShowDayModal] = useState(false)
  const [leaves, setLeaves] = useState([])
  const [members, setMembers] = useState([])
  const [publicHolidays, setPublicHolidays] = useState([])
  const [employeeProfile, setEmployeeProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [attempted, setAttempted] = useState(false)
  const [selectedLeave, setSelectedLeave] = useState(null)

  const tomorrow = getTomorrow()

  const totalLeave = calcLeaveEntitlement(employeeProfile?.join_date)
  const usedLeave = leaves
    .filter(l => l.status === 'approved')
    .reduce((sum, l) => sum + (Number(l.days_count) || 0), 0)
  const remainLeave = totalLeave - usedLeave
  useEffect(() => {
    setDays(prev => buildDayList(form.from_date, form.to_date, publicHolidays, prev))
  }, [form.from_date, form.to_date, publicHolidays])

  const totalRequestedDays = useMemo(() => days.reduce((sum, d) => {
    if (d.type === 'full') return sum + 1
    if (d.type === 'morning' || d.type === 'afternoon') return sum + 0.5
    return sum
  }, 0), [days])

  const isOverLimit = totalRequestedDays > remainLeave

  // Gộp các ngày liên tiếp cùng loại để hiển thị gọn ở bước Xem lại
  const dayGroups = useMemo(() => {
    const groups = []
    for (const d of days) {
      const last = groups[groups.length - 1]
      if (last && last.type === d.type) last.dates.push(d.displayDate)
      else groups.push({ type: d.type, dates: [d.displayDate] })
    }
    return groups.map(g => ({
      type: DAY_TYPE_LABEL[g.type],
      label: g.dates.length === 1 ? g.dates[0] : `${g.dates[0]} - ${g.dates[g.dates.length - 1]}`,
    }))
  }, [days])

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
    const { data } = await supabase.from('employee_profiles').select('join_date, department, position').eq('user_id', profile.id).single()
    setEmployeeProfile(data)
  }

  function handleHandoverChange(name, member) {
    setForm(p => ({ ...p, handover_to: name, handover_email: member?.email || p.handover_email }))
  }

  function setDayType(dateIso, type) {
    setDays(prev => prev.map(d => (d.date === dateIso ? { ...d, type } : d)))
  }

  function validateForm() {
    if (!form.from_date) return 'Vui lòng chọn ngày bắt đầu'
    if (!form.to_date) return 'Vui lòng chọn ngày kết thúc'
    if (form.from_date > form.to_date) return 'Đến ngày phải sau hoặc bằng ngày bắt đầu nghỉ'
    if (!form.reason.trim()) return 'Vui lòng nhập lý do nghỉ'
    if (!form.handover_to.trim()) return 'Vui lòng nhập người nhận bàn giao'
    if (days.length === 0) return 'Khoảng thời gian chọn không có ngày làm việc nào (toàn cuối tuần/ngày lễ)'
    if (isOverLimit) return `Số ngày nghỉ vượt quá số phép còn lại (${remainLeave} ngày)`
    return null
  }

  function goReview() {
    setAttempted(true)
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
      to_date: form.to_date,
      leave_type: 'custom',
      days_count: totalRequestedDays,
      day_breakdown: days.map(d => ({ date: d.date, type: d.type })),
      reason: form.reason,
      handover_to: form.handover_to,
      handover_email: form.handover_email,
      go_abroad: form.go_abroad,
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

    setSubmitting(false)
    setStep(3)
    fetchLeaves()
  }

  function backToList() {
    setForm(EMPTY_FORM)
    setDays([])
    setStep(0)
  }

  if (loading) return <div className="loading-screen" style={{ minHeight: '60vh' }}><div className="spinner" /></div>

  return (
    <div>
      <PageHeader
        title={initialStep === 1 ? 'Nghỉ phép' : 'Đơn của tôi'}
        subtitle={initialStep === 1 ? 'Gửi đơn nghỉ phép' : 'Danh sách đơn nghỉ phép đã gửi'}
        action={
          <button className="btn btn-primary" onClick={() => navigate(initialStep === 1 ? '/don-cua-toi' : '/nghi-phep')}>
            <i className="fa-light fa-file-lines" /> {initialStep === 1 ? 'Đơn của tôi' : 'Nghỉ phép'}
          </button>
        }
      />

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))', marginBottom: '1rem' }}>
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
          <div className="stat-value" style={{ color: remainLeave <= 2 ? 'var(--red)' : 'var(--primary)' }}>{remainLeave}</div>
          <div className="stat-sub">ngày</div>
        </div>
      </div>

      {step === 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-2)' }}>{leaves.length} đơn nghỉ phép</span>
            <button className="btn btn-primary" onClick={() => { setStep(1); setError(''); setAttempted(false) }} disabled={remainLeave <= 0}>
              <i className="fa-solid fa-plus" />Tạo đơn nghỉ
            </button>
          </div>
          {remainLeave <= 0 && (
            <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
              <i className="fa-solid fa-circle-exclamation" /> Bạn đã hết ngày phép năm nay.
            </div>
          )}
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead><tr>{['Thời gian nghỉ', 'Số ngày', 'Lý do', 'Trạng thái'].map(c => <th key={c}>{c}</th>)}</tr></thead>
                <tbody>
                  {leaves.length === 0
                    ? <tr><td colSpan="4"><div className="empty"><div className="empty-icon"><i className="fa-solid fa-umbrella-beach" /></div><div className="empty-text">Chưa có đơn nghỉ phép nào</div></div></td></tr>
                    : leaves.map(l => (
                      <tr key={l.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedLeave(l)}>
                        <td style={{ fontWeight: 500 }}>{new Date(l.from_date).toLocaleDateString('vi-VN')}{l.to_date !== l.from_date && ' → ' + new Date(l.to_date).toLocaleDateString('vi-VN')}</td>
                        <td>{l.days_count} ngày</td>
                        <td style={{ color: 'var(--text-2)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.reason}</td>
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

      {(step === 1 || step === 2 || step === 3) && (
        <div>
          <div className="steps">
            <div className={`step${step > 1 ? ' done' : step === 1 ? ' active' : ''}`}>
              <div className="step-circle">1</div>
              <span className="step-label">ĐIỀN ĐƠN</span>
            </div>
            <div className={`step-line${step > 1 ? ' done' : ''}`} />
            <div className={`step${step > 2 ? ' done' : step === 2 ? ' active' : ''}`}>
              <div className="step-circle">2</div>
              <span className="step-label">XEM LẠI</span>
            </div>
            <div className={`step-line${step > 2 ? ' done' : ''}`} />
            <div className={`step${step > 3 ? ' done' : step === 3 ? ' active' : ''}`}>
              <div className="step-circle">3</div>
              <span className="step-label">HOÀN THÀNH</span>
            </div>
          </div>

          {step === 1 && (
            <div className="card">
              <div className="card-title" style={{ marginBottom: '1.25rem' }}>Nhập thông tin nghỉ phép</div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Họ tên</label>
                  <div className="field-display">{profile?.full_name}</div>
                </div>
                <div className="form-group">
                  <label className="form-label">Chức vụ, chức danh</label>
                  <div className="field-display">{employeeProfile?.position || '—'}</div>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Đơn vị công tác</label>
                  <div className="field-display">{employeeProfile?.department || '—'}</div>
                </div>
                <div className="form-group">
                  <label className="form-label">Ngày bắt đầu làm việc</label>
                  <div className="field-display">{employeeProfile?.join_date ? new Date(employeeProfile.join_date).toLocaleDateString('vi-VN') : '—'}</div>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Số ngày phép được nghỉ theo quy định</label>
                  <div className="field-display">{totalLeave}</div>
                </div>
                <div className="form-group">
                  <label className="form-label">Số ngày phép đã sử dụng trong năm hiện tại</label>
                  <div className="field-display">{usedLeave}</div>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Bắt đầu nghỉ từ ngày<span className="req">*</span></label>
                  <DatePicker
                    value={form.from_date}
                    onChange={v => setForm(p => ({ ...p, from_date: v, to_date: p.to_date && p.to_date < v ? '' : p.to_date }))}
                    placeholder="DD/MM/YYYY"
                    minDate={tomorrow}
                  />
                  {attempted && !form.from_date && (
                    <div style={fieldErrorStyle}>Vui lòng chọn ngày bắt đầu nghỉ</div>
                  )}
                  {days.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowDayModal(true)}
                      style={{ marginTop: 6, fontSize: 12, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                    >
                      <i className="fa-light fa-pen" style={{ marginRight: 4 }} />
                      Anh/chị có thể chọn nghỉ buổi sáng hoặc buổi chiều tại đây
                    </button>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Đến ngày<span className="req">*</span></label>
                  <DatePicker
                    value={form.to_date}
                    onChange={v => setForm(p => ({ ...p, to_date: v }))}
                    placeholder="DD/MM/YYYY"
                    minDate={form.from_date || tomorrow}
                  />
                  {attempted && (
                    form.from_date && form.to_date && form.from_date > form.to_date
                      ? <div style={fieldErrorStyle}>Đến ngày phải sau hoặc bằng ngày bắt đầu nghỉ</div>
                      : !form.to_date && <div style={fieldErrorStyle}>Vui lòng chọn ngày kết thúc</div>
                  )}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Số ngày nghỉ lần này</label>
                  <div className={`field-display${isOverLimit ? ' error' : ''}`}>{totalRequestedDays}</div>
                  {form.from_date && form.to_date && days.length === 0 && (
                    <div style={fieldErrorStyle}>Khoảng thời gian này không có ngày làm việc (trùng lễ/cuối tuần)</div>
                  )}
                  {isOverLimit && (
                    <div style={fieldErrorStyle}>(vượt {totalRequestedDays - remainLeave} ngày so với số phép còn lại)</div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Lý do nghỉ<span className="req">*</span></label>
                  <input
                    className="form-input"
                    value={form.reason}
                    onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                    placeholder="Nhập lý do"
                    style={attempted && !form.reason.trim() ? { borderColor: 'var(--red)' } : undefined}
                  />
                  {attempted && !form.reason.trim() && (
                    <div style={fieldErrorStyle}>Vui lòng nhập lý do nghỉ</div>
                  )}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Công việc được bàn giao tạm thời cho<span className="req">*</span></label>
                  <AutocompleteInput value={form.handover_to} onChange={handleHandoverChange} members={members} placeholder="Nhập tên người bàn giao" />
                  {attempted && !form.handover_to.trim() && (
                    <div style={fieldErrorStyle}>Vui lòng nhập người bàn giao công việc</div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Email thông báo cho nhân sự bàn giao</label>
                  <input className="form-input" type="email" value={form.handover_email} onChange={e => setForm(p => ({ ...p, handover_email: e.target.value }))} placeholder="Email" />
                </div>
              </div>

              {error && <div className="alert alert-error" style={{ marginTop: 4 }}><i className="fa-solid fa-circle-exclamation" />{error}</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '1.5rem' }}>
                <button className="btn" onClick={() => setStep(0)}>Huỷ</button>
                <button className="btn btn-primary" onClick={goReview}>Tiếp tục <i className="fa-solid fa-arrow-right" /></button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="card ">
              <div className="card-narrow">
                <div className="review-block">
                <div className="review-title">Thông tin nhân viên</div>
                <div className="review-grid">
                  <div>
                    <div className="review-field-label">Họ tên</div>
                    <div className="review-field-value">{profile?.full_name}</div>
                  </div>
                  <div>
                    <div className="review-field-label">Chức vụ, chức danh</div>
                    <div className="review-field-value">{employeeProfile?.position || '—'}</div>
                  </div>
                  <div>
                    <div className="review-field-label">Đơn vị công tác</div>
                    <div className="review-field-value">{employeeProfile?.department || '—'}</div>
                  </div>
                </div>
              </div>

              <div className="review-block">
                <div className="review-title">Nội dung nghỉ phép</div>
                <div className="review-grid" style={{ marginBottom: '1rem' }}>
                  <div>
                    <div className="review-field-label">Từ ngày - Đến ngày</div>
                    <div className="review-field-value">{new Date(form.from_date).toLocaleDateString('vi-VN')} → {new Date(form.to_date).toLocaleDateString('vi-VN')}</div>
                  </div>
                  <div>
                    <div className="review-field-label">Số ngày nghỉ lần này</div>
                    <div className="review-field-value">{totalRequestedDays} ngày</div>
                  </div>
                </div>

                <div className="review-field-label" style={{ marginBottom: '6px' }}>Chi tiết ngày nghỉ</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '1rem' }}>
                  {dayGroups.map((g, i) => (
                    <div key={i} className="review-day-row">
                      <span>{g.label}</span>
                      <span className="review-day-type">{g.type}</span>
                    </div>
                  ))}
                </div>

                <div className="review-grid">
                  <div>
                    <div className="review-field-label">Lý do nghỉ</div>
                    <div className="review-field-value">{form.reason}</div>
                  </div>
                  <div>
                    <div className="review-field-label">Bàn giao công việc cho</div>
                    <div className="review-field-value">{form.handover_to}</div>
                  </div>
                </div>
              </div>

              {error && <div className="alert alert-error" style={{ marginTop: '1rem' }}>{error}</div>}
              <div className="review-actions">
                <button className="btn" onClick={() => setStep(1)}>Quay lại</button>
                <button className="btn btn-primary" onClick={submit} disabled={submitting}>
                  <i className="fa-solid fa-paper-plane" />
                  {submitting ? 'Đang gửi...' : 'Gửi đơn'}
                </button>
              </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--green-bg)', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 1.25rem' }}>
                <i className="fa-solid fa-check" />
              </div>
              <h3 style={{ marginBottom: 8 }}>Gửi đơn nghỉ phép thành công!</h3>
              <p style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: '1.5rem' }}>Đơn của bạn đã được gửi và đang chờ phê duyệt.</p>
              <button className="btn btn-primary" onClick={backToList}>Về danh sách đơn</button>
            </div>
          )}
        </div>
      )}

      {showDayModal && (
        <DayTypeModal days={days} onSetType={setDayType} onClose={() => setShowDayModal(false)} />
      )}

      <LeaveDetailModal leave={selectedLeave} onClose={() => setSelectedLeave(null)} />
    </div>
  )
}