import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext.jsx'

const TASK_STATUS = { todo: 'Cần làm', doing: 'Đang làm', review: 'Chờ duyệt', done: 'Hoàn thành' }
const STATUS_BADGE = { todo: 'badge-gray', doing: 'badge-blue', review: 'badge-amber', done: 'badge-green' }

export default function DashboardPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({ employees: 0, tasks: 0, tasks_done: 0, customers: 0, tasks_high: 0 })
  const [recentTasks, setRecentTasks] = useState([])
  const [deptStats, setDeptStats] = useState([])
  const [loading, setLoading] = useState(true)
  const isAdmin = profile?.role === 'admin'
  const isManager = profile?.role === 'manager'

  useEffect(() => {
    fetchData()
  }, [profile])

  async function fetchData() {
    setLoading(true)
    try {
      const queries = []

      if (isAdmin || isManager) {
        queries.push(supabase.from('employees').select('id, department', { count: 'exact' }))
        queries.push(supabase.from('customers').select('id', { count: 'exact' }).eq('status', 'active'))
      }

      let taskQuery = supabase.from('tasks').select('id, title, status, priority, assigned_to, assignee:profiles!tasks_assigned_to_fkey(full_name)', { count: 'exact' })
      if (profile?.role === 'employee') taskQuery = taskQuery.eq('assigned_to', profile.id)

      const [taskRes] = await Promise.all([taskQuery])
      const tasks = taskRes.data || []

      let empCount = 0, custCount = 0, depts = []
      if (isAdmin || isManager) {
        const [empRes, custRes] = await Promise.all([
          supabase.from('employees').select('department'),
          supabase.from('customers').select('id', { count: 'exact' }).eq('status', 'active')
        ])
        empCount = empRes.data?.length || 0
        custCount = custRes.count || 0
        const deptMap = {}
        empRes.data?.forEach(e => { deptMap[e.department] = (deptMap[e.department] || 0) + 1 })
        depts = Object.entries(deptMap).map(([d, c]) => ({ d, c })).sort((a, b) => b.c - a.c)
      }

      setStats({
        employees: empCount,
        tasks: tasks.length,
        tasks_done: tasks.filter(t => t.status === 'done').length,
        customers: custCount,
        tasks_high: tasks.filter(t => t.priority === 'high' && t.status !== 'done').length,
      })
      setRecentTasks(tasks.slice(0, 5))
      setDeptStats(depts)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="loading-screen" style={{ minHeight: '60vh' }}><div className="spinner" /></div>

  const pct = stats.tasks ? Math.round(stats.tasks_done / stats.tasks * 100) : 0

  return (
    <div>
      <div className="stats-grid">
        {(isAdmin || isManager) && (
          <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/employees')}>
            <div className="stat-label">Nhân viên</div>
            <div className="stat-value">{stats.employees}</div>
            <div className="stat-sub">đang làm việc</div>
          </div>
        )}
        <div className="stat-card">
          <div className="stat-label">Task hoàn thành</div>
          <div className="stat-value">{stats.tasks_done}<span style={{ fontSize: '16px', fontWeight: 400, color: 'var(--text-2)' }}>/{stats.tasks}</span></div>
          <div className="stat-sub">{pct}% tổng tiến độ</div>
        </div>
        {(isAdmin || isManager) && (
          <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/customers')}>
            <div className="stat-label">Khách hàng</div>
            <div className="stat-value">{stats.customers}</div>
            <div className="stat-sub">đang hợp tác</div>
          </div>
        )}
        <div className="stat-card">
          <div className="stat-label">Ưu tiên cao</div>
          <div className="stat-value" style={{ color: stats.tasks_high > 0 ? 'var(--red)' : 'inherit' }}>{stats.tasks_high}</div>
          <div className="stat-sub">task cần xử lý</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: (isAdmin || isManager) ? '1fr 1fr' : '1fr', gap: '1rem' }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Task gần đây</span>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/tasks')}>Xem tất cả →</button>
          </div>
          {recentTasks.length === 0
            ? <div className="empty"><div className="empty-icon">✓</div><div className="empty-text">Chưa có task nào</div></div>
            : recentTasks.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500 }}>{t.title}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '2px' }}>{t.assignee?.full_name || '—'}</div>
                </div>
                <span className={`badge ${STATUS_BADGE[t.status]}`}>{TASK_STATUS[t.status]}</span>
              </div>
            ))
          }
        </div>

        {(isAdmin || isManager) && deptStats.length > 0 && (
          <div className="card">
            <div className="card-header"><span className="card-title">Nhân sự theo phòng ban</span></div>
            {deptStats.map(x => (
              <div key={x.d} style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '5px' }}>
                  <span>{x.d}</span>
                  <span style={{ color: 'var(--text-2)' }}>{x.c} người</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: Math.round(x.c / stats.employees * 100) + '%' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
