import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext.jsx'

export default function DashboardPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [todayRecord, setTodayRecord] = useState(null)
  const [taskStats, setTaskStats] = useState({ running: 0, pending: 0, ended: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [latePopup, setLatePopup] = useState(null)

  const today = new Date().toISOString().slice(0, 10)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối'

  useEffect(() => { fetchData() }, [profile])

  async function fetchData() {
    if (!profile?.id) return
    setLoading(true)
    const [attendRes, taskRes] = await Promise.all([
      supabase.from('attendance').select('*').eq('user_id', profile.id).eq('date', today).single(),
      supabase.from('tasks').select('status').eq('assigned_to', profile.id),
    ])
    setTodayRecord(attendRes.data || null)

    const tasks = taskRes.data || []
    setTaskStats({
      running: tasks.filter(t => t.status === 'doing').length,
      pending: tasks.filter(t => t.status === 'todo' || t.status === 'review').length,
      ended: tasks.filter(t => t.status === 'done').length,
      total: tasks.length,
    })
    setLoading(false)
  }

  async function handleCheckIn() {
    setChecking(true)
    const now = new Date()
    const hh = now.getHours()
    const mm = now.getMinutes()
    const totalMinutes = hh * 60 + mm
    const startMinutes = 8 * 60 // 08:00

    let checkInTime, status, lateMinutes = 0

    if (totalMinutes <= startMinutes) {
      checkInTime = '08:00'
      status = 'present'
    } else {
      checkInTime = `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`
      status = 'late'
      lateMinutes = totalMinutes - startMinutes
    }

    const { error } = await supabase.from('attendance').insert({
      user_id: profile.id,
      date: today,
      check_in: checkInTime,
      status,
      late_minutes: lateMinutes,
    })

    if (!error) {
      if (status === 'late') setLatePopup(lateMinutes)
      fetchData()
    }
    setChecking(false)
  }

  if (loading) return <div className="loading-screen" style={{ minHeight: '60vh' }}><div className="spinner" /></div>

  const STAT_CARDS = [
    { label: 'Dự án đang triển khai', value: taskStats.running, icon: 'fa-rocket', color: 'var(--blue-text)', bg: 'var(--blue-bg)', sub: 'Tăng so với tháng trước' },
    { label: 'Dự án đang chờ xử lý', value: taskStats.pending, icon: 'fa-clock', color: 'var(--amber)', bg: 'var(--amber-bg)', sub: 'Đang thảo luận' },
    { label: 'Dự án đã kết thúc', value: taskStats.ended, icon: 'fa-circle-check', color: 'var(--green)', bg: 'var(--green-bg)', sub: 'Đã hoàn thành' },
    { label: 'Tổng số dự án', value: taskStats.total, icon: 'fa-chart-pie', color: 'var(--primary)', bg: 'var(--primary-bg)', sub: 'Tất cả dự án' },
  ]

  return (
    <div>
      {/* Late popup */}
      {latePopup && (
        <div className="modal-overlay" onClick={() => setLatePopup(null)}>
          <div className="modal" style={{ maxWidth: '360px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>⏰</div>
            <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>Bạn đã đi trễ {latePopup} phút</div>
            <div style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '1.5rem' }}>Hãy cố gắng đúng giờ hơn vào ngày mai nhé!</div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setLatePopup(null)}>Đã hiểu</button>
          </div>
        </div>
      )}

      {/* Greeting card */}
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
              onClick={handleCheckIn}
              disabled={checking}
              style={{ background: '#fff', color: 'var(--primary)', border: 'none', fontWeight: '600', padding: '10px 20px' }}
            >
              <i className="fa-light fa-right-to-bracket" />
              {checking ? 'Đang xử lý...' : 'Chấm công vào'}
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

      {/* Stats */}
      <div className="stats-grid">
        {STAT_CARDS.map(c => (
          <div key={c.label} className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/tasks')}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div className="stat-label">{c.label}</div>
              <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius)', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className={`fa-light ${c.icon}`} style={{ color: c.color, fontSize: '14px' }} />
              </div>
            </div>
            <div className="stat-value" style={{ color: c.color }}>{c.value}</div>
            <div className="stat-sub">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Quick links */}

    </div>
  )
}
