import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext.jsx'
import PageHeader from '../components/PageHeader.jsx'

function initials(name = '') { return name.split(' ').slice(-2).map(w => w[0]).join('').toUpperCase() }

export default function DashboardPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [todayRecord, setTodayRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [attendanceOverview, setAttendanceOverview] = useState([])
  const [leaveToday, setLeaveToday] = useState([])

  const today = new Date().toISOString().slice(0, 10)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối'
  const isManagerLevel = ['admin', 'ceo', 'manager'].includes(profile?.role)

  useEffect(() => { fetchData() }, [profile])

  async function fetchData() {
    if (!profile?.id) return
    setLoading(true)

    const { data: attendRes } = await supabase.from('attendance_logs').select('*').eq('user_id', profile.id).eq('date', today).maybeSingle()
    setTodayRecord(attendRes || null)

    if (isManagerLevel) {
      await fetchOverview()
    }

    setLoading(false)
  }

  async function fetchOverview() {
    const [employeesRes, attendRes, leaveRes] = await Promise.all([
      supabase.from('employee_profiles').select('user_id, full_name, department').eq('status', 'active').not('user_id', 'is', null),
      supabase.from('attendance_logs').select('user_id, check_in, status, late_minutes').eq('date', today),
      supabase.from('leave_requests').select('user_id, leave_type, from_date, to_date').eq('status', 'approved').lte('from_date', today).gte('to_date', today),
    ])

    const employees = employeesRes.data || []
    const attendMap = new Map((attendRes.data || []).map(a => [a.user_id, a]))
    const leaveUserIds = new Set((leaveRes.data || []).map(l => l.user_id))

    const merged = employees.map(e => {
      const att = attendMap.get(e.user_id)
      const onLeave = leaveUserIds.has(e.user_id)
      return {
        full_name: e.full_name,
        department: e.department,
        check_in: att?.check_in || null,
        status: onLeave ? 'leave' : att ? att.status : 'absent',
        late_minutes: att?.late_minutes || 0,
      }
    })

    setAttendanceOverview(merged)

    const { data: userProfiles } = await supabase.from('user_profiles').select('id, full_name')
    const nameMap = new Map((userProfiles || []).map(u => [u.id, u.full_name]))
    setLeaveToday((leaveRes.data || []).map(l => ({ ...l, full_name: nameMap.get(l.user_id) || 'Nhân viên' })))
  }

  if (loading) return <div className="loading-screen" style={{ minHeight: '60vh' }}><div className="spinner" /></div>

  const checkedInCount = attendanceOverview.filter(a => a.check_in).length
  const lateCount = attendanceOverview.filter(a => a.status === 'late').length
  const absentCount = attendanceOverview.filter(a => a.status === 'absent').length
  const leaveCount = attendanceOverview.filter(a => a.status === 'leave').length

  return (
    <div>
      <PageHeader title="Tổng quan" subtitle="Xem nhanh tình hình làm việc hôm nay" />

      <div className="card" style={{ marginBottom: '1rem', background: 'var(--primary)', border: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: '600', color: '#fff', marginBottom: '4px' }}>
              {greeting}, {profile?.full_name?.split(' ').pop() || profile?.full_name || 'bạn'}! 👋
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
              {todayRecord
                ? 'Chúc bạn một ngày làm việc suôn sẻ 😊'
                : 'Đừng quên chấm công hôm nay nhé!'
              }
            </div>
          </div>

          {!todayRecord ? (
            <button
              className="btn"
              onClick={() => navigate('/cham-cong')}
              style={{ background: '#fff', color: 'var(--primary)', border: 'none', fontWeight: '600', padding: '10px 20px' }}
            >
              <i className="fa-light fa-right-to-bracket" />
              Chấm công ngay
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
          )}
        </div>
      </div>

      {isManagerLevel && (
        <>
          <div className="stats-grid" style={{ marginBottom: '1rem' }}>
            <div className="stat-card">
              <div className="stat-label">Đã chấm công</div>
              <div className="stat-value" style={{ color: 'var(--green)' }}>{checkedInCount}/{attendanceOverview.length}</div>
              <div className="stat-sub">Trên tổng số nhân viên</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Đi trễ</div>
              <div className="stat-value" style={{ color: 'var(--amber)' }}>{lateCount}</div>
              <div className="stat-sub">Hôm nay</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Nghỉ phép</div>
              <div className="stat-value" style={{ color: 'var(--blue-text)' }}>{leaveCount}</div>
              <div className="stat-sub">Đang nghỉ hôm nay</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Chưa chấm công</div>
              <div className="stat-value" style={{ color: 'var(--text-2)' }}>{absentCount}</div>
              <div className="stat-sub">Chưa check-in</div>
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
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
                  {attendanceOverview.length === 0
                    ? <tr><td colSpan="4"><div className="empty"><div className="empty-text">Chưa có dữ liệu</div></div></td></tr>
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
                        <td>
                          {a.status === 'leave' && <span className="badge badge-blue">Nghỉ phép</span>}
                          {a.status === 'late' && <span className="badge badge-amber">Trễ {a.late_minutes} phút</span>}
                          {a.status === 'on_time' && <span className="badge badge-green">Đúng giờ</span>}
                          {a.status === 'absent' && <span className="badge badge-gray">Chưa chấm công</span>}
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
