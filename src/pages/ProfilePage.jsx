import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import DateInput from '../components/DateInput.jsx'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext.jsx'

const INIT_PROFILE = {
  full_name: '', employee_code: '', status: 'active', position: '', department: '',
  account_name: '', manager_id: '',
  join_date: '', email: '', phone: '', dob: '', gender: '', marital_status: '', hometown: '', education_level: '',
  ethnicity: '', religion: '', current_address: '', permanent_address: '',
  tax_code: '', bank_account: '', bank_name: '', bank_branch: '', bank_owner: '',
  id_number: '', id_issued_date: '', id_issued_place: '',
  passport_number: '', passport_type: '', passport_issue_date: '', passport_issue_place: '', passport_expiry_date: '',
  high_school_level: '', military_service: '', notes: '',
  emergency_name: '', emergency_phone: '', emergency_relation: '', emergency_address: '',
  rank_code: '', rank_name: '', level: '',
  contract_type: 'full_time', salary_coefficient: '',
  career_history: [],
}

const CONTRACT_TYPES = [
  ['full_time', 'Chính thức (toàn thời gian)'],
  ['part_time', 'Bán thời gian'],
  ['contract', 'Hợp đồng dịch vụ'],
  ['intern', 'Thực tập sinh'],
]

const STATUS = { active: 'Đang làm', probation: 'Thử việc', leave: 'Nghỉ phép', quit: 'Đã nghỉ' }
const GENDERS = [['', '— Chọn —'], ['male', 'Nam'], ['female', 'Nữ'], ['other', 'Khác']]
const MARITAL = [['', '— Chọn —'], ['single', 'Độc thân'], ['married', 'Đã kết hôn'], ['divorced', 'Ly hôn']]
const DEPTS = ['Kinh doanh', 'Vận hành', 'HR', 'Tài chính', 'Kỹ thuật', 'Marketing', 'BOD', 'Khác']
const EMERGENCY_RELATIONS = [
  ['', '— Chọn —'], ['spouse', 'Vợ / Chồng'], ['parent', 'Bố / Mẹ'],
  ['sibling', 'Anh / Chị / Em'], ['child', 'Con'], ['friend', 'Bạn bè'], ['other', 'Khác'],
]

const TABS = [
  { key: 'general', label: 'Thông tin chung', icon: 'fa-id-badge' },
  { key: 'personal', label: 'Lý lịch', icon: 'fa-user' },
  { key: 'position', label: 'Chức danh', icon: 'fa-briefcase' },
  { key: 'salary', label: 'Lương & Bảo hiểm', icon: 'fa-wallet' },
  { key: 'training', label: 'Đào tạo & Văn bằng', icon: 'fa-graduation-cap' },
  { key: 'requests', label: 'Yêu cầu', icon: 'fa-inbox' },
]

// Các tab chưa xây dựng data — hiện placeholder tạm
const COMING_SOON_TABS = ['training', 'requests']

function initials(name = '') { return name.split(' ').slice(-2).map(w => w[0]).join('').toUpperCase() }

function statusLabel(s) { return STATUS[s] || s }
function genderLabel(g) { return g === 'male' ? 'Nam' : g === 'female' ? 'Nữ' : g === 'other' ? 'Khác' : '—' }

// field hiển thị (view mode)
function VField({ label, value, wide }) {
  return (
    <div className={`fg${wide ? ' col2' : ''}`}>
      <label>{label}</label>
      <span className="view-value">{value || '—'}</span>
    </div>
  )
}

