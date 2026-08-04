import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import DateInput from '../components/DateInput.jsx'
import { supabase } from '../lib/supabase'

const INIT_FORM = {
  // Cá nhân
  full_name: '', email: '', phone: '', gender: '', dob: '', marital_status: '',
  hometown: '', ethnicity: '', religion: '', education_level: '',
  id_number: '', id_issued_date: '', id_issued_place: '',
  permanent_address: '', current_address: '',
  // Tổ chức
  employee_code: '', department: '', position: '', manager_id: '',
  // Hợp đồng
  contract_type: 'full_time', status: 'probation', join_date: '',
  probation_end_date: '', contract_end_date: '', basic_salary: 0, salary_type: 'monthly',
  // Ngân hàng & Thuế
  bank_owner: '', bank_account: '', bank_name: '', bank_branch: '',
  tax_code: '', insurance_code: '', insurance_place: '',
  // Liên hệ khẩn cấp
  emergency_name: '', emergency_phone: '', emergency_relation: '', emergency_address: '',
}

const GENDERS = [['', '— Chọn —'], ['male', 'Nam'], ['female', 'Nữ'], ['other', 'Khác']]
const MARITAL = [['', '— Chọn —'], ['single', 'Độc thân'], ['married', 'Đã kết hôn'], ['divorced', 'Ly hôn']]
const DEPTS = ['Kinh doanh', 'Vận hành', 'HR', 'Tài chính', 'Kỹ thuật', 'Marketing', 'BOD', 'Khác']
const STATUS = { active: 'Đang làm', probation: 'Thử việc', leave: 'Nghỉ phép', quit: 'Đã nghỉ' }
const CONTRACT_TYPES = [
  ['full_time', 'Chính thức (toàn thời gian)'],
  ['part_time', 'Bán thời gian'],
  ['contract', 'Hợp đồng dịch vụ'],
  ['intern', 'Thực tập sinh'],
]
const SALARY_TYPES = [['monthly', 'Theo tháng'], ['daily', 'Theo ngày'], ['hourly', 'Theo giờ']]
const EMERGENCY_RELATIONS = [
  ['', '— Chọn —'], ['spouse', 'Vợ / Chồng'], ['parent', 'Bố / Mẹ'],
  ['sibling', 'Anh / Chị / Em'], ['child', 'Con'], ['friend', 'Bạn bè'], ['other', 'Khác'],
]

const TABS = [
  { key: 'personal', label: 'Cá nhân', icon: 'fa-circle-info' },
  { key: 'organization', label: 'Tổ chức', icon: 'fa-building' },
  { key: 'contract', label: 'Hợp đồng', icon: 'fa-file-contract' },
  { key: 'bank', label: 'Ngân hàng & Thuế', icon: 'fa-credit-card' },
  { key: 'emergency', label: 'Liên hệ khẩn', icon: 'fa-phone-flip' },
]

function Field({ label, k, form, setForm, type = 'text', opts, required }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}{required && <span className="req">*</span>}</label>
      {opts
        ? <select className="form-select" value={form[k] || ''} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}>
            {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        : type === 'date'
          ? <DateInput value={form[k] || ''} onChange={v => setForm(p => ({ ...p, [k]: v }))} />
          : <input
              className="form-input"
              type={type}
              value={form[k] || ''}
              onChange={e => {
                const val = type === 'tel'
                  ? e.target.value.replace(/\D/g, '').slice(0, 10)
                  : e.target.value
                setForm(p => ({ ...p, [k]: val }))
              }}
              maxLength={type === 'tel' ? 10 : undefined}
            />
      }
    </div>
  )
}

