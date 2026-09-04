import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext.jsx'
import PageHeader from '../components/PageHeader.jsx'

const STATUS_BADGE = { pending:'badge-amber', approved:'badge-green', rejected:'badge-red' }
const STATUS_LABEL = { pending:'Chờ duyệt', approved:'Đã duyệt', rejected:'Từ chối' }
const LEAVE_TYPES = [['full','Nghỉ cả ngày'],['morning','Nghỉ nửa buổi sáng'],['afternoon','Nghỉ nửa buổi chiều']]

function LeaveDetailModal({ leave, onClose, onApprove, onReject, processing }) {
  if (!leave) return null
  const typeLabel = LEAVE_TYPES.find(t => t[0] === leave.leave_type)?.[1] || leave.leave_type
  const fromStr = new Date(leave.from_date).toLocaleDateString('vi-VN')
  const toStr = new Date(leave.to_date).toLocaleDateString('vi-VN')
  const createdStr = new Date(leave.created_at).toLocaleString('vi-VN')
  const isPending = leave.status === 'pending'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
    }} onClick={onClose}>
      <div style={{
        background: 'var(--card)', borderRadius: '12px', width: '100%', maxWidth: '520px',
        padding: '24px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ fontWeight: 600, fontSize: '15px' }}>Chi tiết đơn nghỉ phép</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--text-2)', padding: '0 4px' }}>
            <i className="fa-light fa-xmark" />
          </button>
        </div>

        {/* Người gửi */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--bg)', borderRadius: 'var(--radius)', marginBottom: '14px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: '15px', flexShrink: 0
          }}>
            {(leave.user_name || '?').split(' ').slice(-2).map(w => w[0]).join('').toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px' }}>{leave.user_name || '—'}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>{leave.user_email || '—'}</div>
          </div>
          <span className={`badge ${STATUS_BADGE[leave.status]}`} style={{ marginLeft: 'auto' }}>{STATUS_LABEL[leave.status]}</span>
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

        <div style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 'var(--radius)', marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-2)', marginBottom: '3px' }}>Lý do nghỉ</div>
          <div style={{ fontWeight: 500, fontSize: '13px' }}>{leave.reason}</div>
        </div>

        <div style={{ fontSize: '11px', color: 'var(--text-2)', marginBottom: '16px' }}>
          <i className="fa-light fa-clock" style={{ marginRight: '4px' }} />
          Gửi lúc: {createdStr}
        </div>

        {isPending && (
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              className="btn"
              style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
              onClick={() => onReject(leave)}
              disabled={processing}
            >
              <i className="fa-solid fa-xmark" /> Từ chối
            </button>
            <button
              className="btn btn-primary"
              onClick={() => onApprove(leave)}
              disabled={processing}
              style={{ background: '#16a34a', borderColor: '#16a34a' }}
            >
              <i className="fa-solid fa-check" /> Đồng ý
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function LeaveApprovalPage() {
  const { profile } = useAuth()
  const [leaves, setLeaves] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [selected, setSelected] = useState(null)
  const [filterStatus, setFilterStatus] = useState('pending')
  const [toast, setToast] = useState(null)

  useEffect(() => { fetchLeaves() }, [filterStatus])

  async function fetchLeaves() {
    setLoading(true)
    let query = supabase
      .from('leave_requests')
      .select('*, user_profiles!leave_requests_user_id_fkey(full_name, email)')
      .order('created_at', { ascending: false })

    if (filterStatus !== 'all') query = query.eq('status', filterStatus)

    const { data } = await query
    const mapped = (data || []).map(r => ({
      ...r,
      user_name: r.user_profiles?.full_name || '—',
      user_email: r.user_profiles?.email || '—',
    }))
    setLeaves(mapped)
    setLoading(false)
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleApprove(leave) {
    setProcessing(true)
    const { error } = await supabase
      .from('leave_requests')
      .update({ status: 'approved', approved_by: profile.id, approved_at: new Date().toISOString() })
      .eq('id', leave.id)
    if (error) { showToast('Có lỗi xảy ra!', 'error') }
    else { showToast('Đã duyệt đơn nghỉ phép!'); setSelected(null); fetchLeaves() }
    setProcessing(false)
  }

  async function handleReject(leave) {
    setProcessing(true)
    const { error } = await supabase
      .from('leave_requests')
      .update({ status: 'rejected', approved_by: profile.id, approved_at: new Date().toISOString() })
      .eq('id', leave.id)
    if (error) { showToast('Có lỗi xảy ra!', 'error') }
    else { showToast('Đã từ chối đơn nghỉ phép.', 'error'); setSelected(null); fetchLeaves() }
    setProcessing(false)
  }

  const pending = leaves.filter(l => l.status === 'pending').length

  return (
    <div>
      <PageHeader title="Duyệt nghỉ phép" subtitle="Phê duyệt hoặc từ chối đơn nghỉ phép của nhân viên" />

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 2000,
          padding: '12px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 500,
          background: toast.type === 'error' ? '#fee2e2' : '#dcfce7',
          color: toast.type === 'error' ? '#dc2626' : '#16a34a',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
          <i className={`fa-solid ${toast.type === 'error' ? 'fa-xmark-circle' : 'fa-check-circle'}`} style={{ marginRight: '8px' }} />
          {toast.msg}
        </div>
      )}

      {/* Header stats */}
      {pending > 0 && (
        <div style={{
          padding: '12px 16px', background: '#fffbeb', border: '1px solid #fbbf24',
          borderRadius: 'var(--radius)', marginBottom: '1rem', fontSize: '13px', color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          <i className="fa-solid fa-clock" />
          Có <strong>{pending} đơn</strong> đang chờ duyệt
        </div>
      )}

      {/* Filter */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
        {[['pending','Chờ duyệt'],['approved','Đã duyệt'],['rejected','Từ chối'],['all','Tất cả']].map(([v,l]) => (
          <button
            key={v}
            className={filterStatus === v ? 'btn btn-primary' : 'btn'}
            style={{ fontSize: '12px', padding: '6px 12px' }}
            onClick={() => setFilterStatus(v)}
          >
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-screen" style={{ minHeight: '40vh' }}><div className="spinner" /></div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {['Nhân viên','Thời gian nghỉ','Hình thức','Số ngày','Lý do','Trạng thái'].map(c => <th key={c}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {leaves.length === 0
                  ? <tr><td colSpan="6"><div className="empty"><div className="empty-text">Không có đơn nào</div></div></td></tr>
                  : leaves.map(l => (
                    <tr key={l.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(l)}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{l.user_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-2)' }}>{l.user_email}</div>
                      </td>
                      <td style={{ fontWeight: 500 }}>
                        {new Date(l.from_date).toLocaleDateString('vi-VN')}
                        {l.to_date !== l.from_date && ' → ' + new Date(l.to_date).toLocaleDateString('vi-VN')}
                      </td>
                      <td style={{ color: 'var(--text-2)' }}>{LEAVE_TYPES.find(t => t[0] === l.leave_type)?.[1] || l.leave_type}</td>
                      <td>{l.days_count} ngày</td>
                      <td style={{ color: 'var(--text-2)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.reason}</td>
                      <td><span className={`badge ${STATUS_BADGE[l.status]}`}>{STATUS_LABEL[l.status]}</span></td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      <LeaveDetailModal
        leave={selected}
        onClose={() => setSelected(null)}
        onApprove={handleApprove}
        onReject={handleReject}
        processing={processing}
      />
    </div>
  )
}
