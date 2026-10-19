import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { performCheckIn, performCheckOut, canCheckOut } from '../lib/checkin'

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

function initials(name = '') { return name.split(' ').slice(-2).map(w => w[0]).join('').toUpperCase() }

function localDate(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function firstOfMonth(d = new Date()) { return new Date(d.getFullYear(), d.getMonth(), 1) }

const navBtnStyle = { width: '32px', height: '32px', minWidth: 0, padding: 0, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }

const infoBoxStyle = { padding: '10px 12px', background: 'var(--bg)', borderRadius: 'var(--radius)' }

function StatusBadge({ status, lateMinutes, type, note }) {
  if (status === 'leave') return <span className="badge badge-blue">Nghỉ phép</span>
  if (status === 'absent') return <span className="badge badge-gray">Chưa chấm công</span>
  if (type === 'remote') return <span className="badge badge-green">{note || 'WFH'}</span>
  if (status === 'late') return <span className="badge badge-amber">Trễ {lateMinutes} phút</span>
  return <span className="badge badge-green">Đúng giờ</span>
}

function TableMessage({ colSpan, children }) {
  return <tr><td colSpan={colSpan}><div className="empty">{children}</div></td></tr>
}

function EmployeeAttendanceModal({ employee, month, monthLabel, onClose }) {
  const [records, setRecords] = useState([])
  const [leaveDates, setLeaveDates] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(null)

  const year = month.getFullYear()
  const m = month.getMonth()
  const daysInMonth = new Date(year, m + 1, 0).getDate()
  const firstDay = new Date(year, m, 1).getDay()
  const from = localDate(new Date(year, m, 1))
  const to = localDate(new Date(year, m, daysInMonth))
  const today = localDate()

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setSelectedDate(null)
      try {
        const [attRes, leaveRes] = await Promise.all([
          supabase.from('attendance_logs').select('date, check_in, check_out, status, late_minutes, type, note')
            .eq('user_id', employee.user_id).gte('date', from).lte('date', to),
          supabase.from('leave_requests').select('from_date, to_date')
            .eq('user_id', employee.user_id).eq('status', 'approved').lte('from_date', to).gte('to_date', from),
        ])
        if (!active) return
        const dates = new Set()
        ;(leaveRes.data || []).forEach(l => {
          const d = new Date(String(l.from_date).slice(0, 10) + 'T00:00:00')
          const end = new Date(String(l.to_date).slice(0, 10) + 'T00:00:00')
          while (d <= end) {
            dates.add(localDate(d))
            d.setDate(d.getDate() + 1)
          }
        })
        setRecords(attRes.data || [])
        setLeaveDates(dates)
      } catch (err) {
        console.error('fetchEmployeeAttendance error:', err)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [employee.user_id, from, to])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const recordMap = {}
  records.forEach(r => { recordMap[r.date] = r })

  function dayInfo(dateStr) {
    const dow = new Date(dateStr + 'T00:00:00').getDay()
    const rec = recordMap[dateStr]
    if (rec?.type === 'remote') return { cls: 'normal', label: rec.note || 'WFH', rec }
    if (rec?.status === 'late') return { cls: 'late', label: `Đi trễ ${rec.late_minutes} phút`, rec }
    if (rec?.status === 'present') return { cls: 'normal', label: 'Đúng giờ', rec }
    if (rec?.status === 'leave') return { cls: 'leave', label: 'Nghỉ phép', rec }
    if (dow === 0 || dow === 6) return { cls: 'absent', label: 'Cuối tuần', rec, weekend: true }
    if (leaveDates.has(dateStr)) return { cls: 'leave', label: 'Nghỉ phép', rec }
    if (dateStr > today) return { cls: 'absent', label: '', rec, future: true }
    return { cls: 'absent', label: 'Chưa chấm công', rec, missing: true }
  }

  function checkOutLabel(rec) {
    if (!rec?.check_in || rec.type === 'remote') return '—'
    return rec.check_out || 'Chưa chấm giờ về'
  }

  const selectedInfo = selectedDate ? dayInfo(selectedDate) : null

  const stats = [
    ['Ngày đi làm', <><span style={{ fontWeight: 600 }}>{employee.present_days}</span><span style={{ color: 'var(--text-2)' }}>/{employee.work_days}</span></>],
    ['Đúng giờ', <span style={{ color: 'var(--green)', fontWeight: 600 }}>{employee.on_time_days}</span>],
    ['Đi trễ', employee.late_days > 0 ? <span style={{ color: 'var(--amber)', fontWeight: 600 }}>{employee.late_days} lần · {employee.late_minutes}p</span> : <span style={{ fontWeight: 600 }}>0</span>],
    ['Chưa chấm', <span style={{ fontWeight: 600 }}>{employee.missing_days}</span>],
  ]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '560px', width: '100%', maxHeight: '92vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="modal-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="avatar avatar-sm">{initials(employee.full_name)}</div>
            <div>
              <div style={{ fontWeight: 600 }}>{employee.full_name}</div>
              <div style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-2)' }}>{employee.department} · {monthLabel}</div>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}><i className="fa-light fa-xmark" /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px', marginBottom: '14px' }}>
          {stats.map(([k, v]) => (
            <div key={k} style={infoBoxStyle}>
              <div style={{ fontSize: '11px', color: 'var(--text-2)', marginBottom: '4px' }}>{k}</div>
              <div style={{ fontSize: '14px' }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '14px', marginBottom: '10px', flexWrap: 'wrap' }}>
          {[['#f0fdf4', 'Đúng giờ'], ['var(--red-light)', 'Đi trễ'], ['var(--orange-light)', 'Nghỉ phép'], ['var(--gray-bg)', 'Chưa chấm / T7 CN']].map(([bg, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-2)' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: bg, border: '1px solid var(--border)' }} />
              {label}
            </div>
          ))}
        </div>

        {loading
          ? <div className="empty"><div className="spinner" /></div>
          : <div className="attendance-calendar">
              {WEEKDAYS.map(d => <div key={d} className="cal-header">{d}</div>)}
              {Array(firstDay).fill(null).map((_, i) => <div key={'e' + i} className="cal-day empty" />)}
              {Array(daysInMonth).fill(null).map((_, i) => {
                const day = i + 1
                const dateStr = localDate(new Date(year, m, day))
                const info = dayInfo(dateStr)
                const rec = info.rec
                const isToday = dateStr === today
                const isSelected = dateStr === selectedDate
                const style = {
                  cursor: info.future ? 'default' : 'pointer',
                  ...(info.future ? { opacity: 0.45 } : {}),
                  ...(isToday ? { border: '2px solid var(--primary)', borderRadius: 'var(--radius)' } : {}),
                  ...(isSelected ? { outline: '2px solid var(--primary)', outlineOffset: '-2px' } : {}),
                }

                return (
                  <div key={day} className={`cal-day ${info.cls}`} style={style} onClick={() => !info.future && setSelectedDate(dateStr)}>
                    <div className="cal-day-num" style={isToday ? { color: 'var(--primary)' } : {}}>{day}</div>
                    {rec?.type === 'remote' && <div className="cal-day-status">WFH</div>}
                    {rec?.check_in && rec.type !== 'remote' && (
                      <div className="cal-day-status">
                        {rec.check_in}
                        {rec.check_out && <div>{rec.check_out}</div>}
                        {rec.status === 'late' && <div style={{ color: 'var(--red)', fontSize: '10px' }}>+{rec.late_minutes}p</div>}
                      </div>
                    )}
                    {info.cls === 'leave' && !rec?.check_in && <div className="cal-day-status">Nghỉ</div>}
                    {info.weekend && !rec && <div className="cal-day-status" style={{ color: 'var(--text-3)' }}>—</div>}
                    {info.missing && <div className="cal-day-status" style={{ color: 'var(--text-3)' }}><i className="fa-light fa-xmark" /></div>}
                  </div>
                )
              })}
            </div>
        }

        {selectedInfo && (
          <div style={{ marginTop: '14px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
              {[
                ['Giờ vào', selectedInfo.rec?.type === 'remote' ? '—' : selectedInfo.rec?.check_in || '—'],
                ['Giờ về', checkOutLabel(selectedInfo.rec)],
                ['Trạng thái', selectedInfo.label || '—'],
              ].map(([k, v]) => (
                <div key={k} style={infoBoxStyle}>
                  <div style={{ fontSize: '11px', color: 'var(--text-2)', marginBottom: '4px' }}>{k}</div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: v === 'Chưa chấm giờ về' ? 'var(--text-2)' : 'inherit' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { profile } = useAuth()
  const [clock, setClock] = useState(() => new Date())
  const [todayRecord, setTodayRecord] = useState(null)
  const [recordLoading, setRecordLoading] = useState(true)
  const [attendanceOverview, setAttendanceOverview] = useState([])
  const [overviewLoading, setOverviewLoading] = useState(false)
  const [checkingIn, setCheckingIn] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [checkInError, setCheckInError] = useState(null)
  const [month, setMonth] = useState(firstOfMonth())
  const [summary, setSummary] = useState([])
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState(null)
  const [detailUser, setDetailUser] = useState(null)

  const userId = profile?.id
  const role = profile?.role
  const today = localDate()
  const hour = clock.getHours()
  const greeting = hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối'
  const canViewCompany = ['admin', 'ceo'].includes(role)
  const isCeo = role === 'ceo'
  const isCurrentMonth = month.getTime() === firstOfMonth().getTime()
  const isRemoteToday = todayRecord?.type === 'remote'
  const showCheckOut = canCheckOut(todayRecord, clock)

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!userId) return
    fetchTodayRecord()
    if (canViewCompany) fetchOverview()
  }, [userId, role])

  useEffect(() => {
    if (userId && canViewCompany) fetchSummary()
  }, [userId, canViewCompany, month])

  async function fetchTodayRecord() {
    setRecordLoading(true)
    try {
      const { data } = await supabase.from('attendance_logs').select('*').eq('user_id', userId).eq('date', today).maybeSingle()
      setTodayRecord(data || null)
    } catch (err) {
      console.error('fetchTodayRecord error:', err)
    } finally {
      setRecordLoading(false)
    }
  }

  async function fetchOverview() {
    setOverviewLoading(true)
    try {
      const [employeesRes, attendRes, leaveRes] = await Promise.all([
        supabase.from('employee_profiles').select('user_id, full_name, department').eq('status', 'active').not('user_id', 'is', null),
        supabase.from('attendance_logs').select('user_id, check_in, check_out, status, late_minutes, type, note').eq('date', today),
        supabase.from('leave_requests').select('user_id').eq('status', 'approved').lte('from_date', today).gte('to_date', today),
      ])

      const employees = employeesRes.data || []
      const attendMap = new Map((attendRes.data || []).map(a => [a.user_id, a]))
      const leaveUserIds = new Set((leaveRes.data || []).map(l => l.user_id))

      const userIds = employees.map(e => e.user_id).filter(Boolean)
      let roleMap = new Map()
      if (userIds.length) {
        const { data: roles } = await supabase.from('user_profiles').select('id, role').in('id', userIds)
        roleMap = new Map((roles || []).map(r => [r.id, r.role]))
      }

      setAttendanceOverview(employees
        .filter(e => roleMap.get(e.user_id) !== 'ceo')
        .map(e => {
          const att = attendMap.get(e.user_id)
          return {
            full_name: e.full_name,
            department: e.department,
            check_in: att?.check_in || null,
            check_out: att?.check_out || null,
            status: att ? att.status : leaveUserIds.has(e.user_id) ? 'leave' : 'absent',
            late_minutes: att?.late_minutes || 0,
            type: att?.type || null,
            note: att?.note || null,
          }
        }))
    } catch (err) {
      console.error('fetchOverview error:', err)
    } finally {
      setOverviewLoading(false)
    }
  }

  async function fetchSummary() {
    setSummaryLoading(true)
    setSummaryError(null)
    try {
      const { data, error } = await supabase.rpc('get_attendance_summary', { p_month: localDate(month) })
      if (error) throw error
      setSummary(data || [])
    } catch (err) {
      console.error('fetchSummary error:', err)
      setSummary([])
      setSummaryError('Không tải được dữ liệu tổng hợp')
    } finally {
      setSummaryLoading(false)
    }
  }

  function shiftMonth(step) {
    const next = new Date(month.getFullYear(), month.getMonth() + step, 1)
    if (next.getTime() > firstOfMonth().getTime()) return
    setMonth(next)
  }

  async function handleCheckIn() {
    setCheckingIn(true)
    setCheckInError(null)
    try {
      const result = await performCheckIn()
      if (!result.success) {
        setCheckInError(result.error)
        return
      }
      setTodayRecord(result.record)
      if (canViewCompany) {
        fetchOverview()
        if (isCurrentMonth) fetchSummary()
      }
    } catch (err) {
      setCheckInError('Lỗi kết nối, vui lòng thử lại')
    } finally {
      setCheckingIn(false)
    }
  }

  async function handleCheckOut() {
    setCheckingOut(true)
    setCheckInError(null)
    try {
      const result = await performCheckOut()
      if (!result.success) {
        setCheckInError(result.error)
        return
      }
      setTodayRecord(result.record)
      if (canViewCompany) fetchOverview()
    } catch (err) {
      setCheckInError('Lỗi kết nối, vui lòng thử lại')
    } finally {
      setCheckingOut(false)
    }
  }

  if (!profile) return <div className="loading-screen" style={{ minHeight: '60vh' }}><div className="spinner" /></div>

  const checkedInCount = attendanceOverview.filter(a => a.check_in).length
  const lateCount = attendanceOverview.filter(a => a.status === 'late' && a.type !== 'remote').length
  const absentCount = attendanceOverview.filter(a => a.status === 'absent').length
  const leaveCount = attendanceOverview.filter(a => a.status === 'leave').length
  const monthLabel = `Tháng ${month.getMonth() + 1}/${month.getFullYear()}`
  const statValue = v => overviewLoading ? '…' : v

  const checkedBlock = todayRecord && (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.15)', padding: '8px 14px', borderRadius: 'var(--radius)' }}>
      <i className="fa-solid fa-circle-check" style={{ color: '#fff' }} />
      <div>
        <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>
          Vào lúc {todayRecord.check_in}{todayRecord.check_out ? ` · Về lúc ${todayRecord.check_out}` : ''}
        </div>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>
          {todayRecord.status === 'late' ? `Đi trễ ${todayRecord.late_minutes} phút` : 'Đúng giờ ✓'}
        </div>
      </div>
    </div>
  )

  return (
    <div>
      <PageHeader title="Tổng quan" subtitle="Xem nhanh tình hình làm việc hôm nay" />

      <div className="card" style={{ marginBottom: '1rem', background: 'var(--primary)', border: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: '600', color: '#fff', marginBottom: '4px' }}>
              {greeting}, {profile.full_name?.split(' ').pop() || profile.full_name || 'bạn'}! 👋
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
              {isRemoteToday
                ? 'Hôm nay bạn làm việc tại nhà, không cần chấm công nhé!'
                : showCheckOut
                  ? 'Đừng quên chấm công về trước khi rời văn phòng nhé!'
                  : isCeo || todayRecord ? 'Chúc bạn một ngày làm việc suôn sẻ 😊' : 'Đừng quên chấm công hôm nay nhé!'}
            </div>
          </div>

          {!isCeo && (
            !todayRecord ? (
              <button
                className="btn"
                onClick={handleCheckIn}
                disabled={checkingIn || recordLoading}
                style={{ background: '#fff', color: 'var(--primary)', border: 'none', fontWeight: '600', padding: '10px 20px' }}
              >
                <i className="fa-light fa-right-to-bracket" />
                {recordLoading ? 'Đang tải...' : checkingIn ? 'Đang chấm công...' : 'Chấm công ngay'}
              </button>
            ) : isRemoteToday ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.15)', padding: '8px 14px', borderRadius: 'var(--radius)' }}>
                <i className="fa-light fa-house-laptop" style={{ color: '#fff' }} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>
                    {todayRecord.note || 'WFH'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>
                    Đã tính công · Đúng giờ ✓
                  </div>
                </div>
              </div>
            ) : showCheckOut ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {checkedBlock}
                <button
                  className="btn"
                  onClick={handleCheckOut}
                  disabled={checkingOut}
                  style={{ background: '#fff', color: 'var(--primary)', border: 'none', fontWeight: '600', padding: '10px 20px' }}
                >
                  <i className="fa-light fa-right-from-bracket" />
                  {checkingOut ? 'Đang chấm công...' : 'Chấm công về'}
                </button>
              </div>
            ) : checkedBlock
          )}
        </div>
      </div>

      {checkInError && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          <i className="fa-light fa-triangle-exclamation" /> Chấm công không thành công: {checkInError}
        </div>
      )}

      {canViewCompany && (
        <>
          <div className="stats-grid" style={{ marginBottom: '1rem' }}>
            <div className="stat-card">
              <div className="stat-label">Đã chấm công</div>
              <div className="stat-value" style={{ color: 'var(--green)' }}>{statValue(`${checkedInCount}/${attendanceOverview.length}`)}</div>
              <div className="stat-sub">Trên tổng số nhân viên</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Đi trễ</div>
              <div className="stat-value" style={{ color: 'var(--amber)' }}>{statValue(lateCount)}</div>
              <div className="stat-sub">Hôm nay</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Nghỉ phép</div>
              <div className="stat-value" style={{ color: 'var(--blue-text)' }}>{statValue(leaveCount)}</div>
              <div className="stat-sub">Đang nghỉ hôm nay</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Chưa chấm công</div>
              <div className="stat-value" style={{ color: 'var(--text-2)' }}>{statValue(absentCount)}</div>
              <div className="stat-sub">Chưa check-in</div>
            </div>
          </div>

          <div className="card" style={{ padding: 0, marginBottom: '1rem' }}>
            <div style={{ padding: '14px 18px', fontWeight: 600, fontSize: '14px', borderBottom: '1px solid var(--border)' }}>
              Chấm công hôm nay
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nhân viên</th>
                    <th>Phòng ban</th>
                    <th>Giờ vào</th>
                    <th>Giờ về</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {overviewLoading
                    ? <TableMessage colSpan="5"><div className="spinner" /></TableMessage>
                    : attendanceOverview.length === 0
                      ? <TableMessage colSpan="5"><div className="empty-text">Chưa có dữ liệu</div></TableMessage>
                      : attendanceOverview.map((a, i) => (
                        <tr key={i}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div className="avatar avatar-sm">{initials(a.full_name)}</div>
                              <span style={{ fontWeight: 500 }}>{a.full_name}</span>
                            </div>
                          </td>
                          <td style={{ color: 'var(--text-2)' }}>{a.department}</td>
                          <td style={{ color: 'var(--text-2)' }}>{a.type === 'remote' ? 'WFH' : a.check_in || '—'}</td>
                          <td style={{ color: 'var(--text-2)' }}>{a.type === 'remote' ? '—' : a.check_out || '—'}</td>
                          <td><StatusBadge status={a.status} lateMinutes={a.late_minutes} type={a.type} note={a.note} /></td>
                        </tr>
                      ))
                  }
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>Tổng hợp chấm công</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button className="btn" onClick={() => shiftMonth(-1)} aria-label="Tháng trước" style={navBtnStyle}>
                  <i className="fa-light fa-chevron-left" />
                </button>
                <span style={{ fontSize: '13px', fontWeight: 500, minWidth: '96px', textAlign: 'center' }}>{monthLabel}</span>
                <button className="btn" onClick={() => shiftMonth(1)} disabled={isCurrentMonth} aria-label="Tháng sau" style={{ ...navBtnStyle, opacity: isCurrentMonth ? 0.4 : 1 }}>
                  <i className="fa-light fa-chevron-right" />
                </button>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nhân viên</th>
                    <th>Phòng ban</th>
                    <th>Ngày đi làm</th>
                    <th>Đúng giờ</th>
                    <th>Đi trễ</th>
                    <th>Chưa chấm công</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryLoading
                    ? <TableMessage colSpan="6"><div className="spinner" /></TableMessage>
                    : summaryError
                      ? <TableMessage colSpan="6"><div className="empty-text">{summaryError}</div></TableMessage>
                      : summary.length === 0
                        ? <TableMessage colSpan="6"><div className="empty-text">Chưa có dữ liệu tháng này</div></TableMessage>
                        : summary.map(s => (
                          <tr key={s.user_id} onClick={() => setDetailUser(s)} style={{ cursor: 'pointer' }} title="Xem chi tiết chấm công">
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div className="avatar avatar-sm">{initials(s.full_name)}</div>
                                <span style={{ fontWeight: 500 }}>{s.full_name}</span>
                              </div>
                            </td>
                            <td style={{ color: 'var(--text-2)' }}>{s.department}</td>
                            <td><span style={{ fontWeight: 600 }}>{s.present_days}</span><span style={{ color: 'var(--text-2)' }}>/{s.work_days}</span></td>
                            <td style={{ color: 'var(--green)', fontWeight: 500 }}>{s.on_time_days}</td>
                            <td>
                              {s.late_days > 0
                                ? <span className="badge badge-amber">{s.late_days} lần · {s.late_minutes} phút</span>
                                : <span style={{ color: 'var(--text-2)' }}>0</span>}
                            </td>
                            <td>
                              {s.missing_days > 0
                                ? <span className="badge badge-gray">{s.missing_days} ngày</span>
                                : <span style={{ color: 'var(--text-2)' }}>0</span>}
                            </td>
                          </tr>
                        ))
                  }
                </tbody>
              </table>
            </div>
          </div>

          {detailUser && (
            <EmployeeAttendanceModal
              employee={detailUser}
              month={month}
              monthLabel={monthLabel}
              onClose={() => setDetailUser(null)}
            />
          )}
        </>
      )}
    </div>
  )
}
