import { useState } from 'react'
import Modal from './Modal.jsx'
import { readWorkbook, sheetToRows, validateRows } from '../lib/import/parseSheet'
import { employeesImportConfig } from '../lib/import/configs/employees'
import { nextEmployeeCodes } from '../lib/employeeCode'
import { supabase } from '../lib/supabase'

export default function ImportEmployeesModal({ onClose, onImported }) {
  const [fileName, setFileName] = useState('')
  const [parsing, setParsing] = useState(false)
  const [errors, setErrors] = useState([])
  const [validRows, setValidRows] = useState(null)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setParsing(true)
    setErrors([])
    setValidRows(null)
    setError('')

    try {
      const wb = await readWorkbook(file)
      const rawRows = sheetToRows(wb, employeesImportConfig)
      if (rawRows.length === 0) {
        setError('Không tìm thấy dòng dữ liệu nào trong file')
        setParsing(false)
        return
      }
      const { validRows: valid, errors: errs } = validateRows(rawRows, employeesImportConfig)
      setErrors(errs)
      if (errs.length === 0) setValidRows(valid)
    } catch (err) {
      setError('Không đọc được file. Kiểm tra lại định dạng.')
    }
    setParsing(false)
  }

  async function handleImport() {
    if (!validRows || validRows.length === 0) return
    setImporting(true)
    setError('')

    const sorted = [...validRows].sort((a, b) => (a.join_date || '').localeCompare(b.join_date || ''))
    const codes = await nextEmployeeCodes(sorted.length)
    const payload = sorted.map((row, i) => ({ ...row, employee_code: codes[i] }))

    const { error: insErr } = await supabase.from('employee_profiles').insert(payload)
    setImporting(false)
    if (insErr) { setError(insErr.message); return }
    onImported(payload.length)
  }

  const ready = validRows && errors.length === 0

  return (
    <Modal
      title="Import nhân viên từ file Excel"
      onClose={onClose}
      footer={ready ? [
        <button key="c" className="btn" onClick={onClose}>Huỷ</button>,
        <button key="i" className="btn btn-primary" onClick={handleImport} disabled={importing}>
          {importing ? 'Đang import...' : `Import ${validRows.length} nhân viên`}
        </button>
      ] : [
        <button key="c" className="btn" onClick={onClose}>Đóng</button>
      ]}
    >
      <div className="form-group">
        <label className="form-label">Chọn file Excel (.xlsx)</label>
        <input type="file" accept=".xlsx,.xls" onChange={handleFile} />
        {fileName && <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 6 }}>{fileName}</div>}
      </div>

      {parsing && <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Đang đọc file...</div>}

      {error && <div className="alert alert-error">{error}</div>}

      {errors.length > 0 && (
        <div>
          <div className="alert alert-error" style={{ marginBottom: 8 }}>
            Có {errors.length} dòng lỗi. Sửa lại file và import lại — chưa có dòng nào được thêm vào hệ thống.
          </div>
          <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            {errors.map(e => (
              <div key={e.row} style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <strong>Dòng {e.row}:</strong> {e.messages.join('; ')}
              </div>
            ))}
          </div>
        </div>
      )}

      {ready && (
        <div className="alert alert-success">Đọc thành công {validRows.length} nhân viên, sẵn sàng import.</div>
      )}
    </Modal>
  )
}