export default function EmployeeCreatePage() {
  const navigate = useNavigate()
  const [form, setForm] = useState(INIT_FORM)
  const [activeTab, setActiveTab] = useState('personal')
  const [managers, setManagers] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetchManagers(); generateEmployeeCode().then(code => setForm(p => ({ ...p, employee_code: code }))) }, [])

  async function generateEmployeeCode() {
    const { data } = await supabase
      .from('employee_profiles')
      .select('employee_code')
      .like('employee_code', 'OWS-%')
    const maxSeq = (data || []).reduce((max, row) => {
      const match = /^OWS-\d{2}(\d{3})$/.exec(row.employee_code || '')
      const seq = match ? parseInt(match[1], 10) : 0
      return seq > max ? seq : max
    }, 0)
    const yy = String(new Date().getFullYear()).slice(-2)
    return `OWS-${yy}${String(maxSeq + 1).padStart(3, '0')}`
  }


  async function fetchManagers() {
    const { data } = await supabase.from('employee_profiles').select('id, full_name').order('full_name')
    setManagers(data || [])
  }

  const managerOpts = [['', '— Không có --'], ...managers.map(m => [m.id, m.full_name])]

  function validate() {
    if (!form.full_name?.trim()) { setActiveTab('personal'); return 'Vui lòng nhập họ tên' }
    if (!form.email?.trim()) { setActiveTab('personal'); return 'Vui lòng nhập email' }
    if (!form.department) { setActiveTab('organization'); return 'Vui lòng chọn phòng ban' }
    if (!form.position?.trim()) { setActiveTab('organization'); return 'Vui lòng nhập chức danh' }
    if (!form.join_date) { setActiveTab('contract'); return 'Vui lòng chọn ngày vào làm' }
    if (!form.emergency_name?.trim()) { setActiveTab('emergency'); return 'Vui lòng nhập họ tên người liên hệ khẩn cấp' }
    if (!form.emergency_phone?.trim()) { setActiveTab('emergency'); return 'Vui lòng nhập số điện thoại liên hệ khẩn cấp' }
    return ''
  }

  async function save() {
    const msg = validate()
    if (msg) { setError(msg); return }

    setSaving(true); setError('')

    const freshCode = await generateEmployeeCode()

    const DATE_FIELDS = ['dob', 'id_issued_date', 'join_date', 'probation_end_date', 'contract_end_date']
    const payload = { ...form, employee_code: freshCode }
    DATE_FIELDS.forEach(f => { if (!payload[f]) payload[f] = null })
    if (!payload.manager_id) payload.manager_id = null
    payload.basic_salary = Number(payload.basic_salary) || 0

    const { error } = await supabase.from('employee_profiles').insert(payload)
    setSaving(false)
    if (error) setError(error.message)
    else navigate('/nhan-vien')
  }

  return (
    <div className="content-inner">
      <div className="page-header-row">
        <div className="page-header-left">
          <button className="back-btn" onClick={() => navigate('/nhan-vien')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div>
            <h1>Thêm nhân viên mới</h1>
            <p>Điền đầy đủ thông tin để tạo hồ sơ mới</p>
          </div>
        </div>
        <div className="flex gap-8">
          <button className="btn btn-ghost" onClick={() => navigate('/nhan-vien')}>Hủy</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Đang lưu...' : 'Tạo nhân viên'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error"><i className="fa-light fa-circle-exclamation" />{error}</div>}

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

      {/* Tab: Cá nhân */}
      {activeTab === 'personal' && (
        <>
          <div className="card">
            <div className="section-title">Thông tin cá nhân</div>
            <div className="form-row">
              <Field label="Họ và tên" k="full_name" form={form} setForm={setForm} required />
              <Field label="Email" k="email" type="email" form={form} setForm={setForm} required />
            </div>
            <div className="form-row">
              <Field label="Số điện thoại" k="phone" type="tel" form={form} setForm={setForm} />
              <Field label="Giới tính" k="gender" opts={GENDERS} form={form} setForm={setForm} />
            </div>
            <div className="form-row">
              <Field label="Ngày sinh" k="dob" type="date" form={form} setForm={setForm} />
              <Field label="Tình trạng hôn nhân" k="marital_status" opts={MARITAL} form={form} setForm={setForm} />
            </div>
            <div className="form-row">
              <Field label="Nguyên quán" k="hometown" form={form} setForm={setForm} />
              <Field label="Trình độ học vấn" k="education_level" form={form} setForm={setForm} />
            </div>
            <div className="form-row">
              <Field label="Dân tộc" k="ethnicity" form={form} setForm={setForm} />
              <Field label="Tôn giáo" k="religion" form={form} setForm={setForm} />
            </div>
          </div>

          <div className="card">
            <div className="section-title">Giấy tờ tùy thân</div>
            <div className="form-row">
              <Field label="Số CCCD/CMND" k="id_number" form={form} setForm={setForm} />
              <Field label="Ngày cấp" k="id_issued_date" type="date" form={form} setForm={setForm} />
            </div>
            <Field label="Nơi cấp" k="id_issued_place" form={form} setForm={setForm} />
          </div>

          <div className="card">
            <div className="section-title">Địa chỉ</div>
            <Field label="Địa chỉ thường trú" k="permanent_address" form={form} setForm={setForm} />
            <Field label="Địa chỉ hiện tại" k="current_address" form={form} setForm={setForm} />
          </div>
        </>
      )}

      {/* Tab: Tổ chức */}
      {activeTab === 'organization' && (
        <div className="card">
          <div className="section-title">Thông tin tổ chức</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Mã nhân viên</label>
              <input className="form-input readonly" value={form.employee_code} readOnly />
            </div>
            <Field label="Phòng ban" k="department" opts={[['', '— Chọn —'], ...DEPTS.map(d => [d, d])]} form={form} setForm={setForm} required />
          </div>
          <div className="form-row">
            <Field label="Chức danh" k="position" form={form} setForm={setForm} required />
            <Field label="Quản lý trực tiếp" k="manager_id" opts={managerOpts} form={form} setForm={setForm} />
          </div>
          <span className="hint-text">Mã nhân viên tự động sinh theo thứ tự vào làm, không thể sửa</span>
        </div>
      )}

      {/* Tab: Hợp đồng */}
      {activeTab === 'contract' && (
        <>
          <div className="card">
            <div className="section-title">Thông tin hợp đồng</div>
            <div className="form-row">
              <Field label="Loại hợp đồng" k="contract_type" opts={CONTRACT_TYPES} form={form} setForm={setForm} />
              <Field label="Trạng thái" k="status" opts={Object.entries(STATUS)} form={form} setForm={setForm} />
            </div>
            <div className="form-row">
              <Field label="Ngày vào làm" k="join_date" type="date" form={form} setForm={setForm} required />
              <Field label="Kết thúc thử việc" k="probation_end_date" type="date" form={form} setForm={setForm} />
            </div>
            <Field label="Ngày kết thúc HĐ" k="contract_end_date" type="date" form={form} setForm={setForm} />
            <span className="hint-text">Để trống nếu hợp đồng không xác định thời hạn</span>
          </div>

          <div className="card">
            <div className="section-title">Mức lương</div>
            <div className="form-row">
              <Field label="Lương cơ bản" k="basic_salary" type="number" form={form} setForm={setForm} />
              <Field label="Hình thức tính lương" k="salary_type" opts={SALARY_TYPES} form={form} setForm={setForm} />
            </div>
          </div>
        </>
      )}

      {/* Tab: Ngân hàng & Thuế */}
      {activeTab === 'bank' && (
        <>
          <div className="card">
            <div className="section-title">Thông tin ngân hàng</div>
            <div className="form-row">
              <Field label="Tên chủ tài khoản" k="bank_owner" form={form} setForm={setForm} />
              <Field label="Số tài khoản" k="bank_account" form={form} setForm={setForm} />
            </div>
            <div className="form-row">
              <Field label="Ngân hàng" k="bank_name" form={form} setForm={setForm} />
              <Field label="Chi nhánh" k="bank_branch" form={form} setForm={setForm} />
            </div>
          </div>

          <div className="card">
            <div className="section-title">Thuế & Bảo hiểm</div>
            <div className="form-row">
              <Field label="Mã số thuế TNCN" k="tax_code" form={form} setForm={setForm} />
              <Field label="Mã số BHXH" k="insurance_code" form={form} setForm={setForm} />
            </div>
            <Field label="Nơi đăng ký KCB ban đầu" k="insurance_place" form={form} setForm={setForm} />
          </div>
        </>
      )}

      {/* Tab: Liên hệ khẩn cấp */}
      {activeTab === 'emergency' && (
        <div className="card">
          <div className="section-title">Người liên hệ khẩn cấp</div>
          <div className="alert alert-info">
            <i className="fa-light fa-circle-info" />
            Thông tin này sẽ được liên hệ khi xảy ra sự cố khẩn cấp với nhân viên
          </div>
          <div className="form-row">
            <Field label="Họ tên" k="emergency_name" form={form} setForm={setForm} required />
            <Field label="Quan hệ" k="emergency_relation" opts={EMERGENCY_RELATIONS} form={form} setForm={setForm} />
          </div>
          <div className="form-row">
            <Field label="Số điện thoại" k="emergency_phone" type="tel" form={form} setForm={setForm} required />
            <Field label="Địa chỉ" k="emergency_address" form={form} setForm={setForm} />
          </div>
        </div>
      )}

      <div className="form-footer">
        <button className="btn btn-ghost" onClick={() => navigate('/nhan-vien')}>Hủy bỏ</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Đang lưu...' : 'Tạo nhân viên'}
        </button>
      </div>
    </div>
  )
}
