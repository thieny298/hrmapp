import { useState, useEffect } from 'react'
import DateInput from '../components/DateInput.jsx'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext.jsx'

const INIT_PROFILE = {
  full_name:'', employee_code:'', status:'active', position:'', department:'',
  join_date:'', email:'', phone:'', dob:'', gender:'', marital_status:'', hometown:'', education_level:'',
  ethnicity:'', religion:'', current_address:'', permanent_address:'',
  tax_code:'', bank_account:'', bank_name:'', bank_branch:'', bank_owner:'',
  id_number:'', id_issued_date:'', id_issued_place:'',
  notes:'',
  education_history: [],
  work_history: [],
}

const STATUS = { active:'Đang làm', probation:'Thử việc', leave:'Nghỉ phép', quit:'Đã nghỉ' }
const GENDERS = [['','— Chọn —'],['male','Nam'],['female','Nữ'],['other','Khác']]
const MARITAL = [['','— Chọn —'],['single','Độc thân'],['married','Đã kết hôn'],['divorced','Ly hôn']]
const DEPTS = ['Kinh doanh','Vận hành','HR','Tài chính','Kỹ thuật','Marketing','BOD','Khác']

function initials(name=''){return name.split(' ').slice(-2).map(w=>w[0]).join('').toUpperCase()}

function Section({ icon, title, children, defaultOpen=true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="section-block">
      <div className="section-header" onClick={()=>setOpen(p=>!p)}>
        <i className={`section-header-icon fa-light ${icon}`} style={{color:'var(--primary)',fontSize:'13px'}} />
        <span className="section-title">{title}</span>
        <i className={`section-chevron fa-light fa-chevron-down${open?' open':''}`} />
      </div>
      {open && <div className="section-body">{children}</div>}
    </div>
  )
}

function Field({ label, k, form, setForm, type='text', opts, required }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}{required && <span className="req">*</span>}</label>
      {opts
        ? <select className="form-select" value={form[k]||''} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))}>
            {opts.map(([v,l])=><option key={v} value={v}>{l}</option>)}
          </select>
        : type === 'date'
          ? <DateInput value={form[k]||''} onChange={v=>setForm(p=>({...p,[k]:v}))} />
         : <input 
    className="form-input" 
    type={type}
    value={form[k]||''} 
    onChange={e => {
      const val = type === 'tel' 
        ? e.target.value.replace(/\D/g,'').slice(0,10) 
        : e.target.value
      setForm(p=>({...p,[k]:val}))
    }}
    maxLength={type === 'tel' ? 10 : undefined}
  />
      }
    </div>
  )
}

