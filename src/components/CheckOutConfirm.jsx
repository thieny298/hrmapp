import { useState } from 'react'
import { STANDARD_CHECK_OUT_HOUR } from '../lib/checkin'

export default function CheckOutConfirm({ loading, onConfirm, onCancel }) {
  const [now] = useState(() => new Date())
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const isEarly = now.getHours() < STANDARD_CHECK_OUT_HOUR

  return (
    <div className="modal-overlay" onClick={() => !loading && onCancel()}>
      <div className="modal" style={{ maxWidth: '360px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: '36px', marginBottom: '10px' }}>{isEarly ? '⚠️' : '🏠'}</div>
        <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '6px' }}>Xác nhận chấm công về</div>
        <div style={{ fontSize: '14px', marginBottom: '12px' }}>
          Chấm công về lúc <strong>{time}</strong>?
        </div>
        {isEarly
          ? <div style={{ fontSize: '13px', color: 'var(--amber)', background: 'var(--bg)', padding: '10px 12px', borderRadius: 'var(--radius)', marginBottom: '1.25rem', textAlign: 'left' }}>
              Bạn đang về sớm hơn giờ quy định ({STANDARD_CHECK_OUT_HOUR}:00). Sau khi xác nhận sẽ không thể chấm lại.
            </div>
          : <div style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '1.25rem' }}>
              Mỗi ngày chỉ chấm công về 1 lần.
            </div>
        }
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={onCancel} disabled={loading}>Huỷ</button>
          <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={onConfirm} disabled={loading}>
            {loading ? 'Đang xử lý...' : 'Xác nhận'}
          </button>
        </div>
      </div>
    </div>
  )
}
