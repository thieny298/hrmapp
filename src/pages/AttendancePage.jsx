import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext.jsx'

const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const MONTHS = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12']

function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate() }
function getFirstDay(y, m) { return new Date(y, m, 1).getDay() }

export default function AttendancePage() {
  const { profile } = useAuth()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [records, setRecords] = useState([])
  const [todayRecord, setTodayRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [selected, setSelected] = useState(null)
  const [latePopup, setLatePopup] = useState(null)

  const today = now.toISOString().slice(0, 10)

  useEffect(() => { fetchRecords() }, [year, month, profile])

  async function fetchRecords() {
    if (!profile?.id) return
    setLoading(true)
    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(getDaysInMonth(year, month)).padStart(2, '0')}`
    const { data } = await supabase.from('attendance').select('*')
      .eq('user_id', profile.id).gte('date', from).lte('date', to).order('date')
    setRecords(data || [])
    setTodayRecord((data || []).find(r => r.date === today) || null)
    setLoading(false)
  }

  async function checkIn() {
    setChecking(true)
    const n = new Date()
    const totalMin = n.getHours() * 60 + n.getMinutes()
    const startMin = 8 * 60
    let checkInTime, status, lateMinutes = 0

    if (totalMin <= startMin) {
      checkInTime = '08:00'
      status = 'present'
    } else {
      checkInTime = `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`
      status = 'late'
      lateMinutes = totalMin - startMin
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
      fetchRecords()
    }
    setChecking(false)
  }

  function prevMonth() { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1) }
  function nextMonth() { if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1) }

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDay(year, month)
  const recordMap = {}
  records.forEach(r => { recordMap[r.date] = r })

  const totalWork = records.filter(r => r.status === 'present' || r.status === 'late').length
  const totalLate = records.filter(r => r.status === 'late').length
  const totalLeave = records.filter(r => r.status === 'leave').length

  function getDayClass(dateStr) {
    const d = new Date(dateStr)
    if (d.getDay() === 0 || d.getDay() === 6) return 'absent'
    const r = recordMap[dateStr]
    if (!r) return 'absent'
    if (r.status === 'leave') return 'leave'
    if (r.status === 'late') return 'late'
    return 'normal'
  }

  if (loading) return <div className="loading-screen" style={{ minHeight: '60vh' }}><div className="spinner" /></div>

  return (
    <div>
      {/* Late popup */}
      {latePopup && (
        <div className="modal-overlay" onClick={() => setLatePopup(null)}>
          <div className="modal" style={{ maxWidth: '340px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '36px', marginBottom: '10px' }}>⏰</div>
            <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '6px' }}>Bạn đã đi trễ {latePopup} phút</div>
            <div style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '1.5rem' }}>Hãy cố gắng đúng giờ hơn vào ngày mai nhé!</div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setLatePopup(null)}>Đã hiểu</button>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              Chi tiết — {new Date(selected.date + 'T00:00:00').toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}
              <button className="icon-btn" onClick={() => setSelected(null)}><i className="fa-light fa-xmark" /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {[
                ['Giờ vào', selected.check_in || '—'],
                ['Trạng thái', selected.status === 'late' ? `Đi trễ ${selected.late_minutes} phút` : selected.status === 'present' ? 'Đúng giờ' : selected.status === 'leave' ? 'Nghỉ phép' : '—'],
              ].map(([k, v]) => (
                <div key={k} style={{ padding: '12px', background: 'var(--bg)', borderRadius: 'var(--radius)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-2)', marginBottom: '4px' }}>{k}</div>
                  <div style={{ fontWeight: '500' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Today check-in card */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '4px' }}>
              Hôm nay — {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            {todayRecord
              ? <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '500', color: 'var(--green)' }}>
                  <i className="fa-solid fa-circle-check" />
                  Đã chấm công lúc {todayRecord.check_in}
                  {todayRecord.status === 'late' && <span style={{ color: 'var(--amber)' }}>· Đi trễ {todayRecord.late_minutes} phút</span>}
                </div>
              : <div style={{ fontSize: '13px', color: 'var(--text-2)' }}>Chưa chấm công hôm nay</div>
            }
          </div>
          {!todayRecord
            ? <button className="btn btn-primary" onClick={checkIn} disabled={checking}>
                <i className="fa-light fa-right-to-bracket" />
                {checking ? 'Đang xử lý...' : 'Chấm công vào'}
              </button>
            : <span className="badge badge-green"><i className="fa-solid fa-check" style={{ marginRight: '4px' }} />Hoàn thành</span>
          }
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '12px', marginBottom: '1rem' }}>
        <div className="stat-card"><div className="stat-label">Ngày đi làm</div><div className="stat-value">{totalWork}</div><div className="stat-sub">{MONTHS[month]}</div></div>
        <div className="stat-card"><div className="stat-label">Đi trễ</div><div className="stat-value" style={{ color: totalLate > 0 ? 'var(--red)' : 'inherit' }}>{totalLate}</div><div className="stat-sub">ngày</div></div>
        <div className="stat-card"><div className="stat-label">Nghỉ phép</div><div className="stat-value">{totalLeave}</div><div className="stat-sub">ngày</div></div>
      </div>

      {/* Calendar */}
      <div className="card">
        <div className="card-header">
          <button className="icon-btn" onClick={prevMonth}><i className="fa-light fa-chevron-left" /></button>
          <span className="card-title">{MONTHS[month]} {year}</span>
          <button className="icon-btn" onClick={nextMonth}><i className="fa-light fa-chevron-right" /></button>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', flexWrap: 'wrap' }}>
          {[['#f0fdf4', 'Đúng giờ'], ['var(--red-light)', 'Đi trễ'], ['var(--orange-light)', 'Nghỉ phép'], ['var(--gray-bg)', 'Chưa chấm / T7 CN']].map(([bg, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-2)' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: bg, border: '1px solid var(--border)' }} />
              {label}
            </div>
          ))}
        </div>

        <div className="attendance-calendar">
          {DAYS.map(d => <div key={d} className="cal-header">{d}</div>)}
          {Array(firstDay).fill(null).map((_, i) => <div key={'e' + i} className="cal-day empty" />)}
          {Array(daysInMonth).fill(null).map((_, i) => {
            const day = i + 1
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const rec = recordMap[dateStr]
            const isToday = dateStr === today
            const isWeekend = new Date(dateStr + 'T00:00:00').getDay() === 0 || new Date(dateStr + 'T00:00:00').getDay() === 6
            const cls = getDayClass(dateStr)

            return (
              <div
                key={day}
                className={`cal-day ${cls}`}
                style={isToday ? { border: '2px solid var(--primary)', borderRadius: 'var(--radius)' } : {}}
                onClick={() => rec && setSelected(rec)}
              >
                <div className="cal-day-num" style={isToday ? { color: 'var(--primary)' } : {}}>{day}</div>
                {rec && <div className="cal-day-status">{rec.check_in}{rec.status === 'late' && <div style={{ color: 'var(--red)', fontSize: '10px' }}>+{rec.late_minutes}p</div>}</div>}
                {isWeekend && !rec && <div className="cal-day-status" style={{ color: 'var(--text-3)' }}>—</div>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
