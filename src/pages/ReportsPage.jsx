import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function ReportsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const [empRes, taskRes, custRes] = await Promise.all([
      supabase.from('employees').select('status, department'),
      supabase.from('tasks').select('status, priority, assigned_to, assignee:profiles!tasks_assigned_to_fkey(full_name)'),
      supabase.from('customers').select('status, industry'),
    ])
    setData({ employees: empRes.data || [], tasks: taskRes.data || [], customers: custRes.data || [] })
    setLoading(false)
  }

  if (loading) return <div className="loading-screen" style={{ minHeight: '60vh' }}><div className="spinner" /></div>

  const { employees, tasks, customers } = data

  const taskDone = tasks.filter(t => t.status === 'done').length
  const pct = tasks.length ? Math.round(taskDone / tasks.length * 100) : 0

  function BarChart({ title, items, total }) {
    return (
      <div className="card">
        <div className="card-header"><span className="card-title">{title}</span></div>
        {items.length === 0
          ? <div className="empty"><div className="empty-text">Chưa có dữ liệu</div></div>
          : items.map(({ label, count, badge }) => (
            <div key={label} style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {badge && <span className={`badge ${badge}`} style={{ fontSize: '10px' }}>{label}</span>}
                  {!badge && <span style={{ fontSize: '13px' }}>{label}</span>}
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-2)', fontWeight: 500 }}>{count}</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: total ? Math.round(count / total * 100) + '%' : '0%' }} />
              </div>
            </div>
          ))
        }
      </div>
    )
  }

  const deptMap = {}
  employees.forEach(e => { deptMap[e.department] = (deptMap[e.department] || 0) + 1 })
  const deptItems = Object.entries(deptMap).map(([k, v]) => ({ label: k, count: v })).sort((a, b) => b.count - a.count)

  const taskStatusMap = {}
  tasks.forEach(t => { taskStatusMap[t.status] = (taskStatusMap[t.status] || 0) + 1 })
  const STATUS_LABEL = { todo: 'Cần làm', doing: 'Đang làm', review: 'Chờ duyệt', done: 'Hoàn thành' }
  const STATUS_BADGE = { todo: 'badge-gray', doing: 'badge-blue', review: 'badge-amber', done: 'badge-green' }
  const taskStatusItems = Object.entries(taskStatusMap).map(([k, v]) => ({ label: STATUS_LABEL[k], count: v, badge: STATUS_BADGE[k] }))

  const assigneeMap = {}
  tasks.forEach(t => {
    const name = t.assignee?.full_name || 'Chưa giao'
    assigneeMap[name] = (assigneeMap[name] || 0) + 1
  })
  const assigneeItems = Object.entries(assigneeMap).map(([k, v]) => ({ label: k, count: v })).sort((a, b) => b.count - a.count).slice(0, 5)

  const custStatusMap = {}
  customers.forEach(c => { custStatusMap[c.status] = (custStatusMap[c.status] || 0) + 1 })
  const CUST_LABEL = { active: 'Đang hợp tác', prospect: 'Tiềm năng', inactive: 'Ngừng hợp tác' }
  const CUST_BADGE = { active: 'badge-green', prospect: 'badge-blue', inactive: 'badge-gray' }
  const custItems = Object.entries(custStatusMap).map(([k, v]) => ({ label: CUST_LABEL[k], count: v, badge: CUST_BADGE[k] }))

  return (
    <div>
      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card"><div className="stat-label">Tổng nhân viên</div><div className="stat-value">{employees.length}</div></div>
        <div className="stat-card"><div className="stat-label">Tổng task</div><div className="stat-value">{tasks.length}</div></div>
        <div className="stat-card"><div className="stat-label">Tỷ lệ hoàn thành</div><div className="stat-value">{pct}<span style={{ fontSize: '16px', fontWeight: 400, color: 'var(--text-2)' }}>%</span></div></div>
        <div className="stat-card"><div className="stat-label">Khách hàng</div><div className="stat-value">{customers.length}</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <BarChart title="Nhân viên theo phòng ban" items={deptItems} total={employees.length} />
        <BarChart title="Task theo trạng thái" items={taskStatusItems} total={tasks.length} />
        <BarChart title="Top người được giao nhiều task" items={assigneeItems} total={tasks.length} />
        <BarChart title="Khách hàng theo trạng thái" items={custItems} total={customers.length} />
      </div>
    </div>
  )
}
