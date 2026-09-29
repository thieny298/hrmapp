import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { performCheckIn } from '../lib/checkin'

function initials(name = '') { return name.split(' ').slice(-2).map(w => w[0]).join('').toUpperCase() }

function localDate(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function firstOfMonth(d = new Date()) { return new Date(d.getFullYear(), d.getMonth(), 1) }

const navBtnStyle = { width: '32px', height: '32px', minWidth: 0, padding: 0, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }

function StatusBadge({ status, lateMinutes }) {
  if (status === 'leave') return <span className="badge badge-blue">Nghỉ phép</span>
  if (status === 'absent') return <span className="badge badge-gray">Chưa chấm công</span>
  if (status === 'late') return <span className="badge badge-amber">Trễ {lateMinutes} phút</span>
  return <span className="badge badge-green">Đúng giờ</span>
}

function TableMessage({ colSpan, children }) {
  return <tr><td colSpan={colSpan}><div className="empty">{children}</div></td></tr>
}

export default function DashboardPage() {
  const { profile } = useAuth()
  const [todayRecord, setTodayRecord] = useState(null)
  const [recordLoading, setRecordLoading] = useState(true)
  const [attendanceOverview, setAttendanceOverview] = useState([])
  const [overviewLoading, setOverviewLoading] = useState(false)
  const [checkingIn, setCheckingIn] = useState(false)
  const [checkInError, setCheckInError] = useState(null)
  const [month, setMonth] = useState(firstOfMonth())
  const [summary, setSummary] = useState([])
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState(null)

  const userId = profile?.id
  const role = profile?.role
  const today = localDate()
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối'
  const canViewCompany = ['admin', 'ceo'].includes(role)
  const isCeo = role === 'ceo'
  const isCurrentMonth = month.getTime() === firstOfMonth().getTime()

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
        supabase.from('attendance_logs').select('user_id, check_in, status, late_minutes').eq('date', today),
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
            status: att ? att.status : leaveUserIds.has(e.user_id) ? 'leave' : 'absent',
            late_minutes: att?.late_minutes || 0,
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

  if (!profile) return <div className="loading-screen" style={{ minHeight: '60vh' }}><div className="spinner" /></div>

  const checkedInCount = attendanceOverview.filter(a => a.check_in).length
  const lateCount = attendanceOverview.filter(a => a.status === 'late').length
  const absentCount = attendanceOverview.filter(a => a.status === 'absent').length
  const leaveCount = attendanceOverview.filter(a => a.status === 'leave').length
  const monthLabel = `Tháng ${month.getMonth() + 1}/${month.getFullYear()}`
  const statValue = v => overviewLoading ? '…' : v

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
              {isCeo || todayRecord ? 'Chúc bạn một ngày làm việc suôn sẻ 😊' : 'Đừng quên chấm công hôm nay nhé!'}
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
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.15)', padding: '8px 14px', borderRadius: 'var(--radius)' }}>
                <i className="fa-solid fa-circle-check" style={{ color: '#fff' }} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>
                    Đã chấm công lúc {todayRecord.check_in}
                  </div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>
                    {todayRecord.status === 'late' ? `Đi trễ ${todayRecord.late_minutes} phút` : 'Đúng giờ ✓'}
                  </div>
                </div>
              </div>
            )
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
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {overviewLoading
                    ? <TableMessage colSpan="4"><div className="spinner" /></TableMessage>
                    : attendanceOverview.length === 0
                      ? <TableMessage colSpan="4"><div className="empty-text">Chưa có dữ liệu</div></TableMessage>
                      : attendanceOverview.map((a, i) => (
                        <tr key={i}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div className="avatar avatar-sm">{initials(a.full_name)}</div>
                              <span style={{ fontWeight: 500 }}>{a.full_name}</span>
                            </div>
                          </td>
                          <td style={{ color: 'var(--text-2)' }}>{a.department}</td>
                          <td style={{ color: 'var(--text-2)' }}>{a.check_in || '—'}</td>
                          <td><StatusBadge status={a.status} lateMinutes={a.late_minutes} /></td>
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
                          <tr key={s.user_id}>
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
        </>
      )}
    </div>
  )
}