export default function ProfilePage() {
  const { profile: authProfile } = useAuth()
  const [form, setForm] = useState(INIT_PROFILE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const canEdit = authProfile?.role === 'admin' || authProfile?.role === 'manager'

  useEffect(() => { fetchProfile() }, [authProfile])

  async function fetchProfile() {
    if (!authProfile?.id) return
    setLoading(true)
    const { data } = await supabase.from('employee_profiles').select('*').eq('user_id', authProfile.id).single()
    if (data) setForm({ ...INIT_PROFILE, ...data, education_history: data.education_history||[], work_history: data.work_history||[] })
    else setForm(p => ({ ...p, full_name: authProfile.full_name||'', email: authProfile.email||'' }))
    setLoading(false)
  }

  async function save() {
    setSaving(true); setError(''); setSuccess(false)
    const payload = { ...form, user_id: authProfile.id }
    const { error } = await supabase.from('employee_profiles').upsert(payload, { onConflict: 'user_id' })
    if (error) setError(error.message)
    else setSuccess(true)
    setSaving(false)
    setTimeout(() => setSuccess(false), 3000)
  }

  function addRow(key, template) { setForm(p => ({ ...p, [key]: [...(p[key]||[]), template] })) }
  function updateRow(key, idx, field, val) { setForm(p => ({ ...p, [key]: p[key].map((r,i)=>i===idx?{...r,[field]:val}:r) })) }
  function removeRow(key, idx) { setForm(p => ({ ...p, [key]: p[key].filter((_,i)=>i!==idx) })) }



  if (loading) return <div className="loading-screen" style={{minHeight:'60vh'}}><div className="spinner"/></div>

  return (
    <div>
      {/* Header */}
      <div className="profile-header">
        <div className="avatar avatar-xl">{initials(form.full_name||'?')}</div>
        <div className="profile-info">
          <h2>{form.full_name || 'Chưa cập nhật tên'}</h2>
          <div className="profile-meta">
            {form.employee_code && <span className="profile-meta-item"><i className="fa-light fa-hashtag" />{form.employee_code}</span>}
            {form.position && <span className="profile-meta-item"><i className="fa-light fa-briefcase" />{form.position}</span>}
            {form.department && <span className="profile-meta-item"><i className="fa-light fa-building" />{form.department}</span>}
            {form.status && <span className={`badge ${form.status==='active'?'badge-green':form.status==='probation'?'badge-amber':form.status==='quit'?'badge-gray':'badge-blue'}`}>{STATUS[form.status]}</span>}
          </div>
        </div>
        {canEdit && (
          <div style={{marginLeft:'auto',display:'flex',gap:'8px',alignItems:'center'}}>
            {success && <span style={{fontSize:'12px',color:'var(--green)'}}>✓ Đã lưu</span>}
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              <i className="fa-light fa-floppy-disk" />
              {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        )}
      </div>

      {error && <div className="alert alert-error"><i className="fa-light fa-circle-exclamation"/>{error}</div>}

      {/* Thông tin chung */}
      <Section icon="fa-user" title="Thông tin chung">
        <div className="form-row">
          <Field label="Họ và tên" k="full_name" form={form} setForm={setForm} required />
          <Field label="Mã nhân viên" k="employee_code" form={form} setForm={setForm} />
        </div>
        <div className="form-row">
          <Field label="Chức danh" k="position" form={form} setForm={setForm} />
          <Field label="Phòng ban" k="department" opts={[['','— Chọn —'],...DEPTS.map(d=>[d,d])]} form={form} setForm={setForm} />
        </div>
        <div className="form-row">
          <Field label="Ngày nhận việc" k="join_date" type="date" form={form} setForm={setForm} />
          <Field label="Trạng thái" k="status" opts={[['','— Chọn —'],...Object.entries(STATUS)]} form={form} setForm={setForm} />
        </div>
        <div className="form-row">
          <Field label="Ngày sinh" k="dob" type="date" form={form} setForm={setForm} />
          <Field label="Giới tính" k="gender" opts={GENDERS} form={form} setForm={setForm} />
        </div>
        <div className="form-row">
          {/* <Field label="Tình trạng hôn nhân" k="marital_status" opts={MARITAL} form={form} setForm={setForm} /> */}
           <Field label="Nguyên quán" k="hometown" form={form} setForm={setForm} />
          <Field label="Trình độ học vấn" k="education_level" form={form} setForm={setForm} />
        </div>
       
      </Section>

      {/* Liên hệ */}
      <Section icon="fa-address-book" title="Thông tin liên hệ">
        <div className="form-row">
          <Field label="Email" k="email" type="email" form={form} setForm={setForm} />
          <Field label="Số điện thoại" k="phone" type="tel" form={form} setForm={setForm} />
        </div>
        <div style={{marginTop:'12px',marginBottom:'8px',fontWeight:'500',fontSize:'13px',color:'var(--text-2)'}}>Địa chỉ thường trú</div>
        <Field label="Số nhà, đường" k="permanent_address" form={form} setForm={setForm} />
        <div style={{marginTop:'12px',marginBottom:'8px',fontWeight:'500',fontSize:'13px',color:'var(--text-2)'}}>Địa chỉ hiện tại</div>
        <Field label="Số nhà, đường" k="current_address" form={form} setForm={setForm} />
      </Section>

      {/* Cá nhân */}
      <Section icon="fa-circle-info" title="Thông tin cá nhân" defaultOpen={false}>
        <div className="form-row">
          <Field label="Dân tộc" k="ethnicity" form={form} setForm={setForm} />
          <Field label="Tôn giáo" k="religion" form={form} setForm={setForm} />
        </div>
        <div className="form-group">
          <label className="form-label">Ghi chú</label>
          <textarea className="form-textarea" value={form.notes||''} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} />
        </div>
      </Section>

      {/* Tài chính */}
      <Section icon="fa-piggy-bank" title="Thông tin tài chính" defaultOpen={false}>
        <div className="form-row">
          <Field label="Tên chủ tài khoản" k="bank_owner" form={form} setForm={setForm} />
          <Field label="Số tài khoản ngân hàng" k="bank_account" form={form} setForm={setForm} />
        </div>
        <div className="form-row">
          <Field label="Tên ngân hàng" k="bank_name" form={form} setForm={setForm} />
          <Field label="Chi nhánh" k="bank_branch" form={form} setForm={setForm} />
        </div>
        <Field label="Mã số thuế cá nhân" k="tax_code" form={form} setForm={setForm} />
      </Section>

      {/* Giấy tờ */}
      <Section icon="fa-id-card" title="Giấy tờ tùy thân" defaultOpen={false}>
        <div className="form-row">
          <Field label="Số CCCD/CMND" k="id_number" form={form} setForm={setForm} />
          <Field label="Ngày cấp" k="id_issued_date" type="date" form={form} setForm={setForm} />
        </div>
        <Field label="Nơi cấp" k="id_issued_place" form={form} setForm={setForm} />
      </Section>

      {/* Học tập */}
      <Section icon="fa-graduation-cap" title="Quá trình học tập" defaultOpen={false}>
        {(form.education_history||[]).map((row,idx) => (
          <div key={idx} className="repeatable-row">
            <div style={{flex:1,display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:'8px'}}>
              <div className="form-group" style={{margin:0}}>
                <label className="form-label">Từ</label>
                <input className="form-input" type="month" value={row.from||''} onChange={e=>updateRow('education_history',idx,'from',e.target.value)} />
              </div>
              <div className="form-group" style={{margin:0}}>
                <label className="form-label">Đến</label>
                <input className="form-input" type="month" value={row.to||''} onChange={e=>updateRow('education_history',idx,'to',e.target.value)} />
              </div>
              <div className="form-group" style={{margin:0}}>
                <label className="form-label">Trình độ</label>
                <input className="form-input" value={row.degree||''} onChange={e=>updateRow('education_history',idx,'degree',e.target.value)} />
              </div>
              <div className="form-group" style={{margin:0}}>
                <label className="form-label">Chuyên ngành</label>
                <input className="form-input" value={row.major||''} onChange={e=>updateRow('education_history',idx,'major',e.target.value)} />
              </div>
              <div className="form-group" style={{margin:0,gridColumn:'span 2'}}>
                <label className="form-label">Nơi đào tạo</label>
                <input className="form-input" value={row.school||''} onChange={e=>updateRow('education_history',idx,'school',e.target.value)} />
              </div>
              <div className="form-group" style={{margin:0,gridColumn:'span 2'}}>
                <label className="form-label">Hình thức</label>
                <input className="form-input" value={row.type||''} onChange={e=>updateRow('education_history',idx,'type',e.target.value)} placeholder="Chính quy, Tại chức..." />
              </div>
            </div>
            {canEdit && <button className="icon-btn" style={{color:'var(--red)',marginTop:'24px'}} onClick={()=>removeRow('education_history',idx)}><i className="fa-light fa-trash-can"/></button>}
          </div>
        ))}
        {canEdit && <button className="btn-add-row" onClick={()=>addRow('education_history',{from:'',to:'',degree:'',major:'',school:'',type:''})}>
          <i className="fa-light fa-plus"/> Thêm
        </button>}
      </Section>

      {/* Kinh nghiệm */}
      <Section icon="fa-briefcase" title="Kinh nghiệm làm việc" defaultOpen={false}>
        {(form.work_history||[]).map((row,idx) => (
          <div key={idx} className="repeatable-row">
            <div style={{flex:1,display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:'8px'}}>
              <div className="form-group" style={{margin:0}}>
                <label className="form-label">Từ</label>
                <input className="form-input" type="month" value={row.from||''} onChange={e=>updateRow('work_history',idx,'from',e.target.value)} />
              </div>
              <div className="form-group" style={{margin:0}}>
                <label className="form-label">Đến</label>
                <input className="form-input" type="month" value={row.to||''} onChange={e=>updateRow('work_history',idx,'to',e.target.value)} />
              </div>
              <div className="form-group" style={{margin:0}}>
                <label className="form-label">Tên công ty</label>
                <input className="form-input" value={row.company||''} onChange={e=>updateRow('work_history',idx,'company',e.target.value)} />
              </div>
              <div className="form-group" style={{margin:0}}>
                <label className="form-label">Vị trí</label>
                <input className="form-input" value={row.position||''} onChange={e=>updateRow('work_history',idx,'position',e.target.value)} />
              </div>
              <div className="form-group" style={{margin:0,gridColumn:'span 2'}}>
                <label className="form-label">Người tham chiếu</label>
                <input className="form-input" value={row.reference||''} onChange={e=>updateRow('work_history',idx,'reference',e.target.value)} />
              </div>
              <div className="form-group" style={{margin:0,gridColumn:'span 2'}}>
                <label className="form-label">SĐT người tham chiếu</label>
                <input className="form-input" value={row.reference_phone||''} onChange={e=>updateRow('work_history',idx,'reference_phone',e.target.value)} />
              </div>
              <div className="form-group" style={{margin:0,gridColumn:'span 4'}}>
                <label className="form-label">Mô tả công việc</label>
                <textarea className="form-textarea" style={{minHeight:'60px'}} value={row.description||''} onChange={e=>updateRow('work_history',idx,'description',e.target.value)} />
              </div>
            </div>
            {canEdit && <button className="icon-btn" style={{color:'var(--red)',marginTop:'24px'}} onClick={()=>removeRow('work_history',idx)}><i className="fa-light fa-trash-can"/></button>}
          </div>
        ))}
        {canEdit && <button className="btn-add-row" onClick={()=>addRow('work_history',{from:'',to:'',company:'',position:'',reference:'',reference_phone:'',description:''})}>
          <i className="fa-light fa-plus"/> Thêm
        </button>}
      </Section>

      {canEdit && (
        <div style={{display:'flex',justifyContent:'flex-end',gap:'8px',marginTop:'1rem',paddingTop:'1rem',borderTop:'1px solid var(--border)'}}>
          {success && <span style={{fontSize:'13px',color:'var(--green)',display:'flex',alignItems:'center',gap:'4px'}}><i className="fa-light fa-circle-check"/>Đã lưu thành công!</span>}
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            <i className="fa-light fa-floppy-disk"/>
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      )}
    </div>
  )
}
