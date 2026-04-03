import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext.jsx'

function fmt(n) { return Number(n||0).toLocaleString('vi-VN') }

export default function SalaryPage() {
  const { profile } = useAuth()
  const [salaries, setSalaries] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchSalaries() }, [profile])

  async function fetchSalaries() {
    if (!profile?.id) return
    setLoading(true)
    const { data } = await supabase.from('salary_records').select('*').eq('user_id', profile.id).order('period', { ascending: false })
    setSalaries(data || [])
    setLoading(false)
  }

  if (loading) return <div className="loading-screen" style={{minHeight:'60vh'}}><div className="spinner"/></div>

  return (
    <div>
      {selected ? (
        <div>
          <button className="btn btn-ghost btn-sm" onClick={()=>setSelected(null)} style={{marginBottom:'1rem'}}>
            <i className="fa-solid fa-arrow-left"/>Quay lại
          </button>
          <div className="card">
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.5rem'}}>
              <div>
                <div className="card-title">Bảng lương {selected.period}</div>
                <div style={{fontSize:'12px',color:'var(--text-2)',marginTop:'2px'}}>{profile?.full_name}</div>
              </div>
              <span className={`badge ${selected.status==='paid'?'badge-green':'badge-amber'}`}>{selected.status==='paid'?'Đã thanh toán':'Chờ thanh toán'}</span>
            </div>

            <div style={{marginBottom:'1.5rem'}}>
              <div style={{fontSize:'12px',fontWeight:'600',color:'var(--text-2)',marginBottom:'8px',textTransform:'uppercase',letterSpacing:'0.05em'}}>Thu nhập</div>
              {[['Lương cơ bản', selected.base_salary],['Phụ cấp', selected.allowance],['Thưởng', selected.bonus]].map(([k,v])=>(
                <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--border)',fontSize:'13px'}}>
                  <span style={{color:'var(--text-2)'}}>{k}</span>
                  <span style={{fontWeight:'500'}}>{fmt(v)} đ</span>
                </div>
              ))}
            </div>

            <div style={{marginBottom:'1.5rem'}}>
              <div style={{fontSize:'12px',fontWeight:'600',color:'var(--text-2)',marginBottom:'8px',textTransform:'uppercase',letterSpacing:'0.05em'}}>Khấu trừ</div>
              {[['Bảo hiểm xã hội', selected.social_insurance],['Thuế TNCN', selected.personal_tax],['Khấu trừ khác', selected.other_deduction]].map(([k,v])=>(
                <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--border)',fontSize:'13px'}}>
                  <span style={{color:'var(--text-2)'}}>{k}</span>
                  <span style={{fontWeight:'500',color:'var(--red)'}}>- {fmt(v)} đ</span>
                </div>
              ))}
            </div>

            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px',background:'var(--primary-bg)',borderRadius:'var(--radius)',marginTop:'1rem'}}>
              <span style={{fontWeight:'600',color:'var(--primary)'}}>Lương thực nhận</span>
              <span style={{fontSize:'22px',fontWeight:'700',color:'var(--primary)'}}>{fmt(selected.net_salary)} đ</span>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div style={{fontSize:'13px',color:'var(--text-2)',marginBottom:'1rem'}}>{salaries.length} kỳ lương</div>
          {salaries.length === 0
            ? <div className="card"><div className="empty"><div className="empty-icon"><i className="fa-solid fa-money-bill-wave"/></div><div className="empty-text">Chưa có bảng lương nào</div></div></div>
            : <div className="card" style={{padding:0}}>
                <div className="table-wrap">
                  <table>
                    <thead><tr>{['Kỳ lương','Lương cơ bản','Thực nhận','Trạng thái',''].map(c=><th key={c}>{c}</th>)}</tr></thead>
                    <tbody>
                      {salaries.map(s=>(
                        <tr key={s.id} style={{cursor:'pointer'}} onClick={()=>setSelected(s)}>
                          <td style={{fontWeight:500}}>{s.period}</td>
                          <td>{fmt(s.base_salary)} đ</td>
                          <td style={{fontWeight:'600',color:'var(--primary)'}}>{fmt(s.net_salary)} đ</td>
                          <td><span className={`badge ${s.status==='paid'?'badge-green':'badge-amber'}`}>{s.status==='paid'?'Đã thanh toán':'Chờ thanh toán'}</span></td>
                          <td><i className="fa-solid fa-chevron-right" style={{color:'var(--text-3)',fontSize:'11px'}}/></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
          }
        </div>
      )}
    </div>
  )
}
