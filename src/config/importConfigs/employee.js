import { parseDMY } from '../lib/importExport'

export const employeeImportConfig = {
  module: 'employee',
  table: 'employees',
  sheetName: 'Nhân viên',
  skipRowsAfterHeader: 1,
  codePrefix: 'OPW',
  codeDigits: 3,
  columns: [
    { label: 'Mã NV', field: 'employee_code', required: false },
    { label: 'Họ tên', field: 'full_name', required: true },
    { label: 'Ngày sinh', field: 'date_of_birth', required: false },
    { label: 'Giới tính', field: 'gender', required: false },
    { label: 'CCCD', field: 'national_id', required: false },
    { label: 'Ngày cấp CCCD', field: 'national_id_issue_date', required: false },
    { label: 'Nơi cấp CCCD', field: 'national_id_issue_place', required: false },
    { label: 'Địa chỉ thường trú', field: 'permanent_address', required: false },
    { label: 'Địa chỉ hiện tại', field: 'current_address', required: false },
    { label: 'SĐT', field: 'phone', required: false },
    { label: 'Email cá nhân', field: 'personal_email', required: false },
    { label: 'Email công ty', field: 'work_email', required: false },
    { label: 'Tình trạng hôn nhân', field: 'marital_status', required: false },
    { label: 'Phòng ban', field: 'department', required: true },
    { label: 'Chức vụ', field: 'position', required: true },
    { label: 'Quản lý trực tiếp', field: 'manager_name', required: false },
    { label: 'Ngày vào làm', field: 'start_date', required: true },
    { label: 'Loại hợp đồng', field: 'contract_type', required: false },
    { label: 'Lương cơ bản', field: 'base_salary', required: false, type: 'number' },
    { label: 'Ngân hàng', field: 'bank_name', required: false },
    { label: 'Số tài khoản', field: 'bank_account_number', required: false },
    { label: 'Mã số thuế TNCN', field: 'personal_tax_code', required: false },
    { label: 'Số sổ BHXH', field: 'social_insurance_number', required: false },
    { label: 'Trình độ học vấn', field: 'education_level', required: false },
    { label: 'Chuyên ngành', field: 'major', required: false },
    { label: 'Trường', field: 'school', required: false },
    { label: 'Năm tốt nghiệp', field: 'graduation_year', required: false, type: 'number' },
  ],
  postProcessRows(rows, existingEmployees) {
    const prefix = this.codePrefix
    const digits = this.codeDigits

    const existingNumbers = (existingEmployees || [])
      .map(e => e.employee_code)
      .filter(code => code && code.startsWith(prefix))
      .map(code => parseInt(code.slice(prefix.length), 10))
      .filter(n => !Number.isNaN(n))

    let nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1

    const sorted = [...rows].sort((a, b) => {
      const dateA = parseDMY(a.start_date)
      const dateB = parseDMY(b.start_date)
      if (!dateA || !dateB) return 0
      return dateA - dateB
    })

    const withCodes = sorted.map(row => {
      const code = `${prefix}${String(nextNumber).padStart(digits, '0')}`
      nextNumber += 1
      return { ...row, employee_code: code }
    })

    const nameToCode = {}
    withCodes.forEach(row => {
      nameToCode[row.full_name.trim().toLowerCase()] = row.employee_code
    })
    ;(existingEmployees || []).forEach(e => {
      if (e.full_name) nameToCode[e.full_name.trim().toLowerCase()] = e.employee_code
    })

    return withCodes.map(row => {
      const managerKey = (row.manager_name || '').trim().toLowerCase()
      const managerCode = managerKey && nameToCode[managerKey] ? nameToCode[managerKey] : null
      return { ...row, manager_employee_code: managerCode }
    })
  },
}