// field chỉnh sửa (edit mode) — bind vào draft
function EField({ label, k, draft, setDraft, type = 'text', opts, wide }) {
  return (
    <div className={`fg${wide ? ' col2' : ''}`}>
      <label>{label}</label>
      {opts
        ? <select className="form-select" value={draft[k] || ''} onChange={e => setDraft(p => ({ ...p, [k]: e.target.value }))}>
            {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        : type === 'date'
          ? <DateInput value={draft[k] || ''} onChange={v => setDraft(p => ({ ...p, [k]: v }))} />
          : <input className="form-input" type={type} value={draft[k] || ''} onChange={e => setDraft(p => ({ ...p, [k]: e.target.value }))} />
      }
    </div>
  )
}

export default function ProfilePage() {
  const { id: routeId } = useParams()
  const { profile: authProfile } = useAuth()
  const isAdmin = authProfile?.role === 'admin'
  const viewingOtherId = isAdmin && routeId ? routeId : null

  const [form, setForm] = useState(INIT_PROFILE)
  const [draft, setDraft] = useState(null)
  const [editingTab, setEditingTab] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('general')
  const [managers, setManagers] = useState([])

  useEffect(() => { fetchProfile(); fetchManagers() }, [viewingOtherId, authProfile?.id])

  async function fetchProfile() {
    if (!viewingOtherId && !authProfile?.id) { setLoading(false); return }
    setLoading(true)
    const query = supabase.from('employee_profiles').select('*')
    const { data } = viewingOtherId
      ? await query.eq('id', viewingOtherId).single()
      : await query.eq('user_id', authProfile.id).single()

    if (data) setForm({ ...INIT_PROFILE, ...data, career_history: data.career_history || [] })
    else if (!viewingOtherId) setForm(p => ({ ...p, full_name: authProfile.full_name || '', email: authProfile.email || '' }))
    setLoading(false)
  }

  async function fetchManagers() {
    const { data } = await supabase.from('employee_profiles').select('id, full_name').order('full_name')
    setManagers(data || [])
  }
  const managerOpts = [['', '— Không có --'], ...managers.map(m => [m.id, m.full_name])]
  const managerName = managers.find(m => m.id === form.manager_id)?.full_name || ''

  function startEdit(tab) { if (!isAdmin) return; setDraft({ ...form }); setEditingTab(tab) }
  function cancelEdit() { setDraft(null); setEditingTab(null) }

  async function saveEdit() {
    if (!draft) return
    setSaving(true); setError('')
    const DATE_FIELDS = ['dob', 'id_issued_date', 'join_date', 'passport_issue_date', 'passport_expiry_date']
    const payload = { ...draft }
    DATE_FIELDS.forEach(f => { if (!payload[f]) payload[f] = null })
    payload.basic_salary = payload.basic_salary ? Number(payload.basic_salary) : 0
    payload.salary_coefficient = payload.salary_coefficient ? Number(payload.salary_coefficient) : null

    const { error } = await supabase.from('employee_profiles').update(payload).eq('id', form.id)
    setSaving(false)
    if (error) { setError(error.message); return }
    setForm(payload); setEditingTab(null); setDraft(null)
    setSuccess(true); setTimeout(() => setSuccess(false), 3000)
  }

  function isEditing(tab) { return editingTab === tab }

  if (loading) return <div className="loading-screen" style={{ minHeight: '60vh' }}><div className="spinner" /></div>

  return (
    <div>
      <div className="tabbar">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`tabbar-btn${activeTab === t.key ? ' active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            <i className={`fa-light ${t.icon}`} />
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="alert alert-error"><i className="fa-light fa-circle-exclamation" />{error}</div>}
      {success && <div className="alert alert-success"><i className="fa-light fa-circle-check" />Đã lưu thành công!</div>}

      {/* Tab: Thông tin chung */}
      {activeTab === 'general' && (
        <>
          <div className="card">
            <div className="profile-header-row">
              <div className="profile-header-left">
                <div className="profile-avatar avatar avatar-xl">{initials(form.full_name || '?')}</div>
                <div>
                  <h2 className="profile-name">{form.full_name || 'Chưa cập nhật tên'}</h2>
                  <div className="profile-position">{form.position || '—'}</div>
                  <div className="profile-tags">
                    {form.department && <span className="tag tag-code">{form.department}</span>}
                    <span className="tag tag-approved">{statusLabel(form.status)}</span>
                    {form.employee_code && <span className="tag tag-other">Mã số NV: {form.employee_code}</span>}
                  </div>
                </div>
              </div>

              <div className="profile-header-meta">
                <div className="meta-item"><span className="meta-label">Email</span><span className="meta-value">{form.email || '—'}</span></div>
                <div className="meta-item"><span className="meta-label">Điện thoại</span><span className="meta-value">{form.phone || '—'}</span></div>
                <div className="meta-item"><span className="meta-label">Học vấn</span><span className="meta-value">{form.education_level || '—'}</span></div>

                <div className="meta-item"><span className="meta-label">Giới tính</span><span className="meta-value">{genderLabel(form.gender)}</span></div>
                <div className="meta-item"><span className="meta-label">Ngày sinh</span><span className="meta-value">{form.dob || '—'}</span></div>
                <div className="meta-item"><span className="meta-label">Nguyên quán</span><span className="meta-value">{form.hometown || '—'}</span></div>

                <div className="meta-item"><span className="meta-label">Ngày nhận việc</span><span className="meta-value">{form.join_date || '—'}</span></div>
                <div className="meta-item"><span className="meta-label">Hôn nhân</span><span className="meta-value">{MARITAL.find(m => m[0] === form.marital_status)?.[1] || '—'}</span></div>
                <div className="meta-item"><span className="meta-label">Tên tài khoản</span><span className="meta-value">{form.account_name || '—'}</span></div>
              </div>
            </div>
          </div>

          <div className="dashboard-card">
            <div className="card-title">Quá trình làm việc</div>
            {form.career_history.length > 0
              ? (
                <div className="timeline">
                  {form.career_history.map((w, i) => (
                    <div key={i} className="timeline-item">
                      <span className={`timeline-dot${w.status === 'active' ? ' dot-active' : ''}`} />
                      <div className="timeline-content">
                        <div className="timeline-row">
                          <strong>{w.title}</strong>
                          <span className={`tag tag-${w.status === 'active' ? 'approved' : 'ended'}`}>{w.status === 'active' ? 'Đang làm việc' : 'Đã làm việc'}</span>
                        </div>
                        <div className="timeline-sub">{w.contract_label} — {w.contract_code}</div>
                        <div className="timeline-sub">{w.company} · {w.location} · {w.department}</div>
                        <div className="timeline-date">{w.date}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )
              : <div className="empty-hint">Chưa có dữ liệu.</div>
            }
          </div>
        </>
      )}

      {/* Tab: Lý lịch */}
      {activeTab === 'personal' && (
        <div className="personal-layout">
          <div className="personal-main">
            <div className="card">
              <div className="section-title">Thông tin</div>

              {!isEditing('personal') ? (
                <div className="form-grid">
                  <VField label="Dân tộc" value={form.ethnicity} />
                  <VField label="Tôn giáo" value={form.religion} />
                  <VField label="Nơi ở hiện nay" value={form.current_address} />
                  <VField label="Mã số thuế cá nhân" value={form.tax_code} />
                  <VField label="TK ngân hàng" value={form.bank_account ? `${form.bank_owner || ''}, ${form.bank_account}, ${form.bank_name || ''} ${form.bank_branch ? '- ' + form.bank_branch : ''}` : ''} wide />
                  <VField label="Trình độ phổ thông" value={form.high_school_level} />
                  <VField label="Trình độ học vấn cao nhất" value={form.education_level} />
                  <VField label="Nghĩa vụ quân sự" value={form.military_service} />
                  <VField label="Ghi chú" value={form.notes} wide />
                </div>
              ) : (
                <div className="form-grid">
                  <EField label="Dân tộc" k="ethnicity" draft={draft} setDraft={setDraft} />
                  <EField label="Tôn giáo" k="religion" draft={draft} setDraft={setDraft} />
                  <EField label="Nơi ở hiện nay" k="current_address" draft={draft} setDraft={setDraft} />
                  <EField label="Mã số thuế cá nhân" k="tax_code" draft={draft} setDraft={setDraft} />
                  <EField label="Tên chủ TK" k="bank_owner" draft={draft} setDraft={setDraft} />
                  <EField label="Số TK ngân hàng" k="bank_account" draft={draft} setDraft={setDraft} />
                  <EField label="Ngân hàng" k="bank_name" draft={draft} setDraft={setDraft} />
                  <EField label="Chi nhánh" k="bank_branch" draft={draft} setDraft={setDraft} />
                  <EField label="Trình độ phổ thông" k="high_school_level" draft={draft} setDraft={setDraft} />
                  <EField label="Trình độ học vấn cao nhất" k="education_level" draft={draft} setDraft={setDraft} />
                  <EField label="Nghĩa vụ quân sự" k="military_service" draft={draft} setDraft={setDraft} />
                  <EField label="Ghi chú" k="notes" draft={draft} setDraft={setDraft} wide />
                </div>
              )}

              <div className="section-title" style={{ marginTop: '1.5rem' }}>Thông tin CMND/CCCD/Hộ chiếu</div>

              {!isEditing('personal') ? (
                <div className="form-grid">
                  <VField label="Số CCCD/CMND" value={form.id_number} />
                  <VField label="Ngày cấp, nơi cấp CCCD/CMND" value={form.id_issued_date ? `${form.id_issued_date}, ${form.id_issued_place || ''}` : ''} />
                  <VField label="Số hộ chiếu" value={form.passport_number} />
                  <VField label="Loại hộ chiếu" value={form.passport_type} />
                  <VField label="Ngày cấp, nơi cấp hộ chiếu" value={form.passport_issue_date ? `${form.passport_issue_date}, ${form.passport_issue_place || ''}` : ''} />
                  <VField label="Ngày hết hạn hộ chiếu" value={form.passport_expiry_date} />
                </div>
              ) : (
                <div className="form-grid">
                  <EField label="Số CCCD/CMND" k="id_number" draft={draft} setDraft={setDraft} />
                  <EField label="Ngày cấp CCCD/CMND" k="id_issued_date" type="date" draft={draft} setDraft={setDraft} />
                  <EField label="Nơi cấp CCCD/CMND" k="id_issued_place" draft={draft} setDraft={setDraft} />
                  <EField label="Số hộ chiếu" k="passport_number" draft={draft} setDraft={setDraft} />
                  <EField label="Loại hộ chiếu" k="passport_type" draft={draft} setDraft={setDraft} />
                  <EField label="Ngày cấp hộ chiếu" k="passport_issue_date" type="date" draft={draft} setDraft={setDraft} />
                  <EField label="Nơi cấp hộ chiếu" k="passport_issue_place" draft={draft} setDraft={setDraft} />
                  <EField label="Ngày hết hạn hộ chiếu" k="passport_expiry_date" type="date" draft={draft} setDraft={setDraft} />
                </div>
              )}

              <div className="section-title" style={{ marginTop: '1.5rem' }}>Liên hệ khẩn cấp</div>

              {!isEditing('personal') ? (
                <div className="form-grid">
                  <VField label="Họ tên" value={form.emergency_name} />
                  <VField label="Quan hệ" value={EMERGENCY_RELATIONS.find(r => r[0] === form.emergency_relation)?.[1]} />
                  <VField label="Số điện thoại" value={form.emergency_phone} />
                  <VField label="Địa chỉ" value={form.emergency_address} wide />
                </div>
              ) : (
                <div className="form-grid">
                  <EField label="Họ tên" k="emergency_name" draft={draft} setDraft={setDraft} />
                  <EField label="Quan hệ" k="emergency_relation" opts={EMERGENCY_RELATIONS} draft={draft} setDraft={setDraft} />
                  <EField label="Số điện thoại" k="emergency_phone" type="tel" draft={draft} setDraft={setDraft} />
                  <EField label="Địa chỉ" k="emergency_address" draft={draft} setDraft={setDraft} wide />
                </div>
              )}

              <div className="tab-actions">
                {isAdmin ? (
                  isEditing('personal') ? (
                    <>
                      <button className="btn btn-ghost" onClick={cancelEdit}>Hủy</button>
                      <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu thay đổi'}</button>
                    </>
                  ) : (
                    <button className="btn btn-outline" onClick={() => startEdit('personal')}>Chỉnh sửa</button>
                  )
                ) : null}
              </div>
            </div>
          </div>

          <aside className="profile-sidebar">
            <div className="sidebar-card">
              <div className="profile-header-left">
                <div className="profile-avatar avatar avatar-lg">{initials(form.full_name || '?')}</div>
                <div>
                  <h2 className="profile-name">{form.full_name || '—'}</h2>
                  <div className="profile-position">{form.position} · {form.department}</div>
                </div>
              </div>
              <div className="profile-tags" style={{ marginTop: '10px' }}>
                {form.employee_code && <span className="tag tag-code">Mã số NV: {form.employee_code}</span>}
                <span className="tag tag-approved">{statusLabel(form.status)}</span>
              </div>

              <ul className="contact-list">
                <li><i className="fa-light fa-envelope" /><div><span className="contact-label">Email</span><span className="contact-value">{form.email || '—'}</span></div></li>
                <li><i className="fa-light fa-phone" /><div><span className="contact-label">Điện thoại</span><span className="contact-value">{form.phone || '—'}</span></div></li>
                <li><i className="fa-light fa-graduation-cap" /><div><span className="contact-label">Học vấn</span><span className="contact-value">{form.education_level || '—'}</span></div></li>
                <li><i className="fa-light fa-cake-candles" /><div><span className="contact-label">Ngày sinh</span><span className="contact-value">{form.dob || '—'}</span></div></li>
                <li><i className="fa-light fa-venus-mars" /><div><span className="contact-label">Giới tính</span><span className="contact-value">{genderLabel(form.gender)}</span></div></li>
                <li><i className="fa-light fa-calendar-check" /><div><span className="contact-label">Ngày nhận việc</span><span className="contact-value">{form.join_date || '—'}</span></div></li>
                <li><i className="fa-light fa-house" /><div><span className="contact-label">Nguyên quán</span><span className="contact-value">{form.hometown || '—'}</span></div></li>
                <li><i className="fa-light fa-heart" /><div><span className="contact-label">Hôn nhân</span><span className="contact-value">{MARITAL.find(m => m[0] === form.marital_status)?.[1] || '—'}</span></div></li>
                <li><i className="fa-light fa-address-card" /><div><span className="contact-label">Tên tài khoản</span><span className="contact-value">{form.account_name || '—'}</span></div></li>
                {managerName && <li><i className="fa-light fa-user-tie" /><div><span className="contact-label">Quản lý trực tiếp</span><span className="contact-value">{managerName}</span></div></li>}
              </ul>
            </div>
          </aside>
        </div>
      )}

      {/* Tab: Chức danh */}
      {activeTab === 'position' && (
        <div className="card">
          <div className="section-title">Thông tin chức danh</div>

          {!isEditing('position') ? (
            <div className="form-grid">
              <VField label="Mã ngạch" value={form.rank_code} />
              <VField label="Tên ngạch" value={form.rank_name} />
              <VField label="Bậc" value={form.level} />
              <VField label="Phòng ban" value={form.department} />
              <VField label="Chức vụ" value={form.position} />
              <VField label="Quản lý trực tiếp" value={managerName} />
            </div>
          ) : (
            <div className="form-grid">
              <EField label="Mã ngạch" k="rank_code" draft={draft} setDraft={setDraft} />
              <EField label="Tên ngạch" k="rank_name" draft={draft} setDraft={setDraft} />
              <EField label="Bậc" k="level" draft={draft} setDraft={setDraft} />
              <EField label="Phòng ban" k="department" opts={[['', '— Chọn —'], ...DEPTS.map(d => [d, d])]} draft={draft} setDraft={setDraft} />
              <EField label="Chức vụ" k="position" draft={draft} setDraft={setDraft} />
              <EField label="Quản lý trực tiếp" k="manager_id" opts={managerOpts} draft={draft} setDraft={setDraft} />
            </div>
          )}

          <div className="tab-actions">
            {isAdmin ? (
              isEditing('position') ? (
                <>
                  <button className="btn btn-ghost" onClick={cancelEdit}>Hủy</button>
                  <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu thay đổi'}</button>
                </>
              ) : (
                <button className="btn btn-outline" onClick={() => startEdit('position')}>Chỉnh sửa</button>
              )
            ) : null}
          </div>
        </div>
      )}

      {/* Tab: Lương & Bảo hiểm */}
      {activeTab === 'salary' && (
        <div className="card">
          <div className="section-title">Lương & Bảo hiểm</div>

          {!isEditing('salary') ? (
            <div className="form-grid">
              <VField label="Ngày vào làm" value={form.join_date} />
              <VField label="Loại hợp đồng" value={CONTRACT_TYPES.find(c => c[0] === form.contract_type)?.[1]} />
              <VField label="Hệ số lương" value={form.salary_coefficient} />
              <VField label="Lương cơ bản" value={form.basic_salary ? Number(form.basic_salary).toLocaleString('vi-VN') + ' đ' : ''} />
              <VField label="Ngân hàng" value={form.bank_name} />
              <VField label="Số tài khoản" value={form.bank_account} />
              <VField label="Chi nhánh" value={form.bank_branch} />
              <VField label="Mã số thuế TNCN" value={form.tax_code} />
              <VField label="Mã số BHXH" value={form.insurance_code} />
              <VField label="Nơi đăng ký KCB ban đầu" value={form.insurance_place} wide />
            </div>
          ) : (
            <div className="form-grid">
              <EField label="Ngày vào làm" k="join_date" type="date" draft={draft} setDraft={setDraft} />
              <EField label="Loại hợp đồng" k="contract_type" opts={CONTRACT_TYPES} draft={draft} setDraft={setDraft} />
              <EField label="Hệ số lương" k="salary_coefficient" type="number" draft={draft} setDraft={setDraft} />
              <div className="fg">
                <label>Lương cơ bản</label>
                <div className="input-suffix">
                  <input className="form-input" type="number" min="0" value={draft.basic_salary || 0} onChange={e => setDraft(p => ({ ...p, basic_salary: e.target.value }))} />
                  <span className="suffix">₫</span>
                </div>
              </div>
              <EField label="Ngân hàng" k="bank_name" draft={draft} setDraft={setDraft} />
              <EField label="Số tài khoản" k="bank_account" draft={draft} setDraft={setDraft} />
              <EField label="Chi nhánh" k="bank_branch" draft={draft} setDraft={setDraft} />
              <EField label="Mã số thuế TNCN" k="tax_code" draft={draft} setDraft={setDraft} />
              <EField label="Mã số BHXH" k="insurance_code" draft={draft} setDraft={setDraft} />
              <EField label="Nơi đăng ký KCB ban đầu" k="insurance_place" draft={draft} setDraft={setDraft} wide />
            </div>
          )}

          <div className="tab-actions">
            {isAdmin ? (
              isEditing('salary') ? (
                <>
                  <button className="btn btn-ghost" onClick={cancelEdit}>Hủy</button>
                  <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu thay đổi'}</button>
                </>
              ) : (
                <button className="btn btn-outline" onClick={() => startEdit('salary')}>Chỉnh sửa</button>
              )
            ) : null}
          </div>
        </div>
      )}

      {/* Các tab chưa xây dựng — placeholder */}
      {COMING_SOON_TABS.includes(activeTab) && (
        <div className="dashboard-card">
          <div className="empty-hint">Tính năng đang được phát triển, sẽ có trong bản cập nhật sau.</div>
        </div>
      )}
    </div>
  )
}
