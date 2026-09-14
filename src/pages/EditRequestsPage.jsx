import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext.jsx'
import PageHeader from '../components/PageHeader.jsx'

function formatDateTime(d) {
  if (!d) return ''
  return new Date(d).toLocaleString('vi-VN')
}

export default function EditRequestsPage() {
  const { profile } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [processingId, setProcessingId] = useState(null)

  useEffect(() => { fetchRequests() }, [filter])

  async function fetchRequests() {
    setLoading(true)
    const { data } = await supabase
      .from('profile_edit_requests')
      .select('*, employee_profiles(full_name, employee_code)')
      .eq('status', filter)
      .order('created_at', { ascending: false })
    setRequests(data || [])
    setLoading(false)
  }

  async function approve(req) {
    setProcessingId(req.id)
    const payload = {}
    req.changes.forEach(c => { payload[c.field] = c.new })

    const { error: updateErr } = await supabase.from('employee_profiles').update(payload).eq('id', req.employee_id)
    if (updateErr) { alert('Lỗi khi áp dụng thay đổi: ' + updateErr.message); setProcessingId(null); return }

    const { error } = await supabase.from('profile_edit_requests').update({
      status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: profile.id,
    }).eq('id', req.id)

    setProcessingId(null)
    if (error) { alert('Lỗi: ' + error.message); return }
    fetchRequests()
  }

  async function reject(req) {
    if (!confirm('Từ chối yêu cầu này?')) return
    setProcessingId(req.id)
    const { error } = await supabase.from('profile_edit_requests').update({
      status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: profile.id,
    }).eq('id', req.id)
    setProcessingId(null)
    if (error) { alert('Lỗi: ' + error.message); return }
    fetchRequests()
  }

  return (
    <div>
      <PageHeader title="Yêu cầu chỉnh sửa" subtitle="Xem và duyệt các yêu cầu cập nhật hồ sơ từ nhân viên" />

      <div className="tabbar" style={{ marginBottom: '1rem' }}>
        {[['pending', 'Chờ duyệt'], ['approved', 'Đã duyệt'], ['rejected', 'Đã từ chối']].map(([v, l]) => (
          <button key={v} className={`tabbar-btn${filter === v ? ' active' : ''}`} onClick={() => setFilter(v)}>{l}</button>
        ))}
      </div>

      {loading ? (
        <div className="loading-screen" style={{ minHeight: '40vh' }}><div className="spinner" /></div>
      ) : requests.length === 0 ? (
        <div className="card"><div className="empty"><div className="empty-icon">📋</div><div className="empty-text">Không có yêu cầu nào</div></div></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {requests.map(req => (
            <div key={req.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{req.employee_profiles?.full_name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>
                    Mã NV: {req.employee_profiles?.employee_code} · Gửi lúc {formatDateTime(req.created_at)}
                  </div>
                </div>
                {filter === 'pending' && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn" onClick={() => reject(req)} disabled={processingId === req.id}>Từ chối</button>
                    <button className="btn btn-primary" onClick={() => approve(req)} disabled={processingId === req.id}>
                      {processingId === req.id ? 'Đang xử lý...' : 'Đồng ý'}
                    </button>
                  </div>
                )}
              </div>
              <table style={{ width: '100%', fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', color: 'var(--text-2)', padding: '4px 8px' }}>Trường</th>
                    <th style={{ textAlign: 'left', color: 'var(--text-2)', padding: '4px 8px' }}>Giá trị cũ</th>
                    <th style={{ textAlign: 'left', color: 'var(--text-2)', padding: '4px 8px' }}>Giá trị mới</th>
                  </tr>
                </thead>
                <tbody>
                  {req.changes.map((c, i) => (
                    <tr key={i} style={{ background: i % 2 ? 'var(--bg)' : 'transparent' }}>
                      <td style={{ padding: '4px 8px', fontWeight: 500 }}>{c.label}</td>
                      <td style={{ padding: '4px 8px', color: 'var(--text-2)' }}>{c.old || '—'}</td>
                      <td style={{ padding: '4px 8px', fontWeight: 500 }}>{c.new || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